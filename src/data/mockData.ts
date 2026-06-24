import type {
  EmergencyEscalation,
  SiteConditionIssue,
  SiteObservation,
  SiteTask,
  DummyUser,
} from './models';

const today = new Date();

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export const demoUser: DummyUser = {
  uid: 'demo-user-001',
  email: 'supervisor@sitediary.demo',
  displayName: 'Site Supervisor',
};

export const todayTasks: SiteTask[] = [
  {
    id: 'task-1',
    title: 'Pour Level 3 slab',
    description: 'Coordinate with concrete supplier for morning pour.',
    dueDate: formatDate(today),
    status: 'IN_PROGRESS',
    isToday: true,
  },
  {
    id: 'task-2',
    title: 'Inspect rebar on Grid B',
    description: 'Verify spacing before afternoon inspection.',
    dueDate: formatDate(today),
    status: 'NOT_STARTED',
    isToday: true,
  },
];

export const futureTasks: SiteTask[] = [
  {
    id: 'task-3',
    title: 'Install MEP rough-in',
    description: 'Mechanical and electrical rough-in for east wing.',
    dueDate: formatDate(addDays(today, 2)),
    status: 'NOT_STARTED',
    isToday: false,
  },
  {
    id: 'task-4',
    title: 'Submit weekly progress report',
    description: 'Compile photos and labour hours for client.',
    dueDate: formatDate(addDays(today, 4)),
    status: 'NOT_STARTED',
    isToday: false,
  },
  {
    id: 'task-5',
    title: 'Facade panel delivery check',
    description: 'Confirm delivery slot with logistics team.',
    dueDate: formatDate(addDays(today, 7)),
    status: 'NOT_STARTED',
    isToday: false,
  },
];

export const observations: SiteObservation[] = [
  {
    id: 'obs-1',
    title: 'Unexpected soil condition',
    notes: 'Soft spot discovered near footing F-12.',
    location: 'Grid C / Level 1',
    billable: true,
    recordedAt: formatDate(addDays(today, -1)),
  },
  {
    id: 'obs-2',
    title: 'Design clarification needed',
    notes: 'Curtain wall detail differs from drawing sheet A-401.',
    location: 'North elevation',
    billable: true,
    recordedAt: formatDate(today),
  },
];

export const conditionIssues: SiteConditionIssue[] = [
  {
    id: 'cond-1',
    category: 'Safety',
    description: 'Missing guardrail on temporary stair access.',
    severity: 'HIGH',
    reportedAt: formatDate(today),
    resolved: false,
  },
  {
    id: 'cond-2',
    category: 'Quality',
    description: 'Honeycombing observed on column C-07.',
    severity: 'MEDIUM',
    reportedAt: formatDate(addDays(today, -1)),
    resolved: false,
  },
];

export const escalations: EmergencyEscalation[] = [
  {
    id: 'esc-1',
    title: 'No crew on site',
    description: 'Only 2 workers present; critical path work stalled.',
    status: 'OPEN',
    escalatedAt: formatDate(today),
    targetTeam: 'Upper Management',
  },
];

export function upcomingDeadlineReminders(daysAhead = 3): SiteTask[] {
  const deadline = addDays(today, daysAhead);
  return [...todayTasks, ...futureTasks]
    .filter((task) => task.status !== 'COMPLETED' && new Date(task.dueDate) <= deadline)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
