import type {
  AddTaskPhotoInput,
  CompleteTaskInput,
  DummyUser,
  EmergencyEscalation,
  NewConditionInput,
  NewObservationInput,
  SiteConditionIssue,
  SiteObservation,
  SiteTask,
  SubmitEscalationInput,
  TaskCompletionRecord,
  TaskPhoto,
} from './models';
import * as mock from './mockData';
import { taskDurationDays, taskIsFullyComplete } from '../utils/taskProgress';
import { recomputeTaskWorkTimes } from '../utils/taskWork';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface AuthRepository {
  signIn(email: string, password: string): Promise<DummyUser>;
  signUp(email: string, password: string, displayName: string): Promise<DummyUser>;
  signOut(): Promise<void>;
  currentUser(): DummyUser | null;
}

export interface SiteDiaryRepository {
  getTodayTasks(): Promise<SiteTask[]>;
  getTomorrowTasks(): Promise<SiteTask[]>;
  addTaskPhoto(input: AddTaskPhotoInput): Promise<SiteTask>;
  completeTask(input: CompleteTaskInput): Promise<SiteTask>;
  getDeadlineReminders(): Promise<SiteTask[]>;
  getObservations(): Promise<SiteObservation[]>;
  submitObservation(input: NewObservationInput): Promise<SiteObservation>;
  getConditionIssues(): Promise<SiteConditionIssue[]>;
  submitConditionIssue(input: NewConditionInput): Promise<SiteConditionIssue>;
  getEscalations(): Promise<EmergencyEscalation[]>;
  submitEscalation(input: SubmitEscalationInput): Promise<EmergencyEscalation>;
  resolveEscalation(escalationId: string): Promise<EmergencyEscalation>;
}

/** Dummy auth — simulates Firebase Email/Password without network calls. */
export class DummyAuthRepository implements AuthRepository {
  private user: DummyUser | null = null;

  async signIn(email: string, password: string): Promise<DummyUser> {
    await delay(600);
    if (!email.trim() && !password) {
      this.user = { ...mock.demoUser };
      return this.user;
    }
    if (!email.trim() || password.length < 6) {
      throw new Error('Use a valid email and password (min 6 chars).');
    }
    this.user = {
      uid: `local-${email}`,
      email,
      displayName: email.split('@')[0],
    };
    return this.user;
  }

  async signUp(email: string, password: string, displayName: string): Promise<DummyUser> {
    await delay(800);
    if (!email.trim() || password.length < 6 || !displayName.trim()) {
      throw new Error('Fill in all fields. Password must be at least 6 characters.');
    }
    this.user = { uid: `local-${email}`, email, displayName };
    return this.user;
  }

  async signOut(): Promise<void> {
    await delay(200);
    this.user = null;
  }

  currentUser(): DummyUser | null {
    return this.user;
  }
}

/** Dummy Firestore layer — returns in-memory mock data. */
export class DummySiteDiaryRepository implements SiteDiaryRepository {
  private escalationList = [...mock.escalations];
  private observationList = [...mock.observations];
  private conditionList = [...mock.conditionIssues];
  private todayTaskList = [...mock.todayTasks];
  private tomorrowTaskList = [...mock.tomorrowTasks];

  private allTasks(): SiteTask[] {
    return [...this.todayTaskList, ...this.tomorrowTaskList];
  }

  async getTodayTasks(): Promise<SiteTask[]> {
    await delay(300);
    return [...this.todayTaskList];
  }

  async getTomorrowTasks(): Promise<SiteTask[]> {
    await delay(300);
    return [...this.tomorrowTaskList];
  }

  private findTask(taskId: string): SiteTask | undefined {
    return (
      this.todayTaskList.find((item) => item.id === taskId) ??
      this.tomorrowTaskList.find((item) => item.id === taskId)
    );
  }

  private applyTaskWorkUpdate(
    task: SiteTask,
    input: Pick<
      CompleteTaskInput,
      | 'newPhotos'
      | 'removePhotoIds'
      | 'workStartedAt'
      | 'workEndedAt'
      | 'workStartedAtManual'
      | 'workEndedAtManual'
    >,
  ): void {
    let photos = [...(task.photos ?? [])];

    if (input.removePhotoIds?.length) {
      const remove = new Set(input.removePhotoIds);
      photos = photos.filter((photo) => !remove.has(photo.id));
    }

    if (input.newPhotos?.length) {
      const appended: TaskPhoto[] = input.newPhotos.map((photo, index) => ({
        id: `photo-${task.id}-${Date.now()}-${index}`,
        uri: photo.uri,
        uploadedAt: photo.uploadedAt ?? new Date().toISOString(),
      }));
      photos = [...photos, ...appended];
    }

    task.photos = photos;

    if (input.workStartedAtManual !== undefined) {
      task.workStartedAtManual = input.workStartedAtManual;
    }
    if (input.workEndedAtManual !== undefined) {
      task.workEndedAtManual = input.workEndedAtManual;
    }
    if (input.workStartedAt !== undefined) {
      task.workStartedAt = input.workStartedAt;
    }
    if (input.workEndedAt !== undefined) {
      task.workEndedAt = input.workEndedAt;
    }

    recomputeTaskWorkTimes(task);
  }

