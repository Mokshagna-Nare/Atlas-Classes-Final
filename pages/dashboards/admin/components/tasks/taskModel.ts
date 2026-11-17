// Shared shapes and labels for the admin Tasks feature.

export type TaskStatus = 'todo' | 'in_progress' | 'postponed' | 'completed' | 'cancelled';
export type TaskType = 'bug' | 'change' | 'update' | 'feature' | 'content' | 'other';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type Tone = 'gray' | 'emerald' | 'sky' | 'amber' | 'rose' | 'violet' | 'cyan' | 'teal';

export interface Task {
  id: string;
  title: string;
  details: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  areas: string[];
  assignee_id: string | null;
  created_by: string | null;
  due_date: string | null;
  postponed_until: string | null;
  postpone_reason: string | null;
  completed_at: string | null;
  source: 'typed' | 'voice';
  voice_transcript: string | null;
  created_at: string;
  updated_at: string;
}

/** What a new task needs (the server fills in the rest). */
export interface TaskDraft {
  title: string;
  details: string;
  type: TaskType;
  priority: TaskPriority;
  areas: string[];
  assignee_id: string | null;
  due_date: string | null;
  status?: TaskStatus;
  source?: 'typed' | 'voice';
  voice_transcript?: string | null;
}

export type TaskChanges = Partial<Pick<Task, 'title' | 'details' | 'type' | 'status' | 'priority' | 'areas' | 'assignee_id' | 'due_date' | 'postponed_until' | 'postpone_reason'>>;

export interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
}

export interface AreaTag {
  slug: string;
  label: string;
  group: 'Admin console' | 'Other parts of Atlas' | 'Custom';
  /** Other ways people say it (also what speech recognition tends to hear). */
  aliases?: string[];
}

export interface TaskEvent {
  id: string;
  kind: 'created' | 'updated' | 'status' | 'comment';
  changes: Record<string, [unknown, unknown] | unknown>;
  comment: string | null;
  actor_id: string | null;
  created_at: string;
}

export const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'postponed', 'completed', 'cancelled'];
export const OPEN_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'postponed'];
export const BOARD_COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'postponed', 'completed'];

export const STATUS_META: Record<TaskStatus, { label: string; tone: Tone; dot: string; hint: string }> = {
  todo: { label: 'To do', tone: 'sky', dot: 'bg-sky-400', hint: 'Not started yet' },
  in_progress: { label: 'In progress', tone: 'amber', dot: 'bg-amber-400', hint: 'Being worked on' },
  postponed: { label: 'Postponed', tone: 'violet', dot: 'bg-violet-400', hint: 'Parked until later' },
  completed: { label: 'Completed', tone: 'emerald', dot: 'bg-emerald-400', hint: 'Done' },
  cancelled: { label: 'Cancelled', tone: 'gray', dot: 'bg-gray-500', hint: 'Not needed any more' },
};

