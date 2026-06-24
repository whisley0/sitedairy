export type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type IssueSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type EscalationStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface SiteTask {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  status: TaskStatus;
  isToday: boolean;
  confirmationPhotoUri?: string;
  completedAt?: string;
}

export interface CompleteTaskInput {
  taskId: string;
  confirmationPhotoUri?: string;
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
}

export interface DummyUser {
  uid: string;
  email: string;
  displayName: string;
}
