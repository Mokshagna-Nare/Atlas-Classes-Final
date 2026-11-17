import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ICONS, Svg, inputCls, primaryBtn, secondaryBtn } from '../../../../../../components/ui/admin';
import { messageOf, useTasks } from '../TasksContext';
import { DueLabel, MIC, StatusPill, TaskForm } from '../TaskParts';
import { TaskDraft, adminName, istDay } from '../taskModel';
import { DraftNote, Understanding, UnderstandContext, confirmWord, refineDrafts, understand } from './understand';
import { SPEECH_LANGS, SpeechLang, speak, stopSpeaking, useSpeech } from './useSpeech';

// "Speak a task": listen → understand → show it for confirmation → save. Hands-free follow-ups
// ("save", "cancel", "make it urgent") work while a draft is on screen. A command box below
// does the same for typed commands (and for browsers without speech recognition).

type Draft = TaskDraft & { notes: DraftNote };
type Phase =
  | { name: 'idle' }
  | { name: 'result'; result: Understanding }
  | { name: 'saving' }
  | { name: 'done'; message: string; taskIds: string[] };

const TODAY_LABEL = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' });

const EXAMPLES = [
  'Add a high priority bug in the student portal: login fails after OTP, due Friday',
  'Two tasks: upload NEET physics papers to MCQ upload, and fix the footer on the website',
  'Mark the login error task as completed',
  'Postpone the question bank filters to next Monday, waiting for data',
  "What's pending in MCQ upload?",
  'Question bank lo filters fix cheyyali, repu, mukhyam',
];

const readSetting = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : (JSON.parse(value) as T);
  } catch {
    return fallback;
  }
};
const writeSetting = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* optional */ }
};

const Waveform: React.FC<{ level: number; active: boolean }> = ({ level, active }) => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setTick(t => t + 1), 90);
    return () => window.clearInterval(timer);
  }, [active]);
  return (
    <div className="flex h-10 items-center justify-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => {
        const wave = 0.45 + 0.55 * Math.abs(Math.sin(i * 0.62 + tick * 0.55));
        const height = active ? 4 + Math.min(1, level * 1.6) * 34 * wave : 4;
        return <span key={i} className="w-[3px] rounded-full bg-emerald-400/80 transition-[height] duration-100 light:bg-atlas-primary" style={{ height }} />;
      })}
    </div>
  );
};

