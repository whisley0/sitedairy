import { NativeModules } from 'react-native';

type GeminiNanoNativeModule = {
  checkStatus: () => Promise<{ status: number; available: boolean; downloadable: boolean }>;
  assessRisk: (
    imagePath: string,
    domain: string,
    subject: string,
    labelHint: string,
  ) => Promise<{ text: string }>;
};

const moduleRef = NativeModules.GeminiNano as GeminiNanoNativeModule | undefined;

export function hasGeminiNanoNativeModule(): boolean {
  return Boolean(moduleRef);
}

export async function checkGeminiNanoStatus() {
  if (!moduleRef) return { status: -1, available: false, downloadable: false };
  return moduleRef.checkStatus();
}

export async function assessRiskWithGeminiNanoNative(
  imagePath: string,
  domain: string,
  subject: string,
  labelHint: string,
): Promise<string> {
  if (!moduleRef) {
    throw new Error('Gemini Nano native module is not available.');
  }
  const result = await moduleRef.assessRisk(imagePath, domain, subject, labelHint);
  return result.text ?? '';
}

