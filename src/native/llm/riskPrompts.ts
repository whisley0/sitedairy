import { VLM_MAX_PREDICT_TOKENS } from './vlmPerformance';
import type { VlmModelId } from './modelManager';
import { formatInspectionType, formatDomainLabelEn, formatSubjectLabelEn, INSPECTION_TYPE_LABELS, resolveInspectionTypeCode } from '../../utils/photoTags';

export interface RiskPromptInput {
  domain: string;
  subject: string;
  labelHint: string;
  userComment?: string;
}

/** Models with weaker reasoning — use explicit question steps and more output tokens. */
const SMALL_VLM_IDS = new Set<VlmModelId>(['smolvlm-500m']);

/** Describe keys only — never put copyable placeholder values like "short title". */
const JSON_KEYS =
  'JSON keys: risk (concrete defect name from the photo), confidence (0 to 1), rationale_en, rationale_zh.';

/**
 * Room for a full hierarchical EN + ZH rationale (cause + fix).
 * Truncation previously cut answers mid-sentence and made them look abrupt.
 */
const SMALL_VLM_MAX_PREDICT_TOKENS = 384;

/** Typical domain scope under each inspection-type umbrella (from site classifier). */
const INSPECTION_UMBRELLAS: Record<string, string> = {
  bpd:
    'BPD report typically checks ceiling, flooring, paint, waterproofing, and housekeeping. ' +
    'Domain must sit under that BPD scope; subject must sit under the chosen domain.',
  bel:
    'BEL report typically checks building electrical works (boards, cabling, outlets, containment, temporary power). ' +
    'Domain must sit under electrical / MEP electrical; subject must sit under that domain.',
  bme:
    'BME report typically checks building services mechanical & electrical (MEP plant, pipework, HVAC, shared services). ' +
    'Domain must sit under MEP / services; subject must sit under that domain.',
  fac:
    'FAC report typically checks facade, cladding, external openings, and related weather/waterproof interfaces. ' +
    'Domain must sit under facade / external envelope; subject must sit under that domain.',
  elv:
    'ELV report typically checks extra-low-voltage systems (data, CCTV, access control, fire alarm low-voltage). ' +
    'Domain must sit under ELV / related MEP; subject must sit under that domain.',
};

export function isSmallVlmModel(modelId: VlmModelId): boolean {
  return SMALL_VLM_IDS.has(modelId);
}

export function maxPredictTokensForModel(modelId: VlmModelId): number {
  return isSmallVlmModel(modelId) ? SMALL_VLM_MAX_PREDICT_TOKENS : VLM_MAX_PREDICT_TOKENS;
}

function inspectionCodeFromPrior(labelHint: string): string {
  return resolveInspectionTypeCode(labelHint);
}

function inspectionContext(input: RiskPromptInput): {
  inspectionLabel: string;
  umbrella: string;
  domain: string;
  subject: string;
} {
  const code = inspectionCodeFromPrior(input.labelHint);
  const inspectionLabel =
    formatInspectionType(input.labelHint) ||
    (code ? INSPECTION_TYPE_LABELS[code] : 'site inspection');
  const umbrella =
    (code && INSPECTION_UMBRELLAS[code]) ||
    'Stay inside the stated inspection type. Domain belongs under that type; subject belongs under that domain.';
  return {
    inspectionLabel,
    umbrella,
    domain: formatDomainLabelEn(input.domain) || input.domain.trim() || 'unspecified domain',
    subject: formatSubjectLabelEn(input.subject) || input.subject.trim() || 'unspecified subject',
  };
}

function ignoreDistractorsBlock(): string {
  return (
    'IGNORE photo distractions — do NOT assess or mention:\n' +
    '- watermarks, logos, timestamps, GPS text, date stamps, or app overlays on the image\n' +
    '- camera UI chrome, status bars, borders, or compressed-jpeg artefacts\n' +
    '- unrelated background people or text unless they are the inspection defect\n' +
    'Focus on the construction / finishes / services condition the photo was taken to record.\n'
  );
}

function hierarchyBlock(input: RiskPromptInput): string {
  const ctx = inspectionContext(input);
  const note =
    input.userComment?.trim() ?
      `\nWorker note (use only if the photo supports it): ${input.userComment.trim()}`
    : '';
  return (
    `This photo was taken for a ${ctx.inspectionLabel} inspection report.\n` +
    `${ctx.umbrella}\n` +
    `\n` +
    `Classifier hierarchy for THIS photo (use as the report frame; verify in the image):\n` +
    `1) Inspection type (umbrella): ${ctx.inspectionLabel}\n` +
    `2) Domain (under that umbrella): ${ctx.domain}\n` +
    `3) Subject / issue (under that domain): ${ctx.subject}` +
    note
  );
}

/**
 * Question ladder: hierarchy → evidence → cause → fix.
 * Keeps weak VLMs from collapsing into one speculative sentence or watermark talk.
 */
