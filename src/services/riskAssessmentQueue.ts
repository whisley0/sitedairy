import * as FileSystem from 'expo-file-system/legacy';
import type {
  EnqueueRiskAssessmentInput,
  ReassessRiskAssessmentInput,
  RiskAssessmentRecord,
  RiskAssessmentResult,
  RiskQueueItem,
} from '../data/models';
import { latestAssessmentRecord, MANUAL_MODEL_ID } from '../data/models';
import { Classifier, type ClassifierOutput, type HeadName } from '../native/cdv/classifier';
import { assessRiskWithGeminiNanoOrCloud } from '../native/llm/geminiRisk';
import { LocalVLM, resetVlmRuntimeCache, waitForNativeVlmSettle, type RiskInput } from '../native/llm/localLLM';
import type { VlmModelId } from '../native/llm/modelManager';
import { getModelSpec } from '../native/llm/modelManager';
import { deleteRiskPhoto, persistRiskPhoto, resolvePhotoForVlm, resolveRiskPhotoUri } from './riskPhotoStorage';

export type RemoveQueueItemResult = 'ok' | 'not_found' | 'processing';
export type QueuePhase = 'idle' | 'classifying' | 'assessing';

type Listener = () => void;

const QUEUE_DIR = `${FileSystem.documentDirectory}risk-queue/`;
const QUEUE_FILE = `${QUEUE_DIR}items.json`;

const INTERRUPTED_ERROR =
  'Assessment was interrupted (app closed or VLM crashed). Stop and delete this item, or Re-assess manually.';

class AssessmentHaltedError extends Error {
  constructor(message = 'Assessment halted.') {
    super(message);
    this.name = 'AssessmentHaltedError';
  }
}

const topLabel = (out: ClassifierOutput, head: HeadName) => out[head][0].label;

function isNativeVlmFailure(error: unknown): boolean {
  const text = String(error).toLowerCase();
  return (
    text.includes('std::exception') ||
    text.includes('sigsegv') ||
    text.includes('photo file missing') ||
    text.includes('llama') ||
    text.includes('rnllama')
  );
}

function migrateItem(raw: RiskQueueItem & { assessment?: import('../data/models').RiskAssessmentResult }): RiskQueueItem {
  if (Array.isArray(raw.assessmentHistory)) {
    return {
      ...raw,
      assessmentHistory: raw.assessmentHistory.map((record) => ({
        ...record,
        modelId: record.modelId ?? raw.modelId,
        modelName: record.modelName ?? raw.modelName,
      })),
    };
  }
  const history: RiskAssessmentRecord[] = [];
  const legacy = (raw as { assessment?: RiskAssessmentRecord['result'] }).assessment;
  if (legacy) {
    history.push({
      id: `run-${raw.id}-legacy`,
      startedAt: raw.createdAt,
      completedAt: raw.createdAt,
      durationMs: 0,
      modelId: raw.modelId,
      modelName: raw.modelName,
      domain: raw.domain,
      subject: raw.subject,
      labelHint: raw.labelHint,
      result: legacy,
    });
  }
  const { assessment: _removed, ...rest } = raw as RiskQueueItem & { assessment?: unknown };
  return { ...rest, assessmentHistory: history };
}

function normalizeHydratedItem(item: RiskQueueItem): RiskQueueItem {
  if (item.status !== 'processing') return item;
  return {
    ...item,
    status: 'failed',
    processingStartedAt: undefined,
    error: item.error ?? INTERRUPTED_ERROR,
    halted: item.halted ?? isNativeVlmFailure(item.error),
  };
}

async function reconcileRiskPhoto(item: RiskQueueItem): Promise<RiskQueueItem> {
  const resolved = await resolveRiskPhotoUri(item.id, item.photoUri);
  if (resolved.missing) {
    return { ...item, photoMissing: true };
  }
  return {
    ...item,
    photoUri: resolved.uri,
    photoMissing: false,
  };
}

