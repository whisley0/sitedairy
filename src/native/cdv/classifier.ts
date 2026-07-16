// On-device CDV image classifier. Runs the three ResNet18 ONNX heads
// (domain, subject, label_hint) bundled as Metro assets and returns per-head
// predictions sorted by score. domain/subject are multilabel (sigmoid),
// label_hint is multiclass (softmax).
import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import { Asset } from 'expo-asset';
import labelsJson from '../../../assets/model/onnx/labels.json';
import { imageToTensor, type Normalization } from './preprocess';

export type HeadName = 'domain' | 'subject' | 'label_hint';

interface HeadMeta {
  file: string;
  mode: 'multilabel' | 'multiclass';
  classes: string[];
  image_size: number;
  mean: [number, number, number];
  std: [number, number, number];
}

const labels = labelsJson as Record<HeadName, HeadMeta>;
const HEADS: HeadName[] = ['domain', 'subject', 'label_hint'];

// require() returns a Metro asset module id once .onnx is in resolver.assetExts.
const MODEL_MODULES: Record<HeadName, number> = {
  domain: require('../../../assets/model/onnx/domain.onnx'),
  subject: require('../../../assets/model/onnx/subject.onnx'),
  label_hint: require('../../../assets/model/onnx/label_hint.onnx'),
};

export interface Prediction {
  label: string;
  score: number;
}

export type ClassifierOutput = Record<HeadName, Prediction[]>;

function sigmoid(logits: Float32Array): Float32Array {
  const out = new Float32Array(logits.length);
  for (let i = 0; i < logits.length; i++) out[i] = 1 / (1 + Math.exp(-logits[i]));
  return out;
}

function softmax(logits: Float32Array): Float32Array {
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) if (logits[i] > max) max = logits[i];
  const out = new Float32Array(logits.length);
  let sum = 0;
  for (let i = 0; i < logits.length; i++) {
    out[i] = Math.exp(logits[i] - max);
    sum += out[i];
  }
  for (let i = 0; i < logits.length; i++) out[i] /= sum;
  return out;
}

export class Classifier {
  private constructor(private sessions: Record<HeadName, InferenceSession>) {}

  static async create(): Promise<Classifier> {
    const sessions = {} as Record<HeadName, InferenceSession>;
    for (const head of HEADS) {
      const asset = Asset.fromModule(MODEL_MODULES[head]);
      if (!asset.downloaded) await asset.downloadAsync();
      const path = (asset.localUri ?? asset.uri).replace(/^file:\/\//, '');
      sessions[head] = await InferenceSession.create(path);
    }
    return new Classifier(sessions);
  }

  async classify(uri: string): Promise<ClassifierOutput> {
    // All three heads share the same input size + normalization, so preprocess
    // the photo once and feed the same tensor to each session.
    const base = labels.domain;
    const size = base.image_size;
    const norm: Normalization = { mean: base.mean, std: base.std };
    const tensorData = await imageToTensor(uri, size, norm);

    const out = {} as ClassifierOutput;
    for (const head of HEADS) {
      const meta = labels[head];
      const session = this.sessions[head];
      const input = new Tensor('float32', tensorData, [1, 3, size, size]);
      const results = await session.run({ [session.inputNames[0]]: input });
      const logits = results[session.outputNames[0]].data as Float32Array;
      const probs = meta.mode === 'multilabel' ? sigmoid(logits) : softmax(logits);
      out[head] = meta.classes
        .map((label, i) => ({ label, score: probs[i] }))
        .sort((a, b) => b.score - a.score);
    }
    return out;
  }

  async release(): Promise<void> {
    for (const head of HEADS) {
      const session = this.sessions[head] as InferenceSession & { release?: () => Promise<void> };
      if (typeof session.release === 'function') {
        await session.release();
      }
    }
  }
}
