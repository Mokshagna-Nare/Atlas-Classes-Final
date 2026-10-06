import { Test } from '../types';

export type TestStatus = 'Upcoming' | 'Live' | 'Completed';

export const isOnlineTest = (t: Test) => (t.question_ids?.length || 0) > 0;

// `tests.date` is a timestamptz holding UTC midnight of the chosen day; take the calendar day.
const dayOf = (d: string) => d.slice(0, 10);

/** The moment a test is "on": its online start window, else its scheduled day, else creation time. */
export const testDate = (t: Test): Date | null => {
  if (t.start_window) return new Date(t.start_window);
  if (t.date) return new Date(`${dayOf(t.date)}T00:00:00`);
  if (t.created_at) return new Date(t.created_at);
  return null;
};

export const testStatus = (t: Test): TestStatus => {
  const now = Date.now();
  if (t.start_window && t.end_window) {
    if (now < new Date(t.start_window).getTime()) return 'Upcoming';
    if (now <= new Date(t.end_window).getTime()) return 'Live';
    return 'Completed';
  }
  if (t.date) return new Date(`${dayOf(t.date)}T23:59:59`).getTime() < now ? 'Completed' : 'Upcoming';
  return t.status === 'completed' ? 'Completed' : 'Upcoming';
};

export const formatTestDate = (t: Test) =>
  testDate(t)?.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) ?? 'No date';
