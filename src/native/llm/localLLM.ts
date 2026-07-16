// On-device VLM wrapper (vision-language model via llama.rn). Loads a base GGUF +
// its mmproj vision projector, then performs a hybrid risk assessment: it looks at
// the actual site photo AND is given the on-device classifier's structured signals
// (domain / subject / defect label hint) as priors. Output is constrained with a
// JSON schema so the result parses deterministically, with a bilingual rationale.
import * as FileSystem from 'expo-file-system/legacy';
import { initLlama, type LlamaContext } from 'llama.rn';
import { toNativeFileUri } from '../../services/riskPhotoStorage';
import { modelPaths, type VlmModelId } from './modelManager';
import { buildRiskMessages, isSmallVlmModel, maxPredictTokensForModel } from './riskPrompts';
import {
  defaultVlmProfile,
  llamaInitParams,
  multimodalInitParams,
  vlmInferThreads,
  type VlmRuntimeProfile,
} from './vlmPerformance';

export interface RiskInput {
  domain: string;
  subject: string;
  labelHint: string;
  imageUri: string;
  userComment?: string;
}

export interface RiskAssessment {
  risk: string;
  confidence: number; // 0..1
  rationale_en: string;
  rationale_zh: string;
  rawVlmOutput?: string;
}

const STALE_ECHO_RISKS = new Set(['fall hazard', 'site risk', 'site risk noted']);
const STALE_ECHO_RATIONALES = new Set(['unprotected edge.', 'unprotected edge']);
const STALE_ECHO_PATTERNS = [
  /\bunprotect\w*\s+edge\b/i,
  /\bunproduct\w*\s+edge\b/i,
  /\bfall\s+hazard\b/i,
  /\bsite\s+risk\b/i,
];

const NATIVE_TEARDOWN_MS = 800;
const NATIVE_SETTLE_MS = 600;

/** Remember devices where OpenCL/Metal is unavailable to skip a wasted GPU init. */
const runtimeProfileByModel = new Map<string, VlmRuntimeProfile>();

export function resetVlmRuntimeCache(): void {
  runtimeProfileByModel.clear();
}

export async function waitForNativeVlmSettle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, NATIVE_SETTLE_MS));
}

async function safeClearCache(ctx: LlamaContext): Promise<void> {
  try {
    await ctx.clearCache(false);
  } catch {
    // Empty cache before first completion can throw on some backends.
  }
}

export class LocalVLM {
  private constructor(
    readonly modelId: VlmModelId,
    private ctx: LlamaContext,
    private readonly profile: VlmRuntimeProfile,
    private readonly inferThreads: number,
  ) {}

  static async create(
    modelId: VlmModelId,
    onProgress?: (progress: number) => void,
  ): Promise<LocalVLM> {
    const cached = runtimeProfileByModel.get(modelId);
    if (cached) {
      return LocalVLM.createWithProfile(modelId, cached, onProgress);
    }

    const preferred = defaultVlmProfile();
    if (preferred === 'cpu') {
      runtimeProfileByModel.set(modelId, 'cpu');
      return LocalVLM.createWithProfile(modelId, 'cpu', onProgress);
    }

    try {
      const gpuAttempt = await LocalVLM.createWithProfile(modelId, 'gpu', onProgress);
      if (gpuAttempt.ctx.gpu) {
        runtimeProfileByModel.set(modelId, 'gpu');
        return gpuAttempt;
      }
      await gpuAttempt.release();
      logCpuFallback(modelId, gpuAttempt.ctx.reasonNoGPU);
    } catch (e) {
      if (__DEV__) {
        console.warn(`[VLM] GPU init failed for ${modelId}, falling back to CPU:`, e);
      }
    }

    runtimeProfileByModel.set(modelId, 'cpu');
    return LocalVLM.createWithProfile(modelId, 'cpu', onProgress);
  }

  private static async createWithProfile(
    modelId: VlmModelId,
    profile: VlmRuntimeProfile,
    onProgress?: (progress: number) => void,
  ): Promise<LocalVLM> {
    const { modelPath, mmprojPath } = modelPaths(modelId);
    const inferThreads = vlmInferThreads();
    const ctx = await initLlama(
      {
        model: modelPath,
        ...llamaInitParams(profile),
      },
      onProgress,
    );
    const multimodalOk = await ctx.initMultimodal({
      path: mmprojPath,
      ...multimodalInitParams(profile),
    });
    if (!multimodalOk) {
      await ctx.release();
      throw new Error(`Multimodal vision init failed for ${modelId}`);
    }

    return new LocalVLM(modelId, ctx, profile, inferThreads);
  }

  async assess(input: RiskInput): Promise<RiskAssessment> {
    const imagePath = await normalizeImagePath(input.imageUri);
    const messages = buildRiskMessages(this.modelId, input, imagePath);
    const nPredict = maxPredictTokensForModel(this.modelId);
    const lenientStale = isSmallVlmModel(this.modelId);

    const attempts: Array<Parameters<LlamaContext['completion']>[0]> = [
      {
        messages,
        n_predict: nPredict,
        n_threads: this.inferThreads,
        temperature: 0.25,
      },
    ];

    let lastRaw = '';
    for (let i = 0; i < attempts.length; i++) {
      if (i > 0) {
        await safeClearCache(this.ctx);
      }
      try {
        const result = await this.ctx.completion(attempts[i]);
        lastRaw = result.text ?? '';
        const parsed = parseAssessment(lastRaw);
        if (parsed && !isStaleEcho(parsed, input, lenientStale)) {
          return { ...parsed, rawVlmOutput: lastRaw };
        }
      } catch (e) {
        const text = String(e).toLowerCase();
        if (
          text.includes('std::exception') ||
          text.includes('sigsegv') ||
          text.includes('rnllama') ||
          text.includes('out of memory')
        ) {
          throw e;
        }
        if (i === attempts.length - 1) throw e;
      }
    }

    const fallback = fallbackAssessment(lastRaw, input);
    return { ...fallback, rawVlmOutput: lastRaw };
  }

