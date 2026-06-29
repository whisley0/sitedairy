// Minimal SentencePiece tokenizer for Nemotron, ported from parakeet-rs
// (src/nemotron.rs::SentencePieceVocab). We only need to map ids -> pieces and
// detokenize, so we parse just field 1 (repeated SentencePiece) of the protobuf
// .model file and, within each, field 1 (the piece string).

const SP_UNDERLINE = '\u2581'; // ▁ marks a leading space in SentencePiece.

function readVarint(data: Uint8Array, pos: number): [number, number] {
  let result = 0;
  let shift = 0;
  let p = pos;
  while (p < data.length && p - pos < 10) {
    const byte = data[p];
    result += (byte & 0x7f) * Math.pow(2, shift);
    p += 1;
    if ((byte & 0x80) === 0) return [result, p - pos];
    shift += 7;
  }
  throw new Error('Invalid varint in tokenizer.model');
}

// Manual UTF-8 decode: Hermes does not guarantee a global TextDecoder, and
// multilingual SentencePiece pieces contain non-ASCII bytes we must decode.
function utf8Decode(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++];
    if (b0 < 0x80) {
      out += String.fromCharCode(b0);
    } else if (b0 >= 0xc0 && b0 < 0xe0) {
      const b1 = bytes[i++] & 0x3f;
      out += String.fromCharCode(((b0 & 0x1f) << 6) | b1);
    } else if (b0 >= 0xe0 && b0 < 0xf0) {
      const b1 = bytes[i++] & 0x3f;
      const b2 = bytes[i++] & 0x3f;
      out += String.fromCharCode(((b0 & 0x0f) << 12) | (b1 << 6) | b2);
    } else {
      const b1 = bytes[i++] & 0x3f;
      const b2 = bytes[i++] & 0x3f;
      const b3 = bytes[i++] & 0x3f;
      let cp = ((b0 & 0x07) << 18) | (b1 << 12) | (b2 << 6) | b3;
      cp -= 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    }
  }
  return out;
}

function parsePieceMessage(data: Uint8Array): string {
  let pos = 0;
  let piece = '';
  while (pos < data.length) {
    const [header, hb] = readVarint(data, pos);
    pos += hb;
    const fieldNum = Math.floor(header / 8);
    const wireType = header & 0x7;
    if (fieldNum === 1 && wireType === 2) {
      const [len, lb] = readVarint(data, pos);
      pos += lb;
      if (pos + len <= data.length) piece = utf8Decode(data.subarray(pos, pos + len));
      pos += len;
    } else if (wireType === 0) {
      pos += readVarint(data, pos)[1];
    } else if (wireType === 1) {
      pos += 8;
    } else if (wireType === 2) {
      const [len, lb] = readVarint(data, pos);
      pos += lb + len;
    } else if (wireType === 5) {
      pos += 4;
    } else {
      break;
    }
  }
  return piece;
}

export function parseSentencePieceModel(data: Uint8Array): string[] {
  const pieces: string[] = [];
  let pos = 0;
  while (pos < data.length) {
    const [header, hb] = readVarint(data, pos);
    pos += hb;
    const fieldNum = Math.floor(header / 8);
    const wireType = header & 0x7;
    if (fieldNum === 1 && wireType === 2) {
      const [len, lb] = readVarint(data, pos);
      pos += lb;
      if (pos + len > data.length) break;
      pieces.push(parsePieceMessage(data.subarray(pos, pos + len)));
      pos += len;
    } else if (wireType === 0) {
      pos += readVarint(data, pos)[1];
    } else if (wireType === 1) {
      pos += 8;
    } else if (wireType === 2) {
      const [len, lb] = readVarint(data, pos);
      pos += lb + len;
    } else if (wireType === 5) {
      pos += 4;
    } else {
      break;
    }
  }
  if (pieces.length === 0) throw new Error('No tokens found in tokenizer.model');
  return pieces;
}

