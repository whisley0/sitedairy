// Downloads SigLIP2 vision encoder (INT8 ONNX) for on-device image embeddings.
import { Directory, File, Paths } from 'expo-file-system';

const MODEL_DIR_NAME = 'siglip2-vision';
const MODEL_FILE = 'vision_model_int8.onnx';

export const SIGLIP_BASE_URL =
  'https://huggingface.co/onnx-community/siglip2-base-patch16-224-ONNX/resolve/main/onnx';

export const SIGLIP_IMAGE_SIZE = 224;
export const SIGLIP_EMBED_DIM = 768;
export const SIGLIP_NORM = {
  mean: [0.5, 0.5, 0.5] as [number, number, number],
  std: [0.5, 0.5, 0.5] as [number, number, number],
};

export interface DownloadProgressInfo {
  file: string;
  index: number;
  total: number;
  fileFraction: number;
}

function modelDir(): Directory {
  return new Directory(Paths.document, MODEL_DIR_NAME);
}

function fileRef(): File {
  return new File(modelDir(), MODEL_FILE);
}

function toPath(uri: string): string {
  return uri.replace(/^file:\/\//, '');
}

export function isSiglipDownloaded(): boolean {
  return fileRef().exists;
}

export function siglipModelPath(): string {
  return toPath(fileRef().uri);
}

export async function downloadSiglipModel(
  onProgress?: (info: DownloadProgressInfo) => void,
): Promise<void> {
  const dir = modelDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });

  const dest = fileRef();
  if (dest.exists) {
    onProgress?.({ file: MODEL_FILE, index: 1, total: 1, fileFraction: 1 });
    return;
  }

  const task = File.createDownloadTask(`${SIGLIP_BASE_URL}/${MODEL_FILE}`, dest, {
    onProgress: ({ bytesWritten, totalBytes }) => {
      onProgress?.({
        file: MODEL_FILE,
        index: 1,
        total: 1,
        fileFraction: totalBytes > 0 ? bytesWritten / totalBytes : -1,
      });
    },
  });
  await task.downloadAsync();
}

export function deleteSiglipModel(): void {
  const dir = modelDir();
  if (dir.exists) dir.delete();
}