function pickNextPending(items: RiskQueueItem[]): RiskQueueItem | undefined {
  return [...items]
    .filter((item) => item.status === 'pending' && !item.halted && item.mode !== 'manual')
    .sort((a, b) => {
      if (a.reassessRequestedAt && !b.reassessRequestedAt) return -1;
      if (!a.reassessRequestedAt && b.reassessRequestedAt) return 1;
      const aTime = a.reassessRequestedAt ?? a.createdAt;
      const bTime = b.reassessRequestedAt ?? b.createdAt;
      return new Date(aTime).getTime() - new Date(bTime).getTime();
    })[0];
}

function classifierPriors(
  item: RiskQueueItem,
): { domain: string; subject: string; labelHint: string } | undefined {
  if (item.domain && item.subject && item.labelHint) {
    return { domain: item.domain, subject: item.subject, labelHint: item.labelHint };
  }
  const latest = latestAssessmentRecord(item);
  if (latest?.domain && latest?.subject && latest?.labelHint) {
    return {
      domain: latest.domain,
      subject: latest.subject,
      labelHint: latest.labelHint,
    };
  }
  return undefined;
}

function shouldSkipClassifier(item: RiskQueueItem): boolean {
  return Boolean(item.reassessRequestedAt && classifierPriors(item));
}

function manualResultFromComment(comment: string): RiskAssessmentResult {
  const trimmed = comment.trim();
  const firstLine = trimmed.split(/\r?\n/).find((line) => line.trim())?.trim() ?? '';
  return {
    risk: firstLine.slice(0, 80) || 'Site diary entry',
    confidence: 1,
    rationale_en: trimmed,
    rationale_zh: '',
  };
}

class RiskAssessmentQueue {
  private items: RiskQueueItem[] = [];
  private listeners = new Set<Listener>();
  private workerRunning = false;
  private classifier: Classifier | null = null;
  private vlm: LocalVLM | null = null;
  private loadedVlmModelId: VlmModelId | null = null;
  private hydrated = false;
  private hydratePromise: Promise<void> | null = null;
  private phase: QueuePhase = 'idle';
  private capturePauseDepth = 0;
  private backgroundProcessingEnabled = false;
  private resumeWaiters: Array<() => void> = [];
  private cancelItemId: string | null = null;
  private pendingRemoveId: string | null = null;

  constructor() {
    void this.hydrate();
  }

  getItems(): RiskQueueItem[] {
    return [...this.items];
  }

  getItem(id: string): RiskQueueItem | undefined {
    return this.items.find((item) => item.id === id);
  }

  getPhase(): QueuePhase {
    return this.phase;
  }

  isProcessing(): boolean {
    return this.workerRunning;
  }