export const TYPES: TaskType[] = ['bug', 'change', 'update', 'feature', 'content', 'other'];
export const TYPE_META: Record<TaskType, { label: string; tone: Tone; icon: string }> = {
  bug: { label: 'Bug / Error', tone: 'rose', icon: 'M12 12.75c1.148 0 2.278.08 3.383.237 1.037.146 1.866.966 1.866 2.013 0 3.728-2.35 6.75-5.25 6.75S6.75 18.728 6.75 15c0-1.046.83-1.867 1.866-2.013A24.204 24.204 0 0112 12.75zm0 0c2.883 0 5.647.508 8.207 1.44a23.91 23.91 0 01-1.152 6.06M12 12.75c-2.883 0-5.647.508-8.208 1.44.125 2.104.52 4.136 1.153 6.06M12 12.75a2.25 2.25 0 002.248-2.354M12 12.75a2.25 2.25 0 01-2.248-2.354M12 8.25c.995 0 1.971-.08 2.922-.236.403-.066.74-.358.795-.762a3.778 3.778 0 00-.399-2.25M12 8.25c-.995 0-1.97-.08-2.922-.236-.402-.066-.74-.358-.795-.762a3.734 3.734 0 01.4-2.253M12 8.25a2.25 2.25 0 00-2.248 2.146M12 8.25a2.25 2.25 0 012.248 2.146M8.683 5a6.032 6.032 0 01-1.155-1.002c.07-.63.27-1.222.574-1.747m.581 2.749A3.75 3.75 0 0115.318 5m0 0c.427-.283.815-.62 1.155-.999a4.471 4.471 0 00-.575-1.752M4.921 6a24.048 24.048 0 00-.392 3.314c1.668.546 3.416.914 5.223 1.082M19.08 6c.205 1.08.337 2.187.392 3.314a23.882 23.882 0 01-5.223 1.082' },
  change: { label: 'Change request', tone: 'sky', icon: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5' },
  update: { label: 'Software update', tone: 'cyan', icon: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99' },
  feature: { label: 'New feature', tone: 'violet', icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z' },
  content: { label: 'Content work', tone: 'teal', icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25' },
  other: { label: 'Other', tone: 'gray', icon: 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z' },
};

export const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];
export const PRIORITY_META: Record<TaskPriority, { label: string; tone: Tone; rank: number }> = {
  urgent: { label: 'Urgent', tone: 'rose', rank: 0 },
  high: { label: 'High', tone: 'amber', rank: 1 },
  medium: { label: 'Medium', tone: 'sky', rank: 2 },
  low: { label: 'Low', tone: 'gray', rank: 3 },
};

/** Area tags. Admin-console slugs match the sidebar's views, so a quick-add can pre-tag the open section. */
export const BUILTIN_AREAS: AreaTag[] = [
  { slug: 'ai-generator', label: 'Upload / Assign Test', group: 'Admin console', aliases: ['upload test', 'assign test', 'upload and assign', 'exam conversion', 'convert paper', 'html paper', 'upload assign'] },
  { slug: 'mcq-upload', label: 'MCQ Upload', group: 'Admin console', aliases: ['mcq upload', 'mcqs upload', 'upload mcq', 'upload mcqs', 'mcq', 'mcqs', 'bulk upload', 'question upload', 'docx upload', 'word upload'] },
  { slug: 'question-bank', label: 'Question Bank', group: 'Admin console', aliases: ['question bank', 'questions bank', 'q bank', 'qbank', 'question database'] },
  { slug: 'paper-generator', label: 'Generate Paper', group: 'Admin console', aliases: ['generate paper', 'paper generator', 'question paper generator', 'paper generation', 'printable paper', 'offline paper'] },
  { slug: 'questions-generator', label: 'Questions generator', group: 'Admin console', aliases: ['questions generator', 'question generator', 'extract questions', 'extraction', 'ocr'] },
  { slug: 'create-test', label: 'Create Online Test', group: 'Admin console', aliases: ['create online test', 'create test', 'online test', 'new test'] },
  { slug: 'tests', label: 'Manage Tests', group: 'Admin console', aliases: ['manage tests', 'manage test', 'test links', 'test results', 'attempt results'] },
  { slug: 'flagged-attempts', label: 'Flagged Attempts', group: 'Admin console', aliases: ['flagged attempts', 'flagged attempt', 'proctoring', 'violations', 'cheating'] },
  { slug: 'analytics', label: 'Student Analytics', group: 'Admin console', aliases: ['student analytics', 'analytics', 'reports', 'performance report'] },
  { slug: 'institutes', label: 'Manage Institutes', group: 'Admin console', aliases: ['manage institutes', 'institutes', 'institute management', 'partner schools', 'schools'] },
  { slug: 'student-portal', label: 'Student portal', group: 'Other parts of Atlas', aliases: ['student portal', 'student dashboard', 'student side', 'students side', 'student app', 'student page', 'student panel', 'take test page', 'student test page', 'student test', 'test page', 'exam page', 'test screen'] },
  { slug: 'institute-portal', label: 'Institute portal', group: 'Other parts of Atlas', aliases: ['institute portal', 'institute dashboard', 'institute side', 'institute panel'] },
  { slug: 'public-website', label: 'Public website', group: 'Other parts of Atlas', aliases: ['public website', 'website', 'home page', 'homepage', 'landing page', 'public site', 'careers page', 'contact form', 'navbar', 'footer'] },
  { slug: 'login-security', label: 'Login & security', group: 'Other parts of Atlas', aliases: ['login', 'log in', 'sign in', 'signin', 'sign up', 'otp', 'password', 'two step', 'two factor', '2fa', 'mfa', 'authentication', 'security', 'google login'] },
  { slug: 'backend-api', label: 'Backend / API', group: 'Other parts of Atlas', aliases: ['backend', 'back end', 'api', 'server', 'vercel', 'render'] },
  { slug: 'database', label: 'Database', group: 'Other parts of Atlas', aliases: ['database', 'supabase', 'db', 'migration', 'tables'] },
  { slug: 'theme-ui', label: 'Design & theme', group: 'Other parts of Atlas', aliases: ['light theme', 'dark theme', 'theme', 'ui', 'design', 'colours', 'colors', 'layout'] },
];

export const allAreas = (custom: { slug: string; label: string }[] = []): AreaTag[] => [
  ...BUILTIN_AREAS,
  ...custom
    .filter(tag => !BUILTIN_AREAS.some(area => area.slug === tag.slug))
    .map(tag => ({ slug: tag.slug, label: tag.label, group: 'Custom' as const, aliases: [tag.label.toLowerCase()] })),
];

export const areaLabel = (slug: string, areas: AreaTag[]) => areas.find(area => area.slug === slug)?.label || slug.replace(/-/g, ' ');

// ---------------------------------------------------------------------------
// Dates — everything is a calendar day in India Standard Time.
// ---------------------------------------------------------------------------
const IST_PARTS = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });

/** "2026-11-17" for the given moment, in IST. */
export const istDay = (moment: Date = new Date()) => IST_PARTS.format(moment);

export const addDays = (day: string, days: number) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const weekday = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday

const DAY_FORMAT = new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
const DAY_FORMAT_YEAR = new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });

