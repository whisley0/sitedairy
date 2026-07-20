import { formatInspectionType } from '../../utils/photoTags';
import type { VlmModelId } from './modelManager';
import { isSmallVlmModel } from './riskPrompts';

export interface QualityRiskAssessment {
  risk: string;
  confidence: number;
  rationale_en: string;
  rationale_zh: string;
}

export interface QualityRiskInput {
  domain: string;
  subject: string;
  labelHint: string;
}

export interface QualityGateResult {
  ok: boolean;
  score: number;
  issues: string[];
}

export interface QualityReviewResult {
  quality_ok: boolean;
  issues: string[];
  raw?: string;
}

const DISTRACTOR_RE =
  /\b(watermark|time\s*stamp|timestamp|date\s*stamp|logo|overlay|status\s*bar|camera\s*ui|gps\s*text|exif)\b/i;

const FIX_RE =
  /\b(fix|repair|seal|clean|install|replace|remove|rectify|remed|make\s*good|reprime|repaint|barrier|cap|protect|dry|divert)\b/i;

const CAUSE_RE =
  /\b(cause|lead|could|may|risk|damage|leak|hazard|defect|if\s+left|peel|collapse|injur|slip|strike|corrod|moisture|damp)\b/i;

const STALE_RISKS = new Set([
  'fall hazard',
  'site risk',
  'site risk noted',
  'short title',
  'title',
  'risk',
  'defect',
  'english',
  '中文',
]);

const PLACEHOLDER_RE =
  /^(short\s*title|title|risk(\s*title)?|english|中文|n\/?a|none|null|undefined|todo|tbd)$/i;

/** True when the model echoed schema placeholders instead of a real finding. */
export function isPlaceholderAssessment(assessment: QualityRiskAssessment): boolean {
  const risk = assessment.risk.trim();
  const en = assessment.rationale_en.trim();
  const zh = assessment.rationale_zh.trim();
  if (PLACEHOLDER_RE.test(risk) || STALE_RISKS.has(risk.toLowerCase())) return true;
  if (PLACEHOLDER_RE.test(en) || /^english$/i.test(en)) return true;
  if (PLACEHOLDER_RE.test(zh) || zh === '中文') return true;
  if (/short\s*title/i.test(`${risk} ${en}`)) return true;
  // Single tiny title with almost no rationale = schema echo collapse.
  if (risk.length <= 16 && en.length < 40) return true;
  return false;
}

/** Max generate → rewrite cycles. */
export const VLM_QUALITY_MAX_ATTEMPTS = 3;

/** Short token budget for the yes/no quality review pass. */
export const VLM_QUALITY_REVIEW_MAX_TOKENS = 96;

function sentenceCount(text: string): number {
  return text
    .split(/[.!?。！？]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 12).length;
}

function endsCleanly(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return /[.!?。！？)"\]]$/u.test(trimmed);
}

/**
 * Lightweight deterministic quality gate.
 * Rejects placeholders, watermark talk, one-liners, missing cause/fix, truncation.
 */
export function evaluateAssessmentQuality(
  assessment: QualityRiskAssessment,
  input: QualityRiskInput,
): QualityGateResult {
  const issues: string[] = [];
  let score = 100;

  const risk = assessment.risk.trim();
  const en = assessment.rationale_en.trim();
  const zh = assessment.rationale_zh.trim();
  const blob = `${risk}\n${en}\n${zh}`;

  if (isPlaceholderAssessment(assessment)) {
    issues.push(
      'do not copy schema placeholders — risk must be a real defect name from the photo (not "short title")',
    );
    return { ok: false, score: 0, issues };
  }

  if (!risk || risk.length < 3) {
    issues.push('risk title is missing or too short');
    score -= 25;
  }
  if (STALE_RISKS.has(risk.toLowerCase())) {
    issues.push('risk title looks like a stale template echo');
    score -= 30;
  }
  if (DISTRACTOR_RE.test(blob)) {
    issues.push('mentions watermark/timestamp/logo/overlay instead of the site defect');
    score -= 40;
  }
  if (en.length < 140) {
    issues.push('rationale_en is too short — need defect, why it matters, and how to fix');
    score -= 25;
  }
  if (sentenceCount(en) < 3) {
    issues.push('rationale_en needs at least 3 complete sentences');
    score -= 20;
  }
  if (!endsCleanly(en)) {
    issues.push('rationale_en looks truncated (does not end with a full sentence)');
    score -= 20;
  }
  if (!CAUSE_RE.test(en)) {
    issues.push('rationale_en must explain why the issue can cause problems');
    score -= 15;
  }
  if (!FIX_RE.test(en)) {
    issues.push('rationale_en must include a practical fix / remedial action');
    score -= 15;
  }

  const inspection = formatInspectionType(input.labelHint).toLowerCase();
  const domain = input.domain.trim().toLowerCase();
  const subject = input.subject.trim().toLowerCase();
  const enLower = en.toLowerCase();
  const mentionsHierarchy =
    (!domain || enLower.includes(domain) || risk.toLowerCase().includes(domain)) ||
    (!subject || enLower.includes(subject) || risk.toLowerCase().includes(subject)) ||
    (!inspection || enLower.includes(inspection.split('—')[0]?.trim() ?? ''));

  if (!mentionsHierarchy && en.length < 220) {
    issues.push('tie the finding to the inspection type / domain / subject hierarchy');
    score -= 10;
  }

  if (zh && zh.length < 40) {
    issues.push('rationale_zh is too short');
    score -= 10;
  }
  if (zh && !endsCleanly(zh)) {
    issues.push('rationale_zh looks truncated');
    score -= 10;
  }

  score = Math.max(0, score);
  return {
    ok: issues.length === 0 && score >= 70,
    score,
    issues,
  };
}

