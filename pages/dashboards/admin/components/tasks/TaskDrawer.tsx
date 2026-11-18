import React, { useEffect, useMemo, useState } from 'react';
import ModalPortal from '../../../../../components/ModalPortal';
import { ICONS, Svg, dangerBtn, primaryBtn, secondaryBtn, textareaCls } from '../../../../../components/ui/admin';
import { messageOf, useTasks } from './TasksContext';
import { Avatar, DueLabel, FormValue, MIC, PriorityBadge, StatusMenu, TaskForm, TypeChip } from './TaskParts';
import {
  PRIORITY_META, STATUS_META, Task, TaskChanges, TaskEvent, TaskStatus, TYPE_META, adminName, areaLabel, friendlyDay, istDay,
} from './taskModel';

// Right-hand panel for one task: edit everything, change status, read the history, comment.

const TIME = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
const when = (iso: string) => TIME.format(new Date(iso)).replace(/\b(am|pm)\b/, m => m.toUpperCase());

const formOf = (task: Task): FormValue => ({
  title: task.title, details: task.details, type: task.type, priority: task.priority, areas: task.areas, assignee_id: task.assignee_id, due_date: task.due_date,
});

const FIELDS: (keyof FormValue)[] = ['title', 'details', 'type', 'priority', 'areas', 'assignee_id', 'due_date'];

