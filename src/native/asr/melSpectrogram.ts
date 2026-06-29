// Log-mel spectrogram for Nemotron streaming ASR, ported 1:1 from parakeet-rs
// (src/audio.rs + src/nemotron.rs::compute_mel_spectrogram). NeMo feeds the RAW
// log-mel (in "dB") to the encoder, so there is intentionally NO per-feature
// normalization here.

export const SAMPLE_RATE = 16000;
export const N_FFT = 512;
export const WIN_LENGTH = 400;
export const HOP_LENGTH = 160;
export const N_MELS = 128;
export const PREEMPH = 0.97;
// NeMo log_zero_guard_type="add", value = 2^-24.
const LOG_ZERO_GUARD = 5.9604645e-8;

// --- Slaney mel scale (librosa) ---
const F_SP = 200.0 / 3.0;
const MIN_LOG_HZ = 1000.0;
const MIN_LOG_MEL = MIN_LOG_HZ / F_SP;
const LOG_STEP = 0.06875177742094912;

function hzToMel(hz: number): number {
  return hz < MIN_LOG_HZ ? hz / F_SP : MIN_LOG_MEL + Math.log(hz / MIN_LOG_HZ) / LOG_STEP;
}
function melToHz(mel: number): number {
  return mel < MIN_LOG_MEL ? mel * F_SP : MIN_LOG_HZ * Math.exp((mel - MIN_LOG_MEL) * LOG_STEP);
}

// filterbank[mel][freqBin], shape (N_MELS, N_FFT/2 + 1).
export function createMelFilterbank(nFft = N_FFT, nMels = N_MELS, sampleRate = SAMPLE_RATE): Float32Array[] {
  const freqBins = nFft / 2 + 1;
  const fb: Float32Array[] = Array.from({ length: nMels }, () => new Float32Array(freqBins));
  const melMin = hzToMel(0);
  const melMax = hzToMel(sampleRate / 2);
  const melPoints = new Array(nMels + 2);
  for (let i = 0; i < nMels + 2; i++) {
    melPoints[i] = melToHz(melMin + ((melMax - melMin) * i) / (nMels + 1));
  }
  const fftFreqs = new Array(freqBins);
  for (let k = 0; k < freqBins; k++) fftFreqs[k] = (k * sampleRate) / nFft;
  for (let i = 0; i < nMels; i++) {
    const lowDiff = melPoints[i + 1] - melPoints[i];
    const upDiff = melPoints[i + 2] - melPoints[i + 1];
    const enorm = 2.0 / (melPoints[i + 2] - melPoints[i]);
    for (let k = 0; k < freqBins; k++) {
      const lower = (fftFreqs[k] - melPoints[i]) / lowDiff;
      const upper = (melPoints[i + 2] - fftFreqs[k]) / upDiff;
      fb[i][k] = Math.max(0, Math.min(lower, upper)) * enorm;
    }
  }
  return fb;
}

function hannWindow(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}

// In-place iterative radix-2 Cooley-Tukey FFT (N_FFT is a power of two).
function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half;
        const vr = re[b] * cr - im[b] * ci;
        const vi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - vr; im[b] = im[a] - vi;
        re[a] += vr; im[a] += vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

// Linear-interpolation resample. The mic may not honor the requested 16kHz, so
// we resample the captured PCM to SAMPLE_RATE before feature extraction.
export function resampleLinear(input: Float32Array, fromRate: number, toRate = SAMPLE_RATE): Float32Array {
  if (fromRate === toRate || input.length === 0) return input;
  const ratio = fromRate / toRate;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = pos - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

export function applyPreemphasis(audio: Float32Array, coef = PREEMPH): Float32Array {
  if (audio.length === 0) return new Float32Array(0);
  const out = new Float32Array(audio.length);
  out[0] = audio[0];
  for (let i = 1; i < audio.length; i++) out[i] = audio[i] - coef * audio[i - 1];
  return out;
}

export interface MelResult {
  data: Float32Array; // mel-major: data[mel * nFrames + frame], shape (N_MELS, nFrames)
  nMels: number;
  nFrames: number;
}

// Raw log-mel spectrogram (no normalization). `filterbank` is reused across calls.
export function computeLogMel(audio: Float32Array, filterbank: Float32Array[]): MelResult {
  const nMels = filterbank.length;
  if (audio.length === 0) return { data: new Float32Array(0), nMels, nFrames: 0 };

  const pre = applyPreemphasis(audio, PREEMPH);
  const pad = N_FFT / 2;
  const padded = new Float32Array(pre.length + 2 * pad);
  padded.set(pre, pad);

  const window = hannWindow(WIN_LENGTH);
  const freqBins = N_FFT / 2 + 1;
  const nFrames = Math.floor((padded.length - N_FFT) / HOP_LENGTH) + 1;
  if (nFrames <= 0) return { data: new Float32Array(0), nMels, nFrames: 0 };

  const re = new Float32Array(N_FFT);
  const im = new Float32Array(N_FFT);
  const power = new Float32Array(freqBins);
  const data = new Float32Array(nMels * nFrames);

  for (let f = 0; f < nFrames; f++) {
    const start = f * HOP_LENGTH;
    re.fill(0); im.fill(0);
    for (let i = 0; i < WIN_LENGTH; i++) re[i] = padded[start + i] * window[i];
    fft(re, im);
    for (let k = 0; k < freqBins; k++) power[k] = re[k] * re[k] + im[k] * im[k];
    for (let m = 0; m < nMels; m++) {
      const row = filterbank[m];
      let acc = 0;
      for (let k = 0; k < freqBins; k++) acc += row[k] * power[k];
      data[m * nFrames + f] = Math.log(acc + LOG_ZERO_GUARD);
    }
  }
  return { data, nMels, nFrames };
}
