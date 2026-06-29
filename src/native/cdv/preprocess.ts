// Turns a captured photo into the exact tensor the ResNet18 classifiers expect:
// resize to size×size, decode the JPEG to raw RGBA, then emit an ImageNet-normalized
// planar CHW Float32 buffer (1×3×size×size).
import * as ImageManipulator from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { decode as decodeJpeg } from 'jpeg-js';

export interface Normalization {
  mean: [number, number, number];
  std: [number, number, number];
}

export async function imageToTensor(
  uri: string,
  size: number,
  norm: Normalization,
): Promise<Float32Array> {
  // Squash to a square size×size (matches the training Resize((size, size))).
  const resized = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: size, height: size } }],
    { compress: 1, format: ImageManipulator.SaveFormat.JPEG },
  );

  const bytes = await new File(resized.uri).bytes();
  const { data, width, height } = decodeJpeg(bytes, { useTArray: true });
  const plane = width * height;
  const out = new Float32Array(3 * plane);
  const { mean, std } = norm;

  // jpeg-js returns interleaved RGBA; lay channels out as separate planes (CHW).
  for (let p = 0; p < plane; p++) {
    const r = data[p * 4] / 255;
    const g = data[p * 4 + 1] / 255;
    const b = data[p * 4 + 2] / 255;
    out[p] = (r - mean[0]) / std[0];
    out[plane + p] = (g - mean[1]) / std[1];
    out[2 * plane + p] = (b - mean[2]) / std[2];
  }
  return out;
}