const TaskDrawer: React.FC = () => {
  const { tasks, admins, areas, me, openTaskId, openTask, update, remove, addTag, events, comment } = useTasks();
  const task = tasks.find(t => t.id === openTaskId) || null;

  const [form, setForm] = useState<FormValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<TaskEvent[] | null>(null);
  const [note, setNote] = useState('');
  const [posting, setPosting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showHeard, setShowHeard] = useState(false);

  // New task opened: reset the panel.
  useEffect(() => {
    setForm(task ? formOf(task) : null);
    setError(null);
    setNote('');
    setConfirmDelete(false);
    setShowHeard(false);
    setHistory(null);
    if (task) events(task.id).then(setHistory).catch(() => setHistory([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTaskId]);

  const dirty = useMemo(() => {
    if (!task || !form) return false;
    return FIELDS.some(field => JSON.stringify(form[field] ?? null) !== JSON.stringify((task as any)[field] ?? null));
  }, [form, task]);

  const close = () => {
    if (dirty && !window.confirm('Discard your unsaved changes to this task?')) return;
    openTask(null);
  };

  useEffect(() => {
    if (!task) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !e.defaultPrevented && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!task || !form) return null;

  const reloadHistory = () => events(task.id).then(setHistory).catch(() => undefined);

  const save = async () => {
    if (!form.title.trim()) { setError('The task needs a title.'); return; }
    setSaving(true);
    setError(null);
    const changes: TaskChanges = {};
    for (const field of FIELDS) {
      if (JSON.stringify(form[field] ?? null) !== JSON.stringify((task as any)[field] ?? null)) (changes as any)[field] = form[field];
    }
    try {
      await update(task.id, changes);
      reloadHistory();
    } catch (err) {
      setError(messageOf(err, "Couldn't save the changes."));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status: TaskStatus, extra?: { postponed_until: string | null; postpone_reason: string | null }) => {
    setError(null);
    try {
      await update(task.id, { status, ...(extra || {}) }, extra?.postpone_reason || null);
      reloadHistory();
    } catch (err) {
      setError(messageOf(err, "Couldn't change the status."));
    }
  };

  const postComment = async () => {
    if (!note.trim()) return;
    setPosting(true);
    try {
      const event = await comment(task.id, note.trim());
      setHistory(prev => [...(prev || []), event]);
      setNote('');
    } catch (err) {
      setError(messageOf(err, "Couldn't post the comment."));
    } finally {
      setPosting(false);
    }
  };

  const doDelete = async () => {
    try {
      await remove(task.id);
    } catch (err) {
      setError(messageOf(err, "Couldn't delete the task."));
    }
  };

  const describe = (event: TaskEvent): string[] => {
    if (event.kind === 'created') return [`created this task${(event.changes as any)?.source === 'voice' ? ' by voice' : ''}`];
    const lines: string[] = [];
    for (const [field, pair] of Object.entries(event.changes || {})) {
      if (!Array.isArray(pair)) continue;
      const [, to] = pair as [any, any];
      if (field === 'status') lines.push(`moved it to ${STATUS_META[to as TaskStatus]?.label || to}`);
      else if (field === 'priority') lines.push(`set priority to ${PRIORITY_META[to as keyof typeof PRIORITY_META]?.label || to}`);
      else if (field === 'type') lines.push(`set type to ${TYPE_META[to as keyof typeof TYPE_META]?.label || to}`);
      else if (field === 'due_date') lines.push(to ? `set the due date to ${friendlyDay(to)}` : 'removed the due date');
      else if (field === 'postponed_until') { if (to) lines.push(`postponed it until ${friendlyDay(to)}`); }
      else if (field === 'postpone_reason') { if (to) lines.push(`gave the reason “${to}”`); }
      else if (field === 'assignee_id') lines.push(to ? `assigned it to ${adminName(to, admins, me)}` : 'unassigned it');
      else if (field === 'areas') lines.push(`set the tags to ${(to as string[]).map(slug => areaLabel(slug, areas)).join(', ') || 'none'}`);
      else if (field === 'title') lines.push('renamed it');
      else if (field === 'details') lines.push('edited the details');
    }
    return lines.length ? lines : ['updated the task'];
  };

  const today = istDay();

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[85] flex justify-end bg-scrim/60 backdrop-blur-sm animate-fade-in" onMouseDown={e => e.target === e.currentTarget && close()}>
        <aside role="dialog" aria-modal="true" aria-label={`Task: ${task.title}`}
          className="flex h-full w-full max-w-xl flex-col bg-gradient-to-b from-atlas-raised to-atlas-dark text-white shadow-[-30px_0_80px_-20px_rgb(var(--shadow-rgb)/calc(0.9*var(--shadow-k)))] ring-1 ring-white/10 animate-slide-in-right light:from-paper light:to-paper light:ring-gray-700">
          <header className="flex items-start gap-3 border-b border-white/[0.06] px-5 py-4 light:border-gray-700">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusMenu status={task.status} onChange={setStatus} />
                <TypeChip type={task.type} />
                <PriorityBadge priority={task.priority} quiet />
                <DueLabel task={task} />
              </div>
              <h2 className="text-lg font-bold leading-snug tracking-tight">{task.title}</h2>
            </div>
            <button type="button" onClick={close} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] hover:text-white light:ring-gray-700">
              <Svg d={ICONS.close} />
            </button>
          </header>

          <div className="flex-1 space-y-6 overflow-y-auto custom-scrollbar px-5 py-5">
            {task.status !== 'completed' && task.status !== 'cancelled' && (
              <div className="flex flex-wrap gap-2">
                {task.status !== 'in_progress' && (
                  <button type="button" onClick={() => setStatus('in_progress')} className={`${secondaryBtn} h-9 px-3 text-xs`}>Start working</button>
                )}
                <button type="button" onClick={() => setStatus('completed')} className={`${primaryBtn} h-9 px-3 text-xs`}>
                  <Svg d={ICONS.check} /> Mark completed
                </button>
              </div>
            )}
            {(task.status === 'completed' || task.status === 'cancelled') && (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-4 py-3 text-sm text-gray-300 ring-1 ring-inset ring-white/[0.06] light:bg-gray-950 light:ring-gray-700">
                <span>{task.status === 'completed' ? `Completed ${task.completed_at ? when(task.completed_at) : ''}` : 'Cancelled'}</span>
                <button type="button" onClick={() => setStatus('todo')} className={`${secondaryBtn} h-8 px-3 text-xs`}>Reopen</button>
              </div>
            )}
            {task.status === 'postponed' && (
              <div className="rounded-xl bg-violet-400/[0.07] px-4 py-3 text-sm text-violet-100 ring-1 ring-inset ring-violet-400/25 light:text-violet-900">
                Postponed{task.postponed_until ? ` until ${friendlyDay(task.postponed_until, today)}` : ''}.{task.postpone_reason ? ` Reason: ${task.postpone_reason}` : ''}
              </div>
            )}

            <TaskForm value={form} onChange={patch => setForm(prev => (prev ? { ...prev, ...patch } : prev))} admins={admins} me={me} areas={areas} onCreateTag={addTag} idPrefix="drawer" />

            {error && <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-200 ring-1 ring-inset ring-rose-400/30">{error}</p>}

            <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
              <span>Created by {adminName(task.created_by, admins, me)} · {when(task.created_at)}</span>
              {task.source === 'voice' && task.voice_transcript && (
                <button type="button" onClick={() => setShowHeard(v => !v)} className="inline-flex items-center gap-1 font-semibold text-gray-400 hover:text-white">
                  <Svg d={MIC} className="h-3.5 w-3.5" /> {showHeard ? 'Hide' : 'What was said'}
                </button>
              )}
            </div>
            {showHeard && task.voice_transcript && (
              <blockquote className="rounded-xl bg-black/20 px-4 py-3 text-sm italic text-gray-300 ring-1 ring-inset ring-white/[0.06] light:bg-gray-950 light:ring-gray-700">“{task.voice_transcript}”</blockquote>
            )}

            <section aria-label="Activity">
              <h3 className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">Activity</h3>
              {history === null ? (
                <p className="text-sm text-gray-500 animate-pulse">Loading history…</p>
              ) : (
                <ol className="relative space-y-4 border-l border-white/10 pl-5 light:border-gray-700">
                  {history.map(event => (
                    <li key={event.id} className="relative">
                      <span className="absolute -left-[29px] top-0.5"><Avatar id={event.actor_id} admins={admins} me={me} /></span>
                      <p className="text-sm text-gray-300">
                        <span className="font-semibold text-white">{adminName(event.actor_id, admins, me)}</span>{' '}
                        {event.kind === 'comment' && !Object.keys(event.changes || {}).length ? 'commented' : describe(event).join(', ')}
                        <span className="ml-2 text-xs text-gray-500">{when(event.created_at)}</span>
                      </p>
                      {event.comment && <p className="mt-1.5 whitespace-pre-wrap rounded-xl bg-white/[0.04] px-3 py-2 text-sm text-gray-200 ring-1 ring-inset ring-white/[0.06] light:bg-gray-950 light:ring-gray-700">{event.comment}</p>}
                    </li>
                  ))}
                </ol>
              )}
              <div className="mt-4 flex gap-2">
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={2000} placeholder="Add a comment or progress note…"
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postComment(); }} className={`${textareaCls} flex-1`} />
                <button type="button" onClick={postComment} disabled={!note.trim() || posting} className={`${secondaryBtn} self-end h-10 px-4 text-sm`}>
                  {posting ? 'Posting…' : 'Post'}
                </button>
              </div>
            </section>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] bg-black/20 px-5 py-4 light:border-gray-700 light:bg-gray-950">
            {confirmDelete ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-rose-200">
                Delete this task and its history?
                <button type="button" onClick={doDelete} className={`${dangerBtn} h-9 px-3 text-xs`}>Delete</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className={`${secondaryBtn} h-9 px-3 text-xs`}>Keep</button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 transition hover:text-rose-300">
                <Svg d={ICONS.trash} /> Delete
              </button>
            )}
            <div className="flex gap-2">
              {dirty && <button type="button" onClick={() => setForm(formOf(task))} className={`${secondaryBtn} h-10 px-4 text-sm`}>Undo changes</button>}
              <button type="button" onClick={save} disabled={!dirty || saving} className={`${primaryBtn} h-10 px-5 text-sm`}>
                {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
              </button>
            </div>
          </footer>
        </aside>
      </div>
    </ModalPortal>
  );
};

export default TaskDrawer;