const VoiceAssistant: React.FC<{ currentArea?: string | null; onOpenTask?: (id: string) => void }> = ({ currentArea, onOpenTask }) => {
  const { tasks, admins, areas, me, lastTaskId, create, update, addTag, openTask } = useTasks();
  const [lang, setLang] = useState<SpeechLang>(() => readSetting('atlas-tasks-lang', 'en-IN'));
  const [speakReplies, setSpeakReplies] = useState<boolean>(() => readSetting('atlas-tasks-speak', true));
  const [handsFree, setHandsFree] = useState<boolean>(() => readSetting('atlas-tasks-handsfree', true));
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const followUps = useRef(0);
  const draftsRef = useRef<Draft[]>([]);
  draftsRef.current = drafts;

  useEffect(() => writeSetting('atlas-tasks-lang', lang), [lang]);
  useEffect(() => writeSetting('atlas-tasks-speak', speakReplies), [speakReplies]);
  useEffect(() => writeSetting('atlas-tasks-handsfree', handsFree), [handsFree]);

  const ctx: UnderstandContext = useMemo(() => ({
    tasks, admins, me, areas, today: istDay(),
    currentArea: currentArea && areas.some(area => area.slug === currentArea) ? currentArea : null,
    lastTaskId,
  }), [tasks, admins, me, areas, currentArea, lastTaskId]);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const vocabulary = useMemo(() => [
    ...areas.flatMap(area => [area.label.toLowerCase(), ...(area.aliases || [])]),
    ...admins.flatMap(admin => (admin.name || '').toLowerCase().split(/\s+/)),
    'task', 'bug', 'urgent', 'priority', 'postpone', 'completed', 'assign', 'due',
  ].filter(word => word.length >= 3), [areas, admins]);

  const say = useCallback((text: string) => (speakReplies ? speak(text, lang) : Promise.resolve()), [speakReplies, lang]);

  // ---- follow-up listener (yes / no / corrections) -------------------------------------------
  const followUpRef = useRef<(text: string) => void>(() => undefined);
  const confirm = useSpeech({ lang, short: true, vocabulary, onFinal: text => followUpRef.current(text) });

  const listenForFollowUp = useCallback(async (reply: string) => {
    await say(reply);
    if (handsFree && confirm.supported && followUps.current < 4) {
      followUps.current += 1;
      confirm.start();
    }
  }, [say, handsFree, confirm]);

  // ---- main listener ---------------------------------------------------------------------------
  const handleCommand = useCallback((text: string) => {
    setError(null);
    setNotice(null);
    followUps.current = 0;
    const result = understand(text, ctxRef.current);
    setPhase({ name: 'result', result });

    if (result.kind === 'create') {
      setDrafts(result.drafts);
      const count = result.drafts.length;
      listenForFollowUp(`${count === 1 ? 'Got it' : `Got ${count} tasks`}. Say save, or tell me what to change.`);
    } else if (result.kind === 'update') {
      setChosen(result.candidates.length === 1 ? result.candidates[0].id : null);
      listenForFollowUp(result.candidates.length === 1 ? `${result.summary}. Say yes to confirm.` : 'I found a few matching tasks. Pick the right one.');
    } else if (result.kind === 'query') {
      say(result.answer);
    } else {
      say(result.message);
    }
  }, [listenForFollowUp, say]);

  const main = useSpeech({ lang, vocabulary, onFinal: handleCommand });

  const reset = useCallback(() => {
    confirm.cancel();
    stopSpeaking();
    setPhase({ name: 'idle' });
    setDrafts([]);
    setChosen(null);
    setError(null);
    setNotice(null);
  }, [confirm]);

  const startListening = () => {
    confirm.cancel();
    stopSpeaking();
    setError(null);
    setNotice(null);
    setPhase({ name: 'idle' });
    main.start();
  };

  // ---- saving ----------------------------------------------------------------------------------
  const saveDrafts = useCallback(async () => {
    const list = draftsRef.current;
    if (!list.length) return;
    if (list.some(draft => !draft.title.trim())) { setError('Every task needs a title.'); return; }
    confirm.cancel();
    setPhase({ name: 'saving' });
    try {
      const created = await create(list.map(({ notes, ...draft }) => draft));
      const message = created.length === 1 ? `Saved “${created[0].title}”.` : `Saved ${created.length} tasks.`;
      setPhase({ name: 'done', message, taskIds: created.map(task => task.id) });
      say(created.length === 1 ? 'Saved.' : `Saved ${created.length} tasks.`);
    } catch (err) {
      setError(messageOf(err, "Couldn't save. Please try again."));
      setPhase(prev => (prev.name === 'saving' ? { name: 'result', result: { kind: 'create', heard: '', drafts: list } } : prev));
    }
  }, [confirm, create, say]);

  const applyUpdate = useCallback(async () => {
    if (phase.name !== 'result' || phase.result.kind !== 'update') return;
    const { changes, note, candidates } = phase.result;
    const id = chosen || (candidates.length === 1 ? candidates[0].id : null);
    if (!id) { setError('Choose which task you meant.'); return; }
    confirm.cancel();
    setPhase({ name: 'saving' });
    try {
      const task = await update(id, changes, note);
      setPhase({ name: 'done', message: `Updated “${task.title}”.`, taskIds: [task.id] });
      say('Done.');
    } catch (err) {
      setError(messageOf(err, "Couldn't update the task."));
      setPhase({ name: 'result', result: phase.result });
    }
  }, [phase, chosen, confirm, update, say]);

  followUpRef.current = (text: string) => {
    const word = confirmWord(text);
    if (phase.name !== 'result') return;
    const kind = phase.result.kind;

    if (word === 'no') { reset(); say('Cancelled.'); return; }
    if (word === 'yes') {
      if (kind === 'create') saveDrafts();
      else if (kind === 'update') applyUpdate();
      return;
    }
    if (kind === 'create') {
      const refined = refineDrafts(draftsRef.current, text, ctxRef.current);
      if (refined) {
        setDrafts(refined.drafts);
        setNotice(`Changed: ${refined.changed.join(', ')}.`);
        listenForFollowUp('Updated. Say save when ready.');
        return;
      }
    }
    setNotice(`Heard “${text}”. Say “save”, “cancel”, or a change like “make it urgent”.`);
    listenForFollowUp('Say save, cancel, or what to change.');
  };

  // Auto-return to the start a moment after saving.
  useEffect(() => {
    if (phase.name !== 'done') return;
    const timer = window.setTimeout(() => setPhase(prev => (prev.name === 'done' ? { name: 'idle' } : prev)), 6000);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const listening = main.status !== 'idle';
  const result = phase.name === 'result' ? phase.result : null;
  const speechError = main.error || confirm.error;

  return (
    <div className="space-y-4">
      {/* Mic + live transcript */}
      {(phase.name === 'idle' || listening) && (
        <div className="rounded-2xl bg-black/20 p-5 text-center ring-1 ring-inset ring-white/[0.06] light:bg-gray-950 light:ring-gray-700">
          <div className="relative mx-auto h-20 w-20">
            {listening && <span className="absolute inset-0 rounded-full bg-emerald-400/25 transition-transform duration-100" style={{ transform: `scale(${1.15 + main.level * 0.6})` }} aria-hidden="true" />}
            <button type="button" onClick={listening ? main.stop : startListening} disabled={main.status === 'finishing'}
              aria-label={listening ? 'Stop and use what I said' : 'Start speaking'}
              className={`relative flex h-20 w-20 items-center justify-center rounded-full text-gray-950 shadow-[0_16px_40px_-12px_rgba(16,185,129,0.9)] transition active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/40 ${listening ? 'bg-rose-400' : 'bg-gradient-to-b from-emerald-300 to-emerald-500 light:from-atlas-primary light:to-atlas-primary light:text-on-accent'}`}>
              {listening ? <span className="h-6 w-6 rounded-md bg-gray-950" /> : <Svg d={MIC} className="h-9 w-9" />}
            </button>
          </div>
          <Waveform level={main.level} active={listening} />
          <p className="min-h-[2.75rem] text-sm leading-relaxed" aria-live="polite">
            {listening ? (
              main.finalText || main.interim
                ? <><span className="text-white">{main.finalText} </span><span className="text-gray-500">{main.interim}</span></>
                : <span className="text-gray-400">{main.status === 'finishing' ? 'Finishing…' : 'Listening… say the task, then pause.'}</span>
            ) : (
              <span className="text-gray-400">Tap the mic and speak. I'll show you what I understood before anything is saved.</span>
            )}
          </p>
          {listening && (
            <div className="mt-2 flex justify-center gap-2">
              <button type="button" onClick={main.stop} className={`${primaryBtn} h-9 px-4 text-xs`}>Done</button>
              <button type="button" onClick={main.cancel} className={`${secondaryBtn} h-9 px-4 text-xs`}>Cancel</button>
            </div>
          )}
          {!listening && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5" role="radiogroup" aria-label="Language">
              {SPEECH_LANGS.map(option => (
                <button key={option.value} type="button" role="radio" aria-checked={lang === option.value} title={option.hint} onClick={() => setLang(option.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ring-1 ring-inset transition ${lang === option.value ? 'bg-emerald-400/15 text-emerald-100 ring-emerald-400/50 light:bg-brand-pale light:text-brand-deep light:ring-brand-line' : 'text-gray-400 ring-white/10 hover:text-white light:ring-gray-700'}`}>
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {speechError && <p role="alert" className="rounded-xl bg-amber-400/[0.08] px-3 py-2 text-sm text-amber-200 ring-1 ring-inset ring-amber-400/25">{speechError}</p>}

      {/* Result */}
      {result && (
        <div className="space-y-3 animate-fade-in">
          {result.heard && (
            <p className="flex items-start gap-2 text-xs text-gray-500">
              <Svg d={MIC} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Heard: <span className="italic text-gray-300">“{result.heard}”</span></span>
            </p>
          )}

          {result.kind === 'create' && (
            <>
              {drafts.map((draft, index) => (
                <div key={index} className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-inset ring-emerald-400/25 light:bg-paper light:ring-brand-line">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-300 light:text-brand-deep">
                      New task{drafts.length > 1 ? ` ${index + 1} of ${drafts.length}` : ''}
                    </p>
                    {drafts.length > 1 && (
                      <button type="button" onClick={() => setDrafts(prev => prev.filter((_, i) => i !== index))} className="text-xs font-semibold text-gray-500 hover:text-rose-300">Remove</button>
                    )}
                  </div>
                  <TaskForm compact idPrefix={`voice-${index}`} value={draft} admins={admins} me={me} areas={areas} onCreateTag={addTag}
                    onChange={patch => setDrafts(prev => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))} />
                  {draft.notes.usedCurrentArea && <p className="mt-2 text-[11px] text-gray-500">Tagged with the section you're in. Change it if needed.</p>}
                </div>
              ))}
              <div className="flex gap-2">
                <button type="button" onClick={saveDrafts} disabled={!drafts.length} className={`${primaryBtn} h-11 flex-1 text-sm`}>
                  <Svg d={ICONS.check} /> {drafts.length > 1 ? `Save ${drafts.length} tasks` : 'Save task'}
                </button>
                <button type="button" onClick={reset} className={`${secondaryBtn} h-11 px-4 text-sm`}>Discard</button>
              </div>
            </>
          )}

          {result.kind === 'update' && (
            <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-inset ring-sky-400/25 light:bg-paper light:ring-gray-700">
              <p className="mb-1 text-[11px] font-black uppercase tracking-[0.16em] text-sky-300 light:text-sky-700">Update a task</p>
              <p className="mb-3 text-sm text-white">{result.summary.charAt(0).toUpperCase() + result.summary.slice(1)}</p>
              {result.candidates.length > 1 && <p className="mb-2 text-xs text-gray-400">A few tasks match “{result.target}”. Which one?</p>}
              <div className="space-y-2" role="radiogroup">
                {result.candidates.map(task => {
                  const on = chosen === task.id || result.candidates.length === 1;
                  return (
                    <button key={task.id} type="button" role="radio" aria-checked={on} onClick={() => setChosen(task.id)}
                      className={`flex w-full items-start gap-3 rounded-xl p-3 text-left ring-1 ring-inset transition ${on ? 'bg-sky-400/10 ring-sky-400/40' : 'ring-white/10 hover:bg-white/[0.04] light:ring-gray-700'}`}>
                      <span className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full ring-2 ${on ? 'bg-sky-400 ring-sky-400' : 'ring-gray-500'}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-white">{task.title}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-2"><StatusPill status={task.status} /><DueLabel task={task} /></span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={applyUpdate} disabled={!chosen && result.candidates.length > 1} className={`${primaryBtn} h-11 flex-1 text-sm`}>
                  <Svg d={ICONS.check} /> Confirm
                </button>
                <button type="button" onClick={reset} className={`${secondaryBtn} h-11 px-4 text-sm`}>Cancel</button>
              </div>
            </div>
          )}

          {result.kind === 'query' && (
            <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-inset ring-white/10 light:bg-paper light:ring-gray-700">
              <p className="text-sm text-white">{result.answer}</p>
              {result.tasks.length > 0 && (
                <ul className="mt-3 divide-y divide-white/[0.06] light:divide-gray-700">
                  {result.tasks.slice(0, 8).map(task => (
                    <li key={task.id}>
                      <button type="button" onClick={() => (onOpenTask || openTask)(task.id)} className="flex w-full items-center gap-3 py-2 text-left hover:text-emerald-200">
                        <StatusPill status={task.status} />
                        <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
                        <span className="shrink-0 text-[11px] text-gray-500">{task.assignee_id ? adminName(task.assignee_id, admins, me) : ''}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" onClick={startListening} className={`${secondaryBtn} mt-3 h-9 px-3 text-xs`}><Svg d={MIC} /> Ask something else</button>
            </div>
          )}

          {result.kind === 'none' && (
            <div className="rounded-2xl bg-amber-400/[0.06] p-4 ring-1 ring-inset ring-amber-400/25">
              <p className="text-sm text-amber-100 light:text-amber-900">{result.message}</p>
              <button type="button" onClick={startListening} className={`${secondaryBtn} mt-3 h-9 px-3 text-xs`}><Svg d={MIC} /> Try again</button>
            </div>
          )}

          {(result.kind === 'create' || result.kind === 'update') && (
            <p className="flex items-center gap-2 text-[11px] text-gray-500" aria-live="polite">
              {confirm.status !== 'idle' ? (
                <><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Listening for “save”, “cancel” or a change…</>
              ) : handsFree && confirm.supported ? (
                <button type="button" onClick={() => { followUps.current = 0; confirm.start(); }} className="inline-flex items-center gap-1 font-semibold hover:text-white">
                  <Svg d={MIC} className="h-3.5 w-3.5" /> Say “save”, “cancel” or a change
                </button>
              ) : null}
            </p>
          )}
          {notice && <p className="text-xs text-emerald-200 light:text-brand-deep" aria-live="polite">{notice}</p>}
        </div>
      )}

      {phase.name === 'saving' && <p className="text-center text-sm text-gray-400 animate-pulse">Saving…</p>}

      {phase.name === 'done' && (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-400/10 p-4 ring-1 ring-inset ring-emerald-400/30 animate-success-pop light:bg-brand-pale light:ring-brand-line">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-gray-950"><Svg d={ICONS.check} className="h-5 w-5" /></span>
          <p className="min-w-0 flex-1 text-sm font-semibold text-emerald-50 light:text-brand-deep">{phase.message}</p>
          {phase.taskIds.length === 1 && (
            <button type="button" onClick={() => (onOpenTask || openTask)(phase.taskIds[0])} className="text-xs font-bold text-emerald-200 hover:text-white light:text-brand-deep">Open</button>
          )}
          <button type="button" onClick={startListening} className="text-xs font-bold text-emerald-200 hover:text-white light:text-brand-deep">Add another</button>
        </div>
      )}

      {error && <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-200 ring-1 ring-inset ring-rose-400/30">{error}</p>}

      {/* Typed command — same understanding, for any browser */}
      <form onSubmit={e => { e.preventDefault(); if (typed.trim()) { handleCommand(typed.trim()); setTyped(''); } }} className="flex gap-2">
        <input value={typed} onChange={e => setTyped(e.target.value)} maxLength={1000} aria-label="Type a command"
          placeholder={main.supported ? 'Or type it the same way…' : 'Type a command, e.g. “add a bug in question bank…”'} className={`${inputCls} h-10 flex-1`} />
        <button type="submit" disabled={!typed.trim()} className={`${secondaryBtn} h-10 px-3 text-xs`}>Go</button>
      </form>

      {phase.name === 'idle' && !listening && (
        <details className="group rounded-xl text-xs text-gray-500">
          <summary className="cursor-pointer list-none font-semibold text-gray-400 hover:text-white">
            <span className="inline-flex items-center gap-1"><Svg d={ICONS.sparkles} className="h-3.5 w-3.5" /> Things you can say</span>
          </summary>
          <ul className="mt-2 space-y-1.5">
            {EXAMPLES.map(example => (
              <li key={example}>
                <button type="button" onClick={() => handleCommand(example)} className="text-left text-gray-400 hover:text-emerald-200 light:hover:text-brand-deep">“{example}”</button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-white/[0.06] pt-3 text-[11px] text-gray-500 light:border-gray-700">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={speakReplies} onChange={e => setSpeakReplies(e.target.checked)} className="h-3.5 w-3.5 accent-emerald-500" /> Read replies aloud
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={handsFree} onChange={e => setHandsFree(e.target.checked)} className="h-3.5 w-3.5 accent-emerald-500" /> Hands-free confirm
        </label>
        <span>Today: {TODAY_LABEL.format(new Date())}</span>
      </div>
    </div>
  );
};

export default VoiceAssistant;
