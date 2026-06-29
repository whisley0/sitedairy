// On-device VLM wrapper (vision-language model via llama.rn). Loads a base GGUF +
// its mmproj vision projector, then performs a hybrid risk assessment: it looks at
// the actual site photo AND is given the on-device classifier's structured signals
// (domain / subject / defect label hint) as priors. Output is constrained with a
// JSON schema so the result parses deterministically, with a bilingual rationale.
import { initLlama, type LlamaContext } from 'llama.rn';
import { modelPaths, type VlmModelId } from './modelManager';

export interface RiskInput {
  domain: string;
  subject: string;
  labelHint: string;
  imageUri: string;
}

export interface RiskAssessment {
  risk: string;
  confidence: number; // 0..1
  rationale_en: string;
  rationale_zh: string;
}

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

const SYSTEM_PROMPT =
  'You are a construction site safety and quality inspector. ' +
  'You are shown a single site photo, together with signals from an on-device image ' +
  'classifier (its domain, subject, and a defect label hint) which you may use as ' +
  'priors. Inspect the photo and infer the most likely on-site risk. ' +
  'Respond with strict JSON matching the schema: a short "risk" title, a "confidence" ' +
  'between 0 and 1, and a concise rationale in both English (rationale_en) and ' +
  'Simplified Chinese (rationale_zh).';

export class LocalVLM {
  private constructor(readonly modelId: VlmModelId, private ctx: LlamaContext) {}

  static async create(
    modelId: VlmModelId,
    onProgress?: (progress: number) => void,
  ): Promise<LocalVLM> {
    const { modelPath, mmprojPath } = modelPaths(modelId);
    const ctx = await initLlama(
      { model: modelPath, n_ctx: 4096, n_gpu_layers: 0 },
      onProgress,
    );
    // Load the vision projector so the model can actually see the photo.
    await ctx.initMultimodal({ path: mmprojPath, use_gpu: false });
    return new LocalVLM(modelId, ctx);
  }

  async assess(input: RiskInput): Promise<RiskAssessment> {
    const userText =
      `Classifier signals for this site photo (priors):\n` +
      `- domain: ${input.domain}\n` +
      `- subject: ${input.subject}\n` +
      `- label hint: ${input.labelHint}\n\n` +
      `Look at the photo and assess the most likely risk.`;

    const result = await this.ctx.completion({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: input.imageUri } },
            { type: 'text', text: userText },
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { strict: true, schema: RESPONSE_SCHEMA },
      },
      n_predict: 512,
      temperature: 0.3,
    });

    return parseAssessment(result.text);
  }

  async release(): Promise<void> {
    await this.ctx.release();
  }
}

function parseAssessment(text: string): RiskAssessment {
  // The grammar keeps output to a JSON object, but guard against stray prose.
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  const json = start >= 0 && end > start ? text.slice(start, end + 1) : text;
  const parsed = JSON.parse(json) as Partial<RiskAssessment>;
  return {
    risk: String(parsed.risk ?? 'Unknown'),
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
    rationale_en: String(parsed.rationale_en ?? ''),
    rationale_zh: String(parsed.rationale_zh ?? ''),
  };
}
