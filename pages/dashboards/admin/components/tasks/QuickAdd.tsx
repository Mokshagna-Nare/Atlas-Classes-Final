import React, { useEffect, useRef, useState } from 'react';
import { ICONS, Svg, primaryBtn, secondaryBtn } from '../../../../../components/ui/admin';
import { messageOf, useTasks } from './TasksContext';
import { FormValue, MIC, TaskForm } from './TaskParts';
import { emptyDraft } from './taskModel';
import VoiceAssistant from './voice/VoiceAssistant';

// The floating "add a task" button, on every admin screen (bottom-right, above the background
// task bar), and its panel: speak a task, or type it. New tasks are pre-tagged with the
// section that's open.

const TypedTask: React.FC<{ currentArea: string | null }> = ({ currentArea }) => {
  const { admins, me, areas, create, addTag, openTask } = useTasks();
  const start = (): FormValue => ({ ...emptyDraft(currentArea ? [currentArea] : []) });
  const [form, setForm] = useState<FormValue>(start);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; title: string } | null>(null);

  const submit = async () => {
    if (!form.title.trim()) { setError('Write what needs doing first.'); return; }
    setSaving(true);
    setError(null);
    try {
      const [task] = await create([{ ...form, title: form.title.trim(), details: form.details.trim(), source: 'typed' }]);
      setSaved({ id: task.id, title: task.title });
      setForm(start());
    } catch (err) {
      setError(messageOf(err, "Couldn't save the task."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={e => { e.preventDefault(); submit(); }} onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }} className="space-y-4">
      {saved && (
        <div className="flex items-center gap-3 rounded-xl bg-emerald-400/10 px-3 py-2.5 text-sm ring-1 ring-inset ring-emerald-400/30 animate-success-pop light:bg-brand-pale light:ring-brand-line">
          <Svg d={ICONS.check} className="h-4 w-4 shrink-0 text-emerald-300 light:text-brand-deep" />
          <span className="min-w-0 flex-1 truncate text-emerald-50 light:text-brand-deep">Saved “{saved.title}”</span>
          <button type="button" onClick={() => openTask(saved.id)} className="text-xs font-bold text-emerald-200 hover:text-white light:text-brand-deep">Open</button>
        </div>
      )}
      <TaskForm value={form} onChange={patch => { setSaved(null); setForm(prev => ({ ...prev, ...patch })); }} admins={admins} me={me} areas={areas} onCreateTag={addTag} autoFocus idPrefix="quick" />
      {error && <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-200 ring-1 ring-inset ring-rose-400/30">{error}</p>}
      <button type="submit" disabled={saving || !form.title.trim()} className={`${primaryBtn} h-11 w-full text-sm`}>
        {saving ? 'Saving…' : 'Add task'}
      </button>
      <p className="text-center text-[11px] text-gray-500">Tip: ⌘/Ctrl + Enter saves.</p>
    </form>
  );
};

const QuickAdd: React.FC<{ currentArea: string | null; onOpenBoard: () => void }> = ({ currentArea, onOpenBoard }) => {
  const { quickAdd, setQuickAdd, setupNeeded, counts } = useTasks();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'voice' | 'type'>('voice');

  useEffect(() => { if (quickAdd) setMode(quickAdd); }, [quickAdd]);

  useEffect(() => {
    if (!quickAdd) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"][aria-modal="true"]')) setQuickAdd(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [quickAdd, setQuickAdd]);

  // Shortcut: Alt + T opens / closes quick add.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && !e.metaKey && !e.ctrlKey && e.code === 'KeyT') {
        e.preventDefault();
        setQuickAdd(quickAdd ? null : 'voice');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [quickAdd, setQuickAdd]);

  return (
    <>
      {quickAdd && (
        <div ref={panelRef} role="dialog" aria-label="Add a task"
          className="pointer-events-auto absolute bottom-24 right-3 z-40 flex max-h-[calc(100%-7rem)] w-[min(27rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-3xl bg-gradient-to-b from-atlas-raised to-atlas-dark text-white ring-1 ring-white/10 shadow-[0_30px_80px_-20px_rgb(var(--shadow-rgb)/calc(0.95*var(--shadow-k)))] animate-sheet-in sm:right-6 light:from-paper light:to-paper light:ring-gray-700">
          <header className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3 light:border-gray-700">
            <div className="grid flex-1 grid-cols-2 rounded-xl bg-black/30 p-1 ring-1 ring-inset ring-white/10 light:bg-gray-800 light:ring-gray-700" role="tablist">
              {(['voice', 'type'] as const).map(option => (
                <button key={option} type="button" role="tab" aria-selected={mode === option} onClick={() => setMode(option)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition ${mode === option ? 'bg-emerald-400/20 text-white ring-1 ring-inset ring-emerald-400/40 light:bg-gray-100 light:text-on-accent light:ring-0' : 'text-gray-400 hover:text-white'}`}>
                  <Svg d={option === 'voice' ? MIC : ICONS.edit} className="h-3.5 w-3.5" /> {option === 'voice' ? 'Speak' : 'Type'}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => { setQuickAdd(null); onOpenBoard(); }} className="text-xs font-semibold text-gray-400 hover:text-white" title="Open the Tasks board">
              All tasks{counts.active ? ` (${counts.active})` : ''}
            </button>
            <button type="button" onClick={() => setQuickAdd(null)} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 ring-1 ring-inset ring-white/10 hover:text-white light:ring-gray-700">
              <Svg d={ICONS.close} />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            {setupNeeded ? (
              <SetupNotice />
            ) : mode === 'voice' ? (
              <VoiceAssistant currentArea={currentArea} />
            ) : (
              <TypedTask currentArea={currentArea} />
            )}
          </div>
        </div>
      )}

      <div className="pointer-events-auto absolute bottom-5 right-3 z-40 flex items-center overflow-hidden rounded-full bg-gradient-to-b from-emerald-400 to-emerald-500 text-gray-950 shadow-[0_18px_40px_-14px_rgba(16,185,129,0.95)] ring-1 ring-emerald-300/40 sm:right-6 light:from-atlas-primary light:to-atlas-primary light:text-on-accent light:ring-0">
        <button type="button" onClick={() => setQuickAdd(quickAdd === 'voice' ? null : 'voice')} aria-label="Speak a task (Alt+T)" title="Speak a task (Alt+T)" aria-expanded={quickAdd === 'voice'}
          className="flex h-12 items-center gap-2 pl-4 pr-3 text-sm font-bold transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70">
          <Svg d={MIC} className="h-5 w-5" />
          <span className="hidden sm:inline">Task</span>
        </button>
        <span className="h-6 w-px bg-gray-950/20 light:bg-white/30" aria-hidden="true" />
        <button type="button" onClick={() => setQuickAdd(quickAdd === 'type' ? null : 'type')} aria-label="Type a new task" title="Type a new task" aria-expanded={quickAdd === 'type'}
          className="flex h-12 w-12 items-center justify-center transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70">
          <Svg d={quickAdd ? ICONS.close : ICONS.plus} className="h-5 w-5" />
        </button>
      </div>
    </>
  );
};

export const SetupNotice: React.FC = () => (
  <div className="space-y-3 rounded-2xl bg-amber-400/[0.06] p-4 text-sm text-amber-100 ring-1 ring-inset ring-amber-400/25 light:text-amber-900">
    <p className="font-bold">Tasks needs a one-time database setup</p>
    <ol className="list-decimal space-y-1 pl-5 text-amber-100/90 light:text-amber-900">
      <li>Open Supabase → <b>SQL Editor</b> → <b>New query</b>.</li>
      <li>Paste the contents of <code className="rounded bg-black/30 px-1 light:bg-amber-100">backend/migrations/006_admin_tasks.sql</code> and click <b>Run</b>.</li>
      <li>Come back here and refresh the page.</li>
    </ol>
  </div>
);

export default QuickAdd;
