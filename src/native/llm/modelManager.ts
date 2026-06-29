// Downloads + locates the on-device vision-language models (VLMs). Each model is a
// pair of GGUF files: the base model + an mmproj vision projector. They are large
// (~2-4GB total each) so they are fetched at runtime into the app's document dir,
// mirroring the Nemotron ASR model manager. The user can install all three and
// pick one in the app to compare their risk assessments.
import { Directory, File, Paths } from 'expo-file-system';

export type VlmModelId = 'qwen2.5-vl-3b' | 'smolvlm2-2.2b' | 'gemma-3-4b';

export interface VlmModelSpec {
  id: VlmModelId;
  name: string;
  approxSize: string; // human-readable total (model + mmproj)
  modelFile: string;
  mmprojFile: string;
  modelUrl: string;
  mmprojUrl: string;
}

const HF = (repo: string, file: string) =>
  `https://huggingface.co/${repo}/resolve/main/${file}`;

export const VLM_MODELS: VlmModelSpec[] = [
  {
    id: 'qwen2.5-vl-3b',
    name: 'Qwen2.5-VL 3B',
    approxSize: '~3.4 GB',
    modelFile: 'Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf',
    mmprojFile: 'mmproj-Qwen2.5-VL-3B-Instruct-f16.gguf',
    modelUrl: HF('ggml-org/Qwen2.5-VL-3B-Instruct-GGUF', 'Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf'),
    mmprojUrl: HF('ggml-org/Qwen2.5-VL-3B-Instruct-GGUF', 'mmproj-Qwen2.5-VL-3B-Instruct-f16.gguf'),
  },
  {
    id: 'smolvlm2-2.2b',
    name: 'SmolVLM2 2.2B',
    approxSize: '~2.1 GB',
    modelFile: 'SmolVLM2-2.2B-Instruct-Q4_K_M.gguf',
    mmprojFile: 'mmproj-SmolVLM2-2.2B-Instruct-f16.gguf',
    modelUrl: HF('ggml-org/SmolVLM2-2.2B-Instruct-GGUF', 'SmolVLM2-2.2B-Instruct-Q4_K_M.gguf'),
    mmprojUrl: HF('ggml-org/SmolVLM2-2.2B-Instruct-GGUF', 'mmproj-SmolVLM2-2.2B-Instruct-f16.gguf'),
  },
  {
    id: 'gemma-3-4b',
    name: 'Gemma 3 4B',
    approxSize: '~3.4 GB',
    modelFile: 'gemma-3-4b-it-Q4_K_M.gguf',
    mmprojFile: 'mmproj-model-f16.gguf',
    modelUrl: HF('ggml-org/gemma-3-4b-it-GGUF', 'gemma-3-4b-it-Q4_K_M.gguf'),
    mmprojUrl: HF('ggml-org/gemma-3-4b-it-GGUF', 'mmproj-model-f16.gguf'),
  },
];

export function getModelSpec(id: VlmModelId): VlmModelSpec {
  const spec = VLM_MODELS.find((m) => m.id === id);
  if (!spec) throw new Error(`Unknown VLM model id: ${id}`);
  return spec;
}

export interface DownloadProgressInfo {
  file: string;
  index: number; // 1-based (1 = base model, 2 = mmproj)
  total: number; // 2
  fileFraction: number; // 0..1 (-1 if size unknown)
}

function modelDir(id: VlmModelId): Directory {
  return new Directory(Paths.document, 'vlm', id);
}

function fileRef(id: VlmModelId, name: string): File {
  return new File(modelDir(id), name);
}

// llama.rn normalizes file:// itself, so the raw URI is fine to hand to initLlama.
export function modelPaths(id: VlmModelId): { modelPath: string; mmprojPath: string } {
  const spec = getModelSpec(id);
  return {
    modelPath: fileRef(id, spec.modelFile).uri,
    mmprojPath: fileRef(id, spec.mmprojFile).uri,
  };
}

export function isModelDownloaded(id: VlmModelId): boolean {
  const spec = getModelSpec(id);
  return fileRef(id, spec.modelFile).exists && fileRef(id, spec.mmprojFile).exists;
}

export async function downloadModel(
  id: VlmModelId,
  onProgress?: (info: DownloadProgressInfo) => void,
): Promise<void> {
  const spec = getModelSpec(id);
  const dir = modelDir(id);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });

  const parts = [
    { name: spec.modelFile, url: spec.modelUrl },
    { name: spec.mmprojFile, url: spec.mmprojUrl },
  ];

  for (let i = 0; i < parts.length; i++) {
    const { name, url } = parts[i];
    const dest = fileRef(id, name);
    if (dest.exists) {
      onProgress?.({ file: name, index: i + 1, total: parts.length, fileFraction: 1 });
      continue;
    }
    const task = File.createDownloadTask(url, dest, {
      onProgress: ({ bytesWritten, totalBytes }) => {
        onProgress?.({
          file: name,
          index: i + 1,
          total: parts.length,
          fileFraction: totalBytes > 0 ? bytesWritten / totalBytes : -1,
        });
      },
    });
    await task.downloadAsync();
  }
}

export function deleteModel(id: VlmModelId): void {
  const dir = modelDir(id);
  if (dir.exists) dir.delete();
}