function smallVlmQuestionLadder(input: RiskPromptInput): string {
  const ctx = inspectionContext(input);
  return (
    'Answer these questions in order (do not print the Q labels in the JSON):\n' +
    `Q1. Confirm this is a ${ctx.inspectionLabel} report photo — what site condition under that umbrella is visible?\n` +
    `Q2. Does the visible domain match "${ctx.domain}" under that inspection type? If the photo clearly shows another domain under the same umbrella, say which.\n` +
    `Q3. What is the subject/issue under that domain (start from "${ctx.subject}" if the photo supports it)?\n` +
    'Q4. What exactly is wrong in the photo (defect, unfinished work, poor housekeeping, missing protection)?\n' +
    'Q5. Why can this cause a quality, safety, or durability issue if left as-is?\n' +
    'Q6. How should the site team fix or control it (practical remedial step)?\n'
  );
}

function systemPromptForModel(modelId: VlmModelId, input: RiskPromptInput): string {
  if (isSmallVlmModel(modelId)) {
    return (
      'You are writing findings for a construction site inspection report.\n' +
      'Reason from the hierarchy: inspection type → domain → subject → defect → consequence → fix.\n' +
      'Do NOT invent whole-building collapse or dramatic failures.\n' +
      'Do NOT write one vague sentence. Do NOT stop mid-thought.\n' +
      '\n' +
      ignoreDistractorsBlock() +
      '\n' +
      smallVlmQuestionLadder(input) +
      '\n' +
      'Then fill ONE complete JSON object:\n' +
      '- risk: concrete defect name from the photo (3–8 words). Never output the words "short title".\n' +
      '- confidence: 0–1 from how clearly the photo shows the defect.\n' +
      '- rationale_en: 4–5 short sentences covering Q1–Q6 (umbrella/domain, subject, defect, why it matters, how to fix).\n' +
      '- rationale_zh: same meaning in Traditional Chinese, also 4–5 short sentences. Finish every sentence.\n' +
      'If priors conflict with the photo, trust the photo but stay inside the inspection-type umbrella.\n' +
      `Output ${JSON_KEYS} No markdown, no Q/A labels.\n` +
      'Never copy template words such as short title, English, or 中文.\n' +
      'Good example: {"risk":"Damp ceiling paint blister","confidence":0.8,' +
      '"rationale_en":"This BPD photo shows a ceiling domain with paint blistering near a wet patch. ' +
      'The subject is a surface/paint finish defect under the ceiling. ' +
      'Blistered paint indicates moisture or incomplete drying. ' +
      'If left, finishes can peel and hide ongoing waterproofing leakage. ' +
      'Dry the area, find and seal the water source, then reprime and repaint.",' +
      '"rationale_zh":"此 BPD 相片顯示天花範圍有漆面起泡及潮濕痕跡。' +
      '主題屬天花油漆／飾面缺陷。' +
      '起泡顯示有水氣或未乾透。' +
      '若不處理，飾面易剝落並可能掩蓋防水滲漏。' +
      '應先弄乾、找出並封堵水源，再補底漆及重髹。"}'
    );
  }

  return (
    'You are writing findings for a construction site inspection report.\n' +
    'Frame the photo under inspection type → domain → subject.\n' +
    'Ignore watermarks, timestamps, logos, and app overlays.\n' +
    'Explain the defect, why it matters, and how to fix it. Keep consequences proportional.\n' +
    `Reply with one complete JSON object only. ${JSON_KEYS} No markdown, no extra text.\n` +
    'Never use placeholder words like short title.'
  );
}

function userTextForModel(
  modelId: VlmModelId,
  input: RiskPromptInput,
  revisionFeedback?: string,
): string {
  const hierarchy = hierarchyBlock(input);
  const revision =
    revisionFeedback?.trim() ?
      `\n\n${revisionFeedback.trim()}\n`
    : '';
  if (isSmallVlmModel(modelId)) {
    const ctx = inspectionContext(input);
    return (
      `${hierarchy}\n\n` +
      ignoreDistractorsBlock() +
      revision +
      '\n' +
      `Write the ${ctx.inspectionLabel} report finding for domain "${ctx.domain}" / subject "${ctx.subject}".\n` +
      'Mentally answer Q1–Q6, then output a COMPLETE JSON object.\n' +
      'rationale_en must include: (1) inspection-type framing, (2) domain, (3) subject defect, (4) why it causes issues, (5) how to fix it.\n' +
      'Do not mention watermarks or overlays. Do not end mid-sentence. Close the JSON properly.'
    );
  }
  return (
    `${hierarchy}\n\n` +
    ignoreDistractorsBlock() +
    revision +
    '\nAssess the inspection finding in this photo.\n' +
    'Cover defect, why it matters, and remedial action. JSON only — complete the object.'
  );
}

export function buildRiskMessages(
  modelId: VlmModelId,
  input: RiskPromptInput,
  imagePath: string,
  revisionFeedback?: string,
) {
  const text = userTextForModel(modelId, input, revisionFeedback);
  // Image first so weak VLMs ground on the scene before reading instructions
  // (reduces fixation on watermark/overlay text).
  const userContent =
    isSmallVlmModel(modelId) ?
      [
        { type: 'image_url' as const, image_url: { url: imagePath } },
        { type: 'text' as const, text },
      ]
    : [
        { type: 'text' as const, text },
        { type: 'image_url' as const, image_url: { url: imagePath } },
      ];

  return [
    { role: 'system' as const, content: systemPromptForModel(modelId, input) },
    {
      role: 'user' as const,
      content: userContent,
    },
  ];
}
