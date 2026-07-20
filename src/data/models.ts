export type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type IssueSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type EscalationStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface TaskPhoto {
  id: string;
  uri: string;
  uploadedAt: string;
}

export interface TaskCompletionRecord {
  id: string;
  completedAt: string;
  confirmationPhotoUri?: string;
}

export interface SiteTask {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  status: TaskStatus;
  isToday: boolean;
  /** Number of daily check-ins required to finish the task. */
  durationDays: number;
  completionRecords: TaskCompletionRecord[];
  /** Site photos attached to this task (ordered by upload time). */
  photos?: TaskPhoto[];
  /** Work start — first photo upload unless manually set. */
  workStartedAt?: string;
  /** Work end — last photo upload unless manually set. */
  workEndedAt?: string;
  workStartedAtManual?: boolean;
  workEndedAtManual?: boolean;
  confirmationPhotoUri?: string;
  completedAt?: string;
}

export interface AddTaskPhotoInput {
  taskId: string;
  uri: string;
  uploadedAt?: string;
}

export interface CompleteTaskInput {
  taskId: string;
  newPhotos?: { uri: string; uploadedAt?: string }[];
  removePhotoIds?: string[];
  workStartedAt?: string;
  workEndedAt?: string;
  workStartedAtManual?: boolean;
  workEndedAtManual?: boolean;
}

export interface SiteObservation {
  id: string;
  title: string;
  notes: string;
  location: string;
  billable: boolean;
  recordedAt: string;
  photoUri?: string;
}

export interface NewObservationInput {
  title: string;
  notes: string;
  photoUri?: string;
}

export type ConditionCategory = 'Safety' | 'Quality';

export interface SiteConditionIssue {
  id: string;
  category: ConditionCategory;
  description: string;
  severity: IssueSeverity;
  reportedAt: string;
  resolved: boolean;
}

export interface NewConditionInput {
  category: ConditionCategory;
  description: string;
}

export interface EmergencyEscalation {
  id: string;
  title: string;
  description: string;
  status: EscalationStatus;
  escalatedAt: string;
  targetTeam: string;
  taskId?: string;
  taskTitle?: string;
  photoUri?: string;
}

export interface SubmitEscalationInput {
  title: string;
  description: string;
  taskId?: string;
  taskTitle?: string;
  photoUri?: string;
}

export interface DummyUser {
  uid: string;
  email: string;
  displayName: string;
}

export type RiskQueueStatus = 'pending' | 'processing' | 'done' | 'failed';

export type RiskAssessmentMode = 'vlm' | 'manual';

export const MANUAL_MODEL_ID = 'manual';

/** GPS coordinates captured when a site photo was added. */
export interface PhotoGps {
  latitude: number;
  longitude: number;
  /** Meters, when captured from device GPS. */
  accuracy?: number;
  capturedAt: string;
  source?: 'exif' | 'device';
}

export interface RiskAssessmentResult {
  risk: string;
  confidence: number;
  rationale_en: string;
  rationale_zh: string;
  rawVlmOutput?: string;
}

/** One classifier + VLM run for a queued photo. */
export interface RiskAssessmentRecord {
  id: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  modelId: string;
  modelName: string;
  inspectionType?: string;
  domain?: string;
  subject?: string;
  /** @deprecated Prefer inspectionType. Kept for older persisted records. */
  labelHint?: string;
  /** Optional worker note supplied when re-assessing. */
  userComment?: string;
  result?: RiskAssessmentResult;
  error?: string;
}

export interface ReassessRiskAssessmentInput {
  modelId: string;
  modelName: string;
  userComment?: string;
}

export interface RiskQueueItem {
  id: string;
  photoUri: string;
  /** True when the on-disk photo file is no longer available (e.g. legacy temp URI). */
  photoMissing?: boolean;
  modelId: string;
  modelName: string;
  mode?: RiskAssessmentMode;
  userComment?: string;
  status: RiskQueueStatus;
  /** ResNet inspection_type head — e.g. BME / BEL / BPD / FAC / ELV. */
  inspectionType?: string;
  domain?: string;
  subject?: string;
  /** @deprecated Prefer inspectionType. Kept for older persisted items. */
  labelHint?: string;
  /** Editable tag list seeded from inspection type + domain + subject. */
  tags?: string[];
  /** L2-normalized SigLIP2 vision embedding (768-d) for similar-photo search. */
  embedding?: number[];
  assessmentHistory: RiskAssessmentRecord[];
  processingStartedAt?: string;
  reassessRequestedAt?: string;
  /** When true, this item is excluded from automatic queue processing. */
  halted?: boolean;
  /** Number of failed assessment runs (used to auto-halt repeat failures). */
  failureCount?: number;
  error?: string;
  createdAt: string;
  gps?: PhotoGps;
}

export function latestAssessmentRecord(item: RiskQueueItem): RiskAssessmentRecord | undefined {
  if (!item.assessmentHistory?.length) return undefined;
  return item.assessmentHistory[item.assessmentHistory.length - 1];
}

export function latestAssessmentResult(item: RiskQueueItem): RiskAssessmentResult | undefined {
  return latestAssessmentRecord(item)?.result;
}

export interface EnqueueRiskAssessmentInput {
  photoUri: string;
  modelId: string;
  modelName: string;
  mode?: RiskAssessmentMode;
  userComment?: string;
  gps?: PhotoGps;
  inspectionType?: string;
  domain?: string;
  subject?: string;
  tags?: string[];
}

export function isManualQueueItem(item: RiskQueueItem): boolean {
  return item.mode === 'manual' || item.modelId === MANUAL_MODEL_ID;
}
