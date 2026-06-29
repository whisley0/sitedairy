// Downloads + locates the Nemotron ONNX bundle on device. The models are far too
// large to bundle, so they are fetched at runtime into the app's document dir.
// encoder.onnx references encoder.onnx.data as external data, so both must live
// side-by-side and be loaded by filesystem PATH (not from an in-memory buffer).
import { Directory, File, Paths } from 'expo-file-system';

const MODEL_DIR_NAME = 'nemotron-asr';

// Default source: the ONNX export of nemotron-3.5-asr-streaming-0.6b.
// Override BASE_URL if you host the files elsewhere or use a quantized variant.
export const BASE_URL =
  'https://huggingface.co/altunenes/parakeet-rs/resolve/main/nemotron-3.5-asr-streaming-0.6b-onnx';

// Order matters only for UX; encoder.onnx.data is the heavy one.
export const MODEL_FILES = [
  'tokenizer.model',
  'decoder_joint.onnx',
  'encoder.onnx',
  'encoder.onnx.data',
] as const;

export interface DownloadProgressInfo {
  file: string;
  index: number; // 1-based
  total: number;
  fileFraction: number; // 0..1 for the current file (-1 if size unknown)
}

function modelDir(): Directory {
  return new Directory(Paths.document, MODEL_DIR_NAME);
}

function fileRef(name: string): File {
  return new File(modelDir(), name);
}

// onnxruntime needs a bare filesystem path; expo returns a file:// URI.
function toPath(uri: string): string {
  return uri.replace(/^file:\/\//, '');
}

export function isModelDownloaded(): boolean {
  return MODEL_FILES.every((name) => fileRef(name).exists);
}

export function modelPaths(): { encoderPath: string; decoderPath: string } {
  return {
    encoderPath: toPath(fileRef('encoder.onnx').uri),
    decoderPath: toPath(fileRef('decoder_joint.onnx').uri),
  };
}

export async function readTokenizerBytes(): Promise<Uint8Array> {
  return fileRef('tokenizer.model').bytes();
}

export async function downloadModel(
  onProgress?: (info: DownloadProgressInfo) => void,
): Promise<void> {
  const dir = modelDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });

  for (let i = 0; i < MODEL_FILES.length; i++) {
    const name = MODEL_FILES[i];
    const dest = fileRef(name);
    if (dest.exists) {
      onProgress?.({ file: name, index: i + 1, total: MODEL_FILES.length, fileFraction: 1 });
      continue;
    }

    const task = File.createDownloadTask(`${BASE_URL}/${name}`, dest, {
      onProgress: ({ bytesWritten, totalBytes }) => {
        onProgress?.({
          file: name,
          index: i + 1,
          total: MODEL_FILES.length,
          fileFraction: totalBytes > 0 ? bytesWritten / totalBytes : -1,
        });
      },
    });
    await task.downloadAsync();
  }
}

export function deleteModel(): void {
  const dir = modelDir();
  if (dir.exists) dir.delete();
}