/** "Today", "Tomorrow", "Fri, 21 Nov", "3 Jan 2027". */
export function friendlyDay(day: string | null, today: string = istDay()) {
  if (!day) return '';
  if (day === today) return 'Today';
  if (day === addDays(today, 1)) return 'Tomorrow';
  if (day === addDays(today, -1)) return 'Yesterday';
  const date = new Date(`${day}T00:00:00Z`);
  return day.slice(0, 4) === today.slice(0, 4) ? DAY_FORMAT.format(date) : DAY_FORMAT_YEAR.format(date);
}

export const isOpen = (task: Task) => OPEN_STATUSES.includes(task.status);

export const isOverdue = (task: Task, today: string = istDay()) =>
  isOpen(task) && task.status !== 'postponed' && !!task.due_date && task.due_date < today;

export const adminName = (id: string | null, admins: AdminUser[], me?: string | null) => {
  if (!id) return 'Unassigned';
  const admin = admins.find(a => a.id === id);
  const name = admin?.name || admin?.email?.split('@')[0] || 'Former admin';
  return id === me ? `${name} (you)` : name;
};

export const initials = (name: string) =>
  name.replace(/\(you\)/, '').split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase() || '?';

/** Sort: overdue first, then priority, then soonest due, then most recently touched. */
export function compareTasks(a: Task, b: Task, today: string = istDay()) {
  const overdue = Number(isOverdue(b, today)) - Number(isOverdue(a, today));
  if (overdue) return overdue;
  const priority = PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank;
  if (priority) return priority;
  if (a.due_date !== b.due_date) return (a.due_date || '9999') < (b.due_date || '9999') ? -1 : 1;
  return a.updated_at < b.updated_at ? 1 : -1;
}

export const emptyDraft = (areas: string[] = []): TaskDraft => ({
  title: '',
  details: '',
  type: 'bug',
  priority: 'medium',
  areas,
  assignee_id: null,
  due_date: null,
});