  async addTaskPhoto(input: AddTaskPhotoInput): Promise<SiteTask> {
    await delay(300);
    const task = this.findTask(input.taskId);
    if (!task) {
      throw new Error('Task not found.');
    }

    this.applyTaskWorkUpdate(task, {
      newPhotos: [{ uri: input.uri, uploadedAt: input.uploadedAt }],
    });

    if (task.status === 'NOT_STARTED') {
      task.status = 'IN_PROGRESS';
    }

    return { ...task };
  }

  async completeTask(input: CompleteTaskInput): Promise<SiteTask> {
    await delay(400);
    const task = this.findTask(input.taskId);
    if (!task) {
      throw new Error('Task not found.');
    }
    if (taskIsFullyComplete(task)) {
      throw new Error('Task is already completed.');
    }

    this.applyTaskWorkUpdate(task, input);

    const completedAt = new Date().toISOString().slice(0, 10);
    const latestPhoto = task.photos?.[task.photos.length - 1];
    const record: TaskCompletionRecord = {
      id: `completion-${task.id}-${Date.now()}`,
      completedAt,
      confirmationPhotoUri: latestPhoto?.uri,
    };
    task.completionRecords = [...(task.completionRecords ?? []), record];

    const required = taskDurationDays(task);
    if (task.completionRecords.length >= required) {
      task.status = 'COMPLETED';
      task.completedAt = completedAt;
    } else if (task.status === 'NOT_STARTED') {
      task.status = 'IN_PROGRESS';
    }

    return { ...task };
  }

  async getDeadlineReminders(): Promise<SiteTask[]> {
    await delay(200);
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 3);
    const deadlineStr = deadline.toISOString().slice(0, 10);
    return this.allTasks()
      .filter((task) => !taskIsFullyComplete(task) && task.dueDate <= deadlineStr)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  async getObservations(): Promise<SiteObservation[]> {
    await delay(300);
    return [...this.observationList];
  }

  async submitObservation(input: NewObservationInput): Promise<SiteObservation> {
    await delay(400);
    const observation: SiteObservation = {
      id: `obs-${Date.now()}`,
      title: input.title,
      notes: input.notes,
      location: 'On site',
      billable: false,
      recordedAt: new Date().toISOString().slice(0, 10),
      photoUri: input.photoUri,
    };
    this.observationList.unshift(observation);
    return observation;
  }

  async getConditionIssues(): Promise<SiteConditionIssue[]> {
    await delay(300);
    return [...this.conditionList];
  }

  async submitConditionIssue(input: NewConditionInput): Promise<SiteConditionIssue> {
    await delay(400);
    const issue: SiteConditionIssue = {
      id: `cond-${Date.now()}`,
      category: input.category,
      description: input.description,
      severity: 'MEDIUM',
      reportedAt: new Date().toISOString().slice(0, 10),
      resolved: false,
    };
    this.conditionList.unshift(issue);
    return issue;
  }

  async getEscalations(): Promise<EmergencyEscalation[]> {
    await delay(300);
    return [...this.escalationList];
  }

  async submitEscalation(input: SubmitEscalationInput): Promise<EmergencyEscalation> {
    await delay(500);
    const escalation: EmergencyEscalation = {
      id: `esc-${Date.now()}`,
      title: input.title,
      description: input.description,
      status: 'OPEN',
      escalatedAt: new Date().toISOString().slice(0, 10),
      targetTeam: 'Upper Management',
      taskId: input.taskId,
      taskTitle: input.taskTitle,
      photoUri: input.photoUri,
    };
    this.escalationList.unshift(escalation);
    return escalation;
  }

  async resolveEscalation(escalationId: string): Promise<EmergencyEscalation> {
    await delay(300);
    const escalation = this.escalationList.find((item) => item.id === escalationId);
    if (!escalation) {
      throw new Error('Escalation not found.');
    }
    escalation.status = 'RESOLVED';
    return { ...escalation };
  }
}