  isCaptureBlocked(): boolean {
    return this.phase === 'assessing';
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  pauseForCapture() {
    this.capturePauseDepth += 1;
    this.notify();
  }

  resumeAfterCapture() {
    this.capturePauseDepth = Math.max(0, this.capturePauseDepth - 1);
    if (this.capturePauseDepth === 0) {
      this.enableBackgroundProcessing();
      const waiters = this.resumeWaiters;
      this.resumeWaiters = [];
      for (const resume of waiters) resume();
      void this.processQueue();
    }
    this.notify();
  }

  enableBackgroundProcessing() {
    this.backgroundProcessingEnabled = true;
    this.scheduleProcess();
  }

  /** Stop automatic processing for one queue item without deleting it. */
  async halt(itemId: string, reason = 'Assessment halted by user.'): Promise<boolean> {
    await this.hydrate();
    const item = this.getItem(itemId);
    if (!item) return false;

    if (item.status === 'processing') {
      this.cancelItemId = itemId;
    }

    await this.updateItem(itemId, {
      halted: true,
      status: item.status === 'pending' || item.status === 'processing' ? 'failed' : item.status,
      error: reason,
      processingStartedAt: undefined,
      reassessRequestedAt: undefined,
    });
    this.notify();
    return true;
  }

  /** Halt a stuck item and remove it from the queue. */
  async haltAndRemove(itemId: string): Promise<boolean> {
    await this.hydrate();
    const item = this.getItem(itemId);
    if (!item) return false;

    await this.halt(itemId, 'Stopped and removed by user.');
    this.pendingRemoveId = itemId;

    if (item.status !== 'processing') {
      this.pendingRemoveId = null;
      return (await this.remove(itemId)) === 'ok';
    }
    return true;
  }

  async enqueue(input: EnqueueRiskAssessmentInput): Promise<RiskQueueItem> {
    await this.hydrate();

    const id = `risk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const photoUri = await persistRiskPhoto(input.photoUri, id);
    const now = new Date().toISOString();
    const isManual = input.mode === 'manual';

    let item: RiskQueueItem;
    if (isManual) {
      const comment = input.userComment?.trim() ?? '';
      const modelName = input.modelName;
      item = {
        id,
        photoUri,
        modelId: MANUAL_MODEL_ID,
        modelName,
        mode: 'manual',
        userComment: comment,
        status: 'done',
        gps: input.gps,
        assessmentHistory: [
          {
            id: `run-${id}-manual`,
            startedAt: now,
            completedAt: now,
            durationMs: 0,
            modelId: MANUAL_MODEL_ID,
            modelName,
            result: manualResultFromComment(comment),
          },
        ],
        createdAt: now,
      };
    } else {
      item = {
        id,
        photoUri,
        modelId: input.modelId,
        modelName: input.modelName,
        mode: 'vlm',
        status: 'pending',
        gps: input.gps,
        assessmentHistory: [],
        createdAt: now,
      };
    }

    this.items.unshift(item);
    await this.persist();
    this.notify();
    if (!isManual && this.capturePauseDepth === 0) {
      this.enableBackgroundProcessing();
    }
    if (!isManual) {
      this.scheduleProcess();
    }
    return item;
  }

  async reassess(itemId: string, model?: ReassessRiskAssessmentInput): Promise<boolean> {
    await this.hydrate();
    const item = await this.ensurePhotoAvailable(itemId);
    if (!item) return false;
    if (item.mode === 'manual' || item.modelId === MANUAL_MODEL_ID) return false;
    if (item.photoMissing) return false;
    if (item.status === 'pending' || item.status === 'processing') return false;

    await this.releaseAllModels();
    resetVlmRuntimeCache();
    await waitForNativeVlmSettle();
    this.enableBackgroundProcessing();
    await this.updateItem(itemId, {
      status: 'pending',
      modelId: model?.modelId ?? item.modelId,
      modelName: model?.modelName ?? item.modelName,
      userComment: model?.userComment?.trim() || undefined,
      error: undefined,
      processingStartedAt: undefined,
      reassessRequestedAt: new Date().toISOString(),
      halted: false,
      failureCount: 0,
    });
    this.scheduleProcess();
    return true;
  }

  async remove(itemId: string): Promise<RemoveQueueItemResult> {
    await this.hydrate();
    const item = this.getItem(itemId);
    if (!item) return 'not_found';
    if (item.status === 'processing' && this.cancelItemId !== itemId) {
      return 'processing';
    }

    this.items = this.items.filter((entry) => entry.id !== itemId);
    if (this.cancelItemId === itemId) this.cancelItemId = null;
    if (this.pendingRemoveId === itemId) this.pendingRemoveId = null;
    await this.persist();
    await deleteRiskPhoto(itemId, item.photoUri);
    this.notify();
    return 'ok';
  }

  private scheduleProcess() {
    if (this.capturePauseDepth === 0 && this.backgroundProcessingEnabled) {
      setTimeout(() => {
        void this.processQueue();
      }, 200);
    }
  }

  private async hydrate(): Promise<void> {
    if (this.hydrated) return;
    if (this.hydratePromise) return this.hydratePromise;

    this.hydratePromise = (async () => {
      try {
        const info = await FileSystem.getInfoAsync(QUEUE_FILE);
        if (info.exists) {
          const raw = await FileSystem.readAsStringAsync(QUEUE_FILE);
          const parsed = JSON.parse(raw) as RiskQueueItem[];
          let photosChanged = false;
          const reconciled: RiskQueueItem[] = [];
          for (const item of parsed) {
            const migrated = migrateItem(item);
            const normalized = normalizeHydratedItem(migrated);
            const withPhoto = await reconcileRiskPhoto(normalized);
            if (
              withPhoto.photoUri !== normalized.photoUri ||
              withPhoto.photoMissing !== normalized.photoMissing ||
              withPhoto.status !== migrated.status ||
              withPhoto.halted !== migrated.halted
            ) {
              photosChanged = true;
            }
            reconciled.push(withPhoto);
          }
          this.items = reconciled;
          if (photosChanged) {
            await this.persist();
          }
        }
      } catch {
        this.items = [];
      } finally {
        this.hydrated = true;
        this.notify();
      }
    })();

    return this.hydratePromise;
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }

  private async persist() {
    try {
      await FileSystem.makeDirectoryAsync(QUEUE_DIR, { intermediates: true });
      await FileSystem.writeAsStringAsync(QUEUE_FILE, JSON.stringify(this.items));
    } catch {
      // Best-effort persistence.
    }
  }

  private async ensurePhotoAvailable(itemId: string): Promise<RiskQueueItem | undefined> {
    const item = this.getItem(itemId);
    if (!item) return undefined;
    const reconciled = await reconcileRiskPhoto(item);
    if (
      reconciled.photoUri !== item.photoUri ||
      reconciled.photoMissing !== item.photoMissing
    ) {
      await this.updateItem(itemId, {
        photoUri: reconciled.photoUri,
        photoMissing: reconciled.photoMissing,
      });
    }
    return reconciled;
  }

  private async updateItem(id: string, patch: Partial<RiskQueueItem>) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index < 0) return;
    this.items[index] = { ...this.items[index], ...patch };
    await this.persist();
    this.notify();
  }

  private async waitIfCapturePaused(): Promise<void> {
    if (this.capturePauseDepth === 0) return;
    await this.releaseAllModels();
    await new Promise<void>((resolve) => {
      this.resumeWaiters.push(resolve);
    });
  }

  private async ensureNotCancelled(itemId: string) {
    const item = this.getItem(itemId);
    if (item?.halted || this.cancelItemId === itemId) {
      throw new AssessmentHaltedError();
    }
  }

  private async ensureClassifier(): Promise<Classifier> {
    if (!this.classifier) {
      this.classifier = await Classifier.create();
    }
    return this.classifier;
  }

  private async releaseClassifier() {
    if (!this.classifier) return;
    try {
      await this.classifier.release();
    } catch {
      // Ignore native teardown errors.
    }
    this.classifier = null;
  }

  private async releaseVlm() {
    if (!this.vlm) return;
    try {
      await this.vlm.release();
    } catch {
      // Ignore native teardown errors.
    }
    this.vlm = null;
    this.loadedVlmModelId = null;
  }

  private async releaseAllModels() {
    await this.releaseClassifier();
    await this.releaseVlm();
    resetVlmRuntimeCache();
  }

  private async runVlmAssessment(modelId: VlmModelId, input: RiskInput) {
    await this.releaseVlm();
    await waitForNativeVlmSettle();
    const vlm = await LocalVLM.create(modelId);
    try {
      return await vlm.assess(input);
    } finally {
      await vlm.release();
      this.vlm = null;
      this.loadedVlmModelId = null;
    }
  }

  private async runVlmAssessmentWithRetry(modelId: VlmModelId, input: RiskInput) {
    try {
      return await this.runVlmAssessment(modelId, input);
    } catch (firstError) {
      if (!isNativeVlmFailure(firstError)) throw firstError;
      await this.releaseAllModels();
      await waitForNativeVlmSettle();
      return this.runVlmAssessment(modelId, input);
    }
  }
  private async finishCancelledItem(itemId: string) {
    if (this.cancelItemId === itemId) this.cancelItemId = null;
    if (this.pendingRemoveId === itemId) {
      this.pendingRemoveId = null;
      await this.remove(itemId);
    }
  }

  private async processQueue() {
    await this.hydrate();
    if (this.workerRunning) return;

    this.workerRunning = true;
    this.notify();

    try {
      while (true) {
        await this.waitIfCapturePaused();

        const next = pickNextPending(this.items);
        if (!next) break;

        const ready = await this.ensurePhotoAvailable(next.id);
        if (!ready || ready.photoMissing || ready.halted) {
          if (ready && !ready.halted) {
            await this.updateItem(next.id, {
              status: 'failed',
              photoMissing: true,
              halted: true,
              error: 'Photo file is no longer on this device. Capture a new photo to assess again.',
              processingStartedAt: undefined,
              reassessRequestedAt: undefined,
            });
          }
          continue;
        }

        const startedAt = new Date().toISOString();
        await this.updateItem(ready.id, {
          status: 'processing',
          processingStartedAt: startedAt,
          error: undefined,
        });

        let domain = ready.domain;
        let subject = ready.subject;
        let labelHint = ready.labelHint;
        const skipClassifier = shouldSkipClassifier(ready);
        const photoUriForVlm = await resolvePhotoForVlm(ready.id, ready.photoUri);

        try {
          await this.ensureNotCancelled(ready.id);

          if (skipClassifier) {
            const priors = classifierPriors(ready)!;
            domain = priors.domain;
            subject = priors.subject;
            labelHint = priors.labelHint;
          } else {
            this.phase = 'classifying';
            this.notify();

            const classifier = await this.ensureClassifier();
            const out = await classifier.classify(photoUriForVlm);
            domain = topLabel(out, 'domain');
            subject = topLabel(out, 'subject');
            labelHint = topLabel(out, 'label_hint');

            await this.updateItem(ready.id, { domain, subject, labelHint });
            await this.releaseClassifier();
            await waitForNativeVlmSettle();
          }

          await this.waitIfCapturePaused();
          await this.ensureNotCancelled(ready.id);

          this.phase = 'assessing';
          this.notify();

          const spec = getModelSpec(ready.modelId as VlmModelId);
          const vlmInput: RiskInput = {
            domain,
            subject,
            labelHint,
            imageUri: photoUriForVlm,
            userComment: ready.userComment,
          };
          const assessment =
            spec.provider === 'gemini-nano'
              ? await assessRiskWithGeminiNanoOrCloud(vlmInput)
              : await this.runVlmAssessmentWithRetry(ready.modelId as VlmModelId, vlmInput);
          await this.ensureNotCancelled(ready.id);

          const completedAt = new Date().toISOString();
          const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
          const record: RiskAssessmentRecord = {
            id: `run-${ready.id}-${Date.now()}`,
            startedAt,
            completedAt,
            durationMs,
            modelId: ready.modelId,
            modelName: ready.modelName,
            domain,
            subject,
            labelHint,
            userComment: ready.userComment,
            result: assessment,
          };

          const current = this.getItem(ready.id);
          await this.updateItem(ready.id, {
            status: 'done',
            error: undefined,
            processingStartedAt: undefined,
            reassessRequestedAt: undefined,
            userComment: undefined,
            halted: false,
            failureCount: 0,
            assessmentHistory: [...(current?.assessmentHistory ?? []), record],
          });
        } catch (e) {
          if (e instanceof AssessmentHaltedError) {
            await this.finishCancelledItem(ready.id);
            continue;
          }

          const completedAt = new Date().toISOString();
          const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
          const errorText = String(e);
          const current = this.getItem(ready.id);
          const failureCount = (current?.failureCount ?? 0) + 1;
          const autoHalt = isNativeVlmFailure(e) || failureCount >= 2;
          const record: RiskAssessmentRecord = {
            id: `run-${ready.id}-${Date.now()}`,
            startedAt,
            completedAt,
            durationMs,
            modelId: ready.modelId,
            modelName: ready.modelName,
            domain,
            subject,
            labelHint,
            userComment: ready.userComment,
            error: errorText,
          };
          await this.updateItem(ready.id, {
            status: 'failed',
            error: autoHalt
              ? `${errorText} — auto-halted so the queue can continue. Delete this photo or Re-assess manually.`
              : errorText,
            processingStartedAt: undefined,
            reassessRequestedAt: undefined,
            halted: autoHalt,
            failureCount,
            assessmentHistory: [...(current?.assessmentHistory ?? []), record],
          });
        } finally {
          await this.releaseAllModels();
          this.phase = 'idle';
          this.notify();
          if (this.pendingRemoveId === ready.id) {
            await this.finishCancelledItem(ready.id);
          }
        }
      }
    } finally {
      this.workerRunning = false;
      this.notify();
      if (this.capturePauseDepth === 0 && this.items.some((item) => item.status === 'pending' && !item.halted)) {
        this.scheduleProcess();
      }
    }
  }
}

export const riskAssessmentQueue = new RiskAssessmentQueue();
