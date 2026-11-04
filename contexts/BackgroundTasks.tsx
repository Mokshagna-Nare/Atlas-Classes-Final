import React, { createContext, useContext, useEffect, useMemo } from 'react';

// Ongoing work inside a dashboard section (a paper being generated, a bulk upload under review,
// an unsaved question…). A section declares it with useOngoingTask; the dashboard then asks before
// leaving that section, can keep it mounted in the background, and lists it in the task tray.

export interface TaskInfo {
  /** Short name, e.g. "Question paper · Unit Test 3". */
  label: string;
  /** What it is doing right now, e.g. "Generating questions…". */
  detail?: string;
  /** True while something is actively running (shows a spinner rather than a paused dot). */
  busy?: boolean;
}

export type TaskReporter = (view: string, id: string, info: TaskInfo | null) => void;

const ScopeContext = createContext<{ view: string; report: TaskReporter } | null>(null);

/** Wraps one dashboard section so the tasks it declares are attributed to it. */
export const TaskScope: React.FC<{ view: string; report: TaskReporter; children: React.ReactNode }> = ({ view, report, children }) => {
  const value = useMemo(() => ({ view, report }), [view, report]);
  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
};

/**
 * Declares (info) or clears (null) a piece of ongoing work in the current section. `id` tells
 * apart several tasks in one section (e.g. a single-question form and a bulk upload).
 */
export function useOngoingTask(id: string, info: TaskInfo | null) {
  const scope = useContext(ScopeContext);
  const signature = info ? `${info.label}\u0000${info.detail ?? ''}\u0000${info.busy ? 1 : 0}` : '';

  useEffect(() => {
    scope?.report(scope.view, id, info);
    // signature captures every field of info
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, id, signature]);

  useEffect(() => () => scope?.report(scope.view, id, null), [scope, id]);
}
