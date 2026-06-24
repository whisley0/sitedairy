import type {
  CompleteTaskInput,
  DummyUser,
  EmergencyEscalation,
  NewConditionInput,
  NewObservationInput,
  SiteConditionIssue,
  SiteObservation,
  SiteTask,
} from './models';
import * as mock from './mockData';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface AuthRepository {
  signIn(email: string, password: string): Promise<DummyUser>;
  signUp(email: string, password: string, displayName: string): Promise<DummyUser>;
  signOut(): Promise<void>;
  currentUser(): DummyUser | null;
}

export interface SiteDiaryRepository {
  getTodayTasks(): Promise<SiteTask[]>;
  getFutureTasks(): Promise<SiteTask[]>;
  completeTask(input: CompleteTaskInput): Promise<SiteTask>;
  getDeadlineReminders(): Promise<SiteTask[]>;
  getObservations(): Promise<SiteObservation[]>;
  submitObservation(input: NewObservationInput): Promise<SiteObservation>;
  getConditionIssues(): Promise<SiteConditionIssue[]>;
  submitConditionIssue(input: NewConditionInput): Promise<SiteConditionIssue>;
  getEscalations(): Promise<EmergencyEscalation[]>;
  submitEscalation(title: string, description: string): Promise<EmergencyEscalation>;
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
  private futureTaskList = [...mock.futureTasks];

  private allTasks(): SiteTask[] {
    return [...this.todayTaskList, ...this.futureTaskList];
  }

  async getTodayTasks(): Promise<SiteTask[]> {
    await delay(300);
    return [...this.todayTaskList];
  }

  async getFutureTasks(): Promise<SiteTask[]> {
    await delay(300);
    return [...this.futureTaskList];
  }

  async completeTask(input: CompleteTaskInput): Promise<SiteTask> {
    await delay(400);
    const task = this.todayTaskList.find((item) => item.id === input.taskId);
    if (!task) {
      throw new Error('Task not found.');
    }
    if (task.status === 'COMPLETED') {
      throw new Error('Task is already completed.');
    }
    task.status = 'COMPLETED';
    task.confirmationPhotoUri = input.confirmationPhotoUri;
    task.completedAt = new Date().toISOString().slice(0, 10);
    return { ...task };
  }

  async getDeadlineReminders(): Promise<SiteTask[]> {
    await delay(200);
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 3);
    const deadlineStr = deadline.toISOString().slice(0, 10);
    return this.allTasks()
      .filter((task) => task.status !== 'COMPLETED' && task.dueDate <= deadlineStr)
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

  async submitEscalation(title: string, description: string): Promise<EmergencyEscalation> {
    await delay(500);
    const escalation: EmergencyEscalation = {
      id: `esc-${Date.now()}`,
      title,
      description,
      status: 'OPEN',
      escalatedAt: new Date().toISOString().slice(0, 10),
      targetTeam: 'Upper Management',
    };
    this.escalationList.unshift(escalation);
    return escalation;
  }
}