  async release(): Promise<void> {
    const ctx = this.ctx as LlamaContext & { releaseMultimodal?: () => Promise<void> };
    try {
      if (typeof ctx.releaseMultimodal === 'function') {
        await ctx.releaseMultimodal();
      }
    } catch {
      // Ignore multimodal teardown errors.
    }
    try {
      await ctx.release();
    } catch {
      // Ignore native teardown errors.
    }
    await new Promise((resolve) => setTimeout(resolve, NATIVE_TEARDOWN_MS));
  }
}

function logCpuFallback(modelId: VlmModelId, reasonNoGpu?: string) {
  if (!__DEV__) return;
  console.warn(
    `[VLM] Using CPU-optimized path for ${modelId}. ` +
      `reasonNoGPU=${reasonNoGpu ?? 'unknown'}. ` +
      'OpenCL in llama.rn only works on Qualcomm Adreno 700+ (not Google Tensor/Pixel Mali). ' +
      'SmolVLM 500M is Q8_0 — even on Snapdragon, GPU needs Q4_0/Q6_K quants.',
  );
}

function imagePathCandidates(uri: string): string[] {
  const raw = uri?.trim() ?? '';
  if (!raw) return [];
  const noQuery = raw.split(/[?#]/)[0];
  const withScheme =
    noQuery.startsWith('file://') || noQuery.startsWith('content://')
      ? noQuery
      : `file://${noQuery}`;
  const withoutScheme = noQuery.replace(/^file:\/\//, '');
  return [raw, noQuery, withScheme, withoutScheme];
}

async function normalizeImagePath(uri: string): Promise<string> {
  for (const candidate of imagePathCandidates(uri)) {
    try {
      const info = await FileSystem.getInfoAsync(candidate);
      if (info.exists) {
        return toNativeFileUri(candidate);
      }
    } catch {
      // Try next URI variant.
    }
  }
  throw new Error(`Photo file missing: ${uri}`);
}

function extractJsonCandidate(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = trimmed.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return trimmed.slice(start, i + 1);
    }
  }

  return null;
}

function parseConfidence(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 1 && value <= 100) return value / 100;
    return Math.min(1, Math.max(0, value));
  }
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(/%$/, '').trim());
    if (!Number.isNaN(n)) return n > 1 && n <= 100 ? n / 100 : Math.min(1, Math.max(0, n));
  }
  return 0.5;
}

function pickString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseAssessment(text: string): RiskAssessment | null {
  const candidate = extractJsonCandidate(text) ?? text.trim();
  if (!candidate.startsWith('{')) return null;

  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    const risk = pickString(parsed.risk);
    const rationale_en = pickString(parsed.rationale_en);
    const rationale_zh = pickString(parsed.rationale_zh);

    if (!risk && !rationale_en && !rationale_zh) return null;

    return {
      risk: risk || 'Site risk',
      confidence: parseConfidence(parsed.confidence),
      rationale_en: rationale_en || risk || text.trim().slice(0, 500),
      rationale_zh: rationale_zh || rationale_en || '',
    };
  } catch {
    return null;
  }
}

function isStaleEcho(assessment: RiskAssessment, input: RiskInput, lenient = false): boolean {
  const risk = assessment.risk.toLowerCase().trim();
  const rationale = assessment.rationale_en.toLowerCase().trim();
  if (STALE_ECHO_RISKS.has(risk) || STALE_ECHO_RATIONALES.has(rationale)) {
    return true;
  }
  const hasKnownEcho =
    STALE_ECHO_PATTERNS.some((p) => p.test(risk)) || STALE_ECHO_PATTERNS.some((p) => p.test(rationale));
  if (hasKnownEcho && rationale.length < 120) {
    return true;
  }
  if (lenient) {
    return hasKnownEcho && rationale.length < 40;
  }
  const priors = `${input.domain} ${input.subject} ${input.labelHint}`.toLowerCase();
  const mentionsPrior =
    priors.length < 8 ||
    rationale.includes(input.domain.toLowerCase()) ||
    rationale.includes(input.subject.toLowerCase()) ||
    rationale.includes(input.labelHint.toLowerCase());
  return !mentionsPrior && rationale.length < 40;
}

function fallbackAssessment(raw: string, input: RiskInput): RiskAssessment {
  const trimmed = raw.trim();
  const firstLine = trimmed.split(/\r?\n/).find((line) => line.trim())?.trim();
  const firstLineLooksEcho = !!firstLine && STALE_ECHO_PATTERNS.some((p) => p.test(firstLine));
  const riskTitle = firstLine && firstLine.length < 120 && !firstLine.startsWith('{') && !firstLineLooksEcho
    ? firstLine
    : `${input.subject} risk`;

  return {
    risk: riskTitle.slice(0, 120),
    confidence: 0.5,
    rationale_en:
      trimmed.slice(0, 2000) ||
      `Classifier: ${input.domain} / ${input.subject} / ${input.labelHint}. VLM did not return parseable JSON.`,
    rationale_zh: '',
  };
}
