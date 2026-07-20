// Downloads + locates SenseVoice Small (sherpa-onnx int8) on device.
// ~230 MB — too large to ship in the APK, so fetched once into the document dir.
import { Directory, File, Paths } from 'expo-file-system';

const MODEL_DIR_NAME = 'sensevoice-asr';

// Cantonese-focused SenseVoice Small export (zh/en/ja/ko/yue).
export const BASE_URL =
  'https://huggingface.co/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2025-09-09/resolve/main';

export const MODEL_FILES = ['tokens.txt', 'model.int8.onnx'] as const;

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

function toPath(uri: string): string {
  return uri.replace(/^file:\/\//, '');
}

export function isSenseVoiceDownloaded(): boolean {
  return MODEL_FILES.every((name) => fileRef(name).exists);
}

export function senseVoiceModelDirPath(): string {
  return toPath(modelDir().uri);
}

export async function downloadSenseVoiceModel(
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

export function deleteSenseVoiceModel(): void {
  const dir = modelDir();
  if (dir.exists) dir.delete();
}