// SentencePiece pieces that are language tags like <en> or <en-US>; the
// multilingual model emits these inline and they are stripped from transcripts.
function isLangTag(piece: string): boolean {
  if (piece.length < 4 || piece[0] !== '<' || piece[piece.length - 1] !== '>') return false;
  const inner = piece.slice(1, -1);
  const isLower = (c: string) => c >= 'a' && c <= 'z';
  const isUpper = (c: string) => c >= 'A' && c <= 'Z';
  if (inner.length === 2) return isLower(inner[0]) && isLower(inner[1]);
  if (inner.length === 5) {
    return (
      isLower(inner[0]) && isLower(inner[1]) && inner[2] === '-' && isUpper(inner[3]) && isUpper(inner[4])
    );
  }
  return false;
}

// Latin / ASCII printable text (English plus shared digits and punctuation).
function isAsciiPrintable(cp: number): boolean {
  return cp === 0x09 || (cp >= 0x20 && cp <= 0x7e);
}

// CJK Han ideographs and CJK punctuation/fullwidth forms. Mandarin and
// Cantonese share the same Han script, so this single range covers both.
function isCjk(cp: number): boolean {
  return (
    (cp >= 0x3000 && cp <= 0x303f) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xff00 && cp <= 0xffef) ||
    (cp >= 0x20000 && cp <= 0x2a6df) ||
    (cp >= 0x2a700 && cp <= 0x2ebef)
  );
}

export class Tokenizer {
  readonly pieces: string[];
  readonly langTagIds: Set<number>;

  constructor(pieces: string[]) {
    this.pieces = pieces;
    this.langTagIds = new Set();
    for (let i = 0; i < pieces.length; i++) {
      if (isLangTag(pieces[i])) this.langTagIds.add(i);
    }
  }

  static fromBytes(data: Uint8Array): Tokenizer {
    return new Tokenizer(parseSentencePieceModel(data));
  }

  get size(): number {
    return this.pieces.length;
  }

  decodeSingle(id: number): string {
    return id < this.pieces.length ? this.pieces[id].split(SP_UNDERLINE).join(' ') : '';
  }

  // Join ids into text, stripping language-tag tokens, ▁ -> space.
  decode(ids: number[]): string {
    let out = '';
    for (const id of ids) {
      if (id < this.pieces.length && !this.langTagIds.has(id)) {
        out += this.pieces[id].split(SP_UNDERLINE).join(' ');
      }
    }
    return out.replace(/^\s+/, '');
  }

  // True if `piece` may be emitted when transcription is restricted to Chinese
  // and English: Latin/ASCII, CJK Han, control tokens, and only en/zh lang tags.
  private isChineseEnglishPiece(piece: string): boolean {
    if (piece.length === 0) return true;
    if (piece[0] === '<' && piece[piece.length - 1] === '>') {
      if (isLangTag(piece)) {
        const base = piece.slice(1, 3);
        return base === 'en' || base === 'zh';
      }
      return true; // non-language control tokens (e.g. <unk>, <s>, </s>)
    }
    for (let i = 0; i < piece.length; ) {
      const cp = piece.codePointAt(i) as number;
      i += cp > 0xffff ? 2 : 1;
      if (cp === 0x2581) continue; // ▁ leading-space marker
      if (isAsciiPrintable(cp) || isCjk(cp)) continue;
      return false;
    }
    return true;
  }

  // Mask (1 = allowed) over the vocabulary that lets the decoder emit only
  // Chinese (Mandarin + Cantonese) and English tokens. Disallowed tokens are
  // skipped during greedy decoding so other languages can never be produced.
  chineseEnglishMask(): Uint8Array {
    const mask = new Uint8Array(this.pieces.length);
    for (let i = 0; i < this.pieces.length; i++) {
      mask[i] = this.isChineseEnglishPiece(this.pieces[i]) ? 1 : 0;
    }
    return mask;
  }
}