export function buildQualityReviewMessages(
  modelId: VlmModelId,
  input: QualityRiskInput,
  assessment: QualityRiskAssessment,
  imagePath: string,
) {
  const draft = JSON.stringify({
    risk: assessment.risk,
    confidence: assessment.confidence,
    rationale_en: assessment.rationale_en,
    rationale_zh: assessment.rationale_zh,
  });

  const system =
    'You are a strict QA checker for construction inspection reports.\n' +
    'Decide if the draft finding is good enough to save.\n' +
    'quality_ok=true ONLY if ALL are true:\n' +
    '1) Focuses on a real site defect under the inspection type/domain/subject (not watermark/timestamp/logo).\n' +
    '2) Explains why the issue matters.\n' +
    '3) Gives a practical fix.\n' +
    '4) Rationale is complete (not cut off mid-sentence).\n' +
    '5) risk is a real defect name — NEVER accept placeholders like "short title", "English", or "中文".\n' +
    'Reply with ONE JSON object only: {"quality_ok":true,"issues":[]} or {"quality_ok":false,"issues":["short reason"]}';

  const userText =
    `Inspection type: ${formatInspectionType(input.labelHint)}\n` +
    `Domain: ${input.domain}\n` +
    `Subject: ${input.subject}\n\n` +
    `Draft JSON:\n${draft}\n\n` +
    'Look at the photo and judge the draft. JSON only.';

  const content =
    isSmallVlmModel(modelId) ?
      [
        { type: 'image_url' as const, image_url: { url: imagePath } },
        { type: 'text' as const, text: userText },
      ]
    : [
        { type: 'text' as const, text: userText },
        { type: 'image_url' as const, image_url: { url: imagePath } },
      ];

  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content },
  ];
}

export function parseQualityReview(text: string): QualityReviewResult {
  const trimmed = text.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return { quality_ok: false, issues: ['quality review did not return JSON'], raw: text };
  }
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as {
      quality_ok?: unknown;
      qualityOk?: unknown;
      ok?: unknown;
      issues?: unknown;
      reason?: unknown;
    };
    const ok = Boolean(parsed.quality_ok ?? parsed.qualityOk ?? parsed.ok);
    const issues: string[] = [];
    if (Array.isArray(parsed.issues)) {
      for (const item of parsed.issues) {
        if (typeof item === 'string' && item.trim()) issues.push(item.trim());
      }
    } else if (typeof parsed.reason === 'string' && parsed.reason.trim()) {
      issues.push(parsed.reason.trim());
    }
    if (!ok && issues.length === 0) {
      issues.push('VLM rejected draft without listing issues');
    }
    return { quality_ok: ok, issues, raw: text };
  } catch {
    return { quality_ok: false, issues: ['quality review JSON parse failed'], raw: text };
  }
}

export function revisionFeedbackText(issues: string[]): string {
  const list = issues.length ? issues.map((issue, i) => `${i + 1}) ${issue}`).join('\n') : '1) Improve completeness';
  return (
    'PREVIOUS DRAFT FAILED QUALITY CHECK. Rewrite a COMPLETE better JSON finding.\n' +
    'Fix these issues:\n' +
    `${list}\n` +
    'Do NOT mention watermarks/overlays. Do NOT use placeholders like "short title". ' +
    'Include defect, why it matters, and how to fix. Finish every sentence.'
  );
}
