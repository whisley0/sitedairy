// On-device SigLIP2 vision embeddings via onnxruntime-react-native.
import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import { imageToTensor } from '../cdv/preprocess';
import {
  SIGLIP_EMBED_DIM,
  SIGLIP_IMAGE_SIZE,
  SIGLIP_NORM,
  isSiglipDownloaded,
  siglipModelPath,
} from './modelManager';

function l2Normalize(vec: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i];
  const norm = Math.sqrt(sum) || 1;
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm;
  return out;
}

export class SiglipEmbedder {
  private constructor(private session: InferenceSession) {}

  static async create(): Promise<SiglipEmbedder> {
    if (!isSiglipDownloaded()) {
      throw new Error('SigLIP model is not downloaded');
    }
    const session = await InferenceSession.create(siglipModelPath());
    return new SiglipEmbedder(session);
  }

  async embed(uri: string): Promise<Float32Array> {
    const data = await imageToTensor(uri, SIGLIP_IMAGE_SIZE, SIGLIP_NORM);
    const inputName = this.session.inputNames[0] ?? 'pixel_values';
    const input = new Tensor('float32', data, [1, 3, SIGLIP_IMAGE_SIZE, SIGLIP_IMAGE_SIZE]);
    const results = await this.session.run({ [inputName]: input });

    const poolerName =
      this.session.outputNames.find((name) => /pooler/i.test(name)) ??
      this.session.outputNames[this.session.outputNames.length - 1];
    const raw = results[poolerName].data as Float32Array;
    const flat =
      raw.length === SIGLIP_EMBED_DIM ? raw : raw.subarray(0, SIGLIP_EMBED_DIM);
    return l2Normalize(new Float32Array(flat));
  }

  async release(): Promise<void> {
    const session = this.session as InferenceSession & { release?: () => Promise<void> };
    if (typeof session.release === 'function') {
      await session.release();
    }
  }
}

export function embeddingToArray(vec: Float32Array): number[] {
  return Array.from(vec);
}

export function arrayToEmbedding(values: number[] | undefined): Float32Array | null {
  if (!values || values.length < 8) return null;
  return new Float32Array(values);
}
