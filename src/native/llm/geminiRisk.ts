import * as FileSystem from 'expo-file-system/legacy';
import { getAI, getGenerativeModel, VertexAIBackend } from 'firebase/ai';
import { firebaseApp } from '../../config/firebase';
import {
  assessRiskWithGeminiNanoNative,
  checkGeminiNanoStatus,
  hasGeminiNanoNativeModule,
} from '../GeminiNanoNative';
import type { RiskAssessment, RiskInput } from './localLLM';

const VERTEX_ATTEMPTS = [
  { location: 'asia-southeast1', model: 'gemini-2.5-flash' },
  { location: 'us-central1', model: 'gemini-2.5-flash' },
] as const;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    risk: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    rationale_en: { type: 'string' },
    rationale_zh: { type: 'string' },
  },
  required: ['risk', 'confidence', 'rationale_en', 'rationale_zh'],
} as const;

let activeConfig: (typeof VERTEX_ATTEMPTS)[number] | null = null;
let generativeModel: ReturnType<typeof getGenerativeModel> | null = null;

function getCloudModel(config: (typeof VERTEX_ATTEMPTS)[number]) {
  if (
    activeConfig?.location !== config.location ||
    activeConfig?.model !== config.model ||
    !generativeModel
  ) {
    const ai = getAI(firebaseApp, { backend: new VertexAIBackend(config.location) });
    generativeModel = getGenerativeModel(ai, { model: config.model });
    activeConfig = config;
  }
  return generativeModel;
}

function parseAssessment(text: string): RiskAssessment | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as Partial<RiskAssessment>;
    if (!parsed.risk || !parsed.rationale_en) return null;
    return {
      risk: parsed.risk,
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
      rationale_en: parsed.rationale_en,
      rationale_zh: parsed.rationale_zh ?? '',
      rawVlmOutput: text,
    };
  } catch {
    return null;
  }
}

export async function assessRiskWithGeminiCloud(input: RiskInput): Promise<RiskAssessment> {
  const imageBase64 = await FileSystem.readAsStringAsync(input.imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const noteLine =
    input.userComment?.trim() ?
      `\nWorker note to consider: ${input.userComment.trim()}`
    : '';
  const prompt =
    `You are a construction site safety and quality inspector.\n` +
    `Classifier priors:\n` +
    `- domain: ${input.domain}\n` +
    `- subject: ${input.subject}\n` +
    `- label hint: ${input.labelHint}` +
    noteLine +
    `\n\n` +
    `Inspect this image and return one JSON object only with this schema:\n` +
    `${JSON.stringify(RESPONSE_SCHEMA)}\n` +
    `No markdown, no extra text.`;

  let lastError = 'Gemini risk assessment failed.';

  for (const config of VERTEX_ATTEMPTS) {
    try {
      const result = await getCloudModel(config).generateContent([
        { text: prompt },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageBase64,
          },
        },
      ]);
      const text = result.response.text();
      const parsed = parseAssessment(text);
      if (parsed) return parsed;
      return {
        risk: `${input.subject} risk`,
        confidence: 0.5,
        rationale_en: text.trim().slice(0, 1200) || 'Gemini returned an empty response.',
        rationale_zh: '',
        rawVlmOutput: text,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(lastError);
}

export async function assessRiskWithGeminiNanoOrCloud(input: RiskInput): Promise<RiskAssessment> {
  if (!hasGeminiNanoNativeModule()) {
    throw new Error('Gemini Nano native module is not available in this build.');
  }

  const status = await checkGeminiNanoStatus();
  if (!status.available) {
    throw new Error(
      `Gemini Nano is not available on this device yet (status=${status.status}). ` +
        'Please ensure AICore is installed/updated and try again.',
    );
  }

  const text = await assessRiskWithGeminiNanoNative(
    input.imageUri,
    input.domain,
    input.subject,
    input.userComment?.trim() ?
      `${input.labelHint}\nWorker note: ${input.userComment.trim()}`
    : input.labelHint,
  );
  const parsed = parseAssessment(text);
  if (parsed) return parsed;
  return {
    risk: `${input.subject} risk`,
    confidence: 0.5,
    rationale_en: text.trim().slice(0, 1200) || 'Gemini Nano returned an empty response.',
    rationale_zh: '',
    rawVlmOutput: text,
  };
}

