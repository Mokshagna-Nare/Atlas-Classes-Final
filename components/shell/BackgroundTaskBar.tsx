import React, { useState } from 'react';
import type { TaskInfo } from '../../contexts/BackgroundTasks';

// Status bar docked under the dashboard content, listing sections whose work is running in the
// background. Each task can be reopened or ended; with several, the list expands upwards.

export interface BackgroundTaskEntry extends TaskInfo {
  view: string;
  /** Section name from the sidebar, e.g. "Generate Paper". */
  section: string;
}

interface Props {
  tasks: BackgroundTaskEntry[];
  onOpen: (view: string) => void;
  onEnd: (view: string) => void;
}

const Spinner: React.FC = () => (
  <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 light:bg-atlas-primary" />
  </span>
);

const PausedDot: React.FC = () => <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400 light:bg-amber-500" aria-hidden="true" />;

const TaskRow: React.FC<{ task: BackgroundTaskEntry; onOpen: () => void; onEnd: () => void }> = ({ task, onOpen, onEnd }) => (
  <div className="flex min-w-0 items-center gap-3">
    {task.busy ? <Spinner /> : <PausedDot />}
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-white" title={task.label}>{task.label}</p>
      <p className="truncate text-xs text-gray-500">
        {task.section}{task.detail ? ` · ${task.detail}` : task.busy ? ' · Working…' : ' · Waiting for you'}
      </p>
    </div>
    <button type="button" onClick={onOpen}
      className="h-8 shrink-0 rounded-lg bg-emerald-400/10 px-3 text-xs font-bold text-emerald-300 ring-1 ring-inset ring-emerald-400/30 transition hover:bg-emerald-400/20 light:bg-brand-pale light:text-brand-deep light:ring-brand-line">
      Open
    </button>
    <button type="button" onClick={onEnd}
      className="h-8 shrink-0 rounded-lg px-3 text-xs font-semibold text-gray-400 ring-1 ring-inset ring-white/10 transition hover:bg-rose-500/10 hover:text-rose-300 hover:ring-rose-400/30 light:ring-gray-700">
      End
    </button>
  </div>
);

const BackgroundTaskBar: React.FC<Props> = ({ tasks, onOpen, onEnd }) => {
  const [expanded, setExpanded] = useState(false);
  if (tasks.length === 0) return null;
  const [first, ...rest] = tasks;
  const anyBusy = tasks.some(t => t.busy);

  return (
    <div role="status" aria-live="polite" className="relative z-20 shrink-0 border-t border-white/[0.06] bg-atlas-soft/95 backdrop-blur-xl light:border-gray-700 light:bg-paper/95 animate-fade-in">
      {expanded && rest.length > 0 && (
        <div className="absolute inset-x-3 bottom-full mb-2 space-y-3 rounded-2xl bg-atlas-raised p-4 ring-1 ring-white/10 shadow-[0_-20px_40px_-20px_rgb(var(--shadow-rgb)/calc(0.8*var(--shadow-k)))] animate-menu-in sm:inset-x-auto sm:right-6 sm:w-[28rem] light:bg-paper light:ring-gray-700">
          {rest.map(task => (
            <TaskRow key={task.view} task={task} onOpen={() => { setExpanded(false); onOpen(task.view); }} onEnd={() => onEnd(task.view)} />
          ))}
        </div>
      )}
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-5 sm:px-8">
        <div className="flex shrink-0 items-center gap-2">
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg ring-1 ring-inset ${anyBusy ? 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30 light:bg-brand-pale light:text-brand-deep light:ring-brand-line' : 'bg-amber-400/10 text-amber-300 ring-amber-400/30'}`}>
            <svg className={`h-4 w-4 ${anyBusy ? 'animate-spin [animation-duration:2.4s]' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </span>
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
            Running in background{tasks.length > 1 ? ` · ${tasks.length}` : ''}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <TaskRow task={first} onOpen={() => onOpen(first.view)} onEnd={() => onEnd(first.view)} />
        </div>
        {rest.length > 0 && (
          <button type="button" onClick={() => setExpanded(v => !v)} aria-expanded={expanded}
            className="h-8 shrink-0 self-start rounded-lg px-3 text-xs font-bold text-gray-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] sm:self-auto light:ring-gray-700 light:hover:bg-gray-800">
            {expanded ? 'Hide' : `+${rest.length} more`}
          </button>
        )}
      </div>
    </div>
  );
};

export default BackgroundTaskBar;
