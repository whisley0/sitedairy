import { VLM_MAX_PREDICT_TOKENS } from './vlmPerformance';
import type { VlmModelId } from './modelManager';

export interface RiskPromptInput {
  domain: string;
  subject: string;
  labelHint: string;
  userComment?: string;
}

/** Models with weaker reasoning — use explicit steps and examples. */
const SMALL_VLM_IDS = new Set<VlmModelId>(['smolvlm-500m']);

const JSON_SHAPE =
  '{"risk":"short title","confidence":0.0,"rationale_en":"English","rationale_zh":"中文"}';

export function isSmallVlmModel(modelId: VlmModelId): boolean {
  return SMALL_VLM_IDS.has(modelId);
}

export function maxPredictTokensForModel(modelId: VlmModelId): number {
  return isSmallVlmModel(modelId) ? 128 : VLM_MAX_PREDICT_TOKENS;
}

function priorsBlock(input: RiskPromptInput): string {
  const note =
    input.userComment?.trim() ?
      `\n- worker note: ${input.userComment.trim()}`
    : '';
  return (
    `Classifier priors:\n` +
    `- domain: ${input.domain}\n` +
    `- subject: ${input.subject}\n` +
    `- label hint: ${input.labelHint}` +
    note
  );
}

function systemPromptForModel(modelId: VlmModelId): string {
  if (isSmallVlmModel(modelId)) {
    return (
      'You are a construction site safety and quality inspector.\n' +
      'You receive a site photo plus classifier priors (domain, subject, label hint).\n' +
      'Follow these steps:\n' +
      '1) Study the photo — note people, PPE, edges, materials, housekeeping, electrical, lifting.\n' +
      '2) Read the priors; treat them as hints, not facts.\n' +
      '3) If priors conflict with the image, trust what you see.\n' +
      '4) Name the single most important hazard or defect.\n' +
      '5) If a worker note is provided, factor it in but verify against the photo.\n' +
      '6) Explain in English and Traditional Chinese with visible evidence (objects, location, missing protection).\n' +
      `Reply with ONE JSON object only (no markdown, no extra text): ${JSON_SHAPE}\n` +
      'Example: {"risk":"Uncapped rebar","confidence":0.82,"rationale_en":"Rebar ends protrude at walkway level without caps or barriers.","rationale_zh":"行人路旁有未封套外露鋼筋，未設圍欄。"}'
    );
  }

  return (
    'You are a construction site safety and quality inspector.\n' +
    'You receive a site photo and classifier priors (domain, subject, label hint).\n' +
    'Inspect the image, reconcile priors with what is visible, and assess the main risk.\n' +
    'If a worker note is provided, consider it but verify against the photo.\n' +
    `Reply with one JSON object only: ${JSON_SHAPE}. No markdown, no extra text.`
  );
}

function userTextForModel(modelId: VlmModelId, input: RiskPromptInput): string {
  const priors = priorsBlock(input);
  if (isSmallVlmModel(modelId)) {
    return (
      `${priors}\n\n` +
      'Using the photo and priors above, identify the specific risk.\n' +
      'In rationale_en and rationale_zh, cite concrete visible details from the image.'
    );
  }
  return `${priors}\n\nAssess the specific risk in this photo. JSON only.`;
}

export function buildRiskMessages(
  modelId: VlmModelId,
  input: RiskPromptInput,
  imagePath: string,
) {
  return [
    { role: 'system' as const, content: systemPromptForModel(modelId) },
    {
      role: 'user' as const,
      content: [
        { type: 'text' as const, text: userTextForModel(modelId, input) },
        { type: 'image_url' as const, image_url: { url: imagePath } },
      ],
    },
  ];
}
