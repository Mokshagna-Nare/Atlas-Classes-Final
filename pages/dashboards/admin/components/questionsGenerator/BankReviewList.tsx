import React, { useEffect, useState } from 'react';
import MathText from './MathText';
import { Checkbox, Label, TextArea } from './ui';

// Review step before generated questions go into the question bank: every question is shown in
// full (options with the correct one marked, figure, explanation, review notes) and can be edited
// or removed. Nothing here is saved yet, so edits only change what will be added.

// A question formatted for Atlas's `mcqs` table by the service
// (superscripts as Unicode, answer = text of the correct option).
export interface BankRow {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  grade: string;
  subject: string;
  topic: string;
  sub_topic: string;
  question_type: string;
  difficulty: string;
  marks: number;
  type: 'Multiple Choice' | 'Short Answer';
  imageUrl: string | null;
  review_notes: string;
}

const LETTERS = 'ABCD';
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

const DIFFICULTY_STYLE: Record<string, string> = {
  easy: 'bg-emerald-500/10 text-emerald-300 ring-emerald-400/30',
  medium: 'bg-amber-500/10 text-amber-300 ring-amber-400/30',
  hard: 'bg-rose-500/10 text-rose-300 ring-rose-400/30',
};

const chip = 'inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset';
const actionBtn =
  'inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold ring-1 ring-inset transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40';
const fieldClass =
  'w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-sm text-white focus:border-green-500 outline-none transition-colors';

const Icon: React.FC<{ d: string; className?: string }> = ({ d, className = 'h-4 w-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);
const EDIT = 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125';
const TRASH = 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0';
const CHECK = 'M4.5 12.75l6 6 9-13.5';
const WARN = 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z';

// ---------- Editor ----------

const RowEditor: React.FC<{ row: BankRow; onSave: (row: BankRow) => void; onCancel: () => void }> = ({ row, onSave, onCancel }) => {
  const isMcq = row.type === 'Multiple Choice';
  const [draft, setDraft] = useState<BankRow>({ ...row, options: isMcq ? [...row.options] : [] });
  const [correct, setCorrect] = useState(isMcq ? row.options.findIndex(o => o === row.answer) : -1);
  const [reviewed, setReviewed] = useState(true);
  const set = <K extends keyof BankRow>(key: K, value: BankRow[K]) => setDraft(d => ({ ...d, [key]: value }));

  const problem = !draft.question.trim()
    ? 'The question text is empty.'
    : isMcq && draft.options.some(o => !o.trim())
      ? 'Fill in all four options.'
      : null;

  const save = () => {
    if (problem) return;
    const answer = isMcq ? (correct >= 0 ? draft.options[correct] : '') : draft.answer.trim();
    onSave({ ...draft, answer, review_notes: reviewed ? '' : draft.review_notes });
  };

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <TextArea label="Question" value={draft.question} onChange={v => set('question', v)} rows={4} />

      {isMcq ? (
        <div>
          <Label>Options · select the correct one</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {draft.options.map((opt, i) => (
              <div key={i} className={`flex items-center gap-2 rounded-xl p-1.5 pl-2.5 ring-1 ring-inset ${correct === i ? 'bg-emerald-500/10 ring-emerald-400/40' : 'ring-white/[0.06] light:ring-gray-700'}`}>
                <button type="button" onClick={() => setCorrect(i)} aria-pressed={correct === i} title="Mark as the correct answer"
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black transition ${correct === i ? 'bg-emerald-400 text-gray-950' : 'bg-white/[0.06] text-gray-400 hover:text-white light:bg-paper light:ring-1 light:ring-gray-700'}`}>
                  {LETTERS[i]}
                </button>
                <input value={opt} onChange={e => set('options', draft.options.map((o, j) => (j === i ? e.target.value : o)))}
                  className={fieldClass} aria-label={`Option ${LETTERS[i]}`} />
              </div>
            ))}
          </div>
          {correct < 0 && <p className="mt-2 text-xs font-semibold text-amber-300">No correct option selected — it will be added as flagged.</p>}
        </div>
      ) : (
        <div>
          <Label>Answer</Label>
          <input value={draft.answer} onChange={e => set('answer', e.target.value)} className={fieldClass} placeholder="Numerical answer" />
        </div>
      )}

      <TextArea label="Explanation" value={draft.explanation} onChange={v => set('explanation', v)} rows={3} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Difficulty</Label>
          <select value={draft.difficulty} onChange={e => set('difficulty', e.target.value)} className={fieldClass}>
            {Array.from(new Set([...DIFFICULTIES, draft.difficulty].filter(Boolean))).map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <Label>Sub-topic</Label>
          <input value={draft.sub_topic} onChange={e => set('sub_topic', e.target.value)} className={fieldClass} />
        </div>
      </div>

      {draft.imageUrl && (
        <div className="flex items-center gap-3">
          <img src={draft.imageUrl} alt="Question figure" className="h-16 rounded-lg bg-white p-1" />
          <button type="button" onClick={() => set('imageUrl', null)} className={`${actionBtn} text-rose-300 ring-rose-400/30 hover:bg-rose-500/10`}>
            <Icon d={TRASH} /> Remove figure
          </button>
        </div>
      )}

      {row.review_notes && (
        <Checkbox checked={reviewed} onChange={setReviewed}
          label={<>I've checked this question — clear its review note (<span className="text-amber-300">{row.review_notes}</span>)</>} />
      )}

      {problem && <p className="text-xs font-semibold text-rose-300">{problem}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={`${actionBtn} text-gray-300 ring-white/10 hover:bg-white/[0.06] light:ring-gray-700 light:hover:bg-gray-800`}>Cancel</button>
        <button type="button" onClick={save} disabled={!!problem}
          className={`${actionBtn} bg-green-600 text-on-accent ring-green-500 hover:bg-green-500`}>
          <Icon d={CHECK} /> Save changes
        </button>
      </div>
    </div>
  );
};

// ---------- One question ----------

const RowPreview: React.FC<{ row: BankRow }> = ({ row }) => {
  const isMcq = row.type === 'Multiple Choice';
  const correct = isMcq ? row.options.findIndex(o => o === row.answer) : -1;
  return (
    <div className="min-w-0 flex-1">
      <div className="text-[15px] font-medium leading-relaxed text-gray-100"><MathText text={row.question} /></div>
      {row.imageUrl && <img src={row.imageUrl} alt="Question figure" className="mt-3 max-h-56 rounded-xl bg-white p-2" />}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={`${chip} ${DIFFICULTY_STYLE[row.difficulty?.toLowerCase()] || 'bg-white/[0.04] text-gray-300 ring-white/10'}`}>{row.difficulty || '—'}</span>
        <span className={`${chip} bg-white/[0.04] text-gray-300 ring-white/10 light:ring-gray-700`}>{isMcq ? 'MCQ' : 'Numerical'}</span>
        {row.sub_topic && <span className={`${chip} max-w-[260px] truncate bg-white/[0.04] text-gray-300 ring-white/10 light:ring-gray-700`} title={row.sub_topic}>{row.sub_topic}</span>}
      </div>

      {isMcq ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {row.options.map((opt, i) => (
            <div key={i} className={`flex items-start gap-3 rounded-xl p-3 ring-1 ring-inset ${correct === i ? 'bg-emerald-500/10 ring-emerald-400/40' : 'bg-black/20 ring-white/[0.06] light:bg-gray-950 light:ring-gray-700'}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-black ${correct === i ? 'bg-emerald-400 text-gray-950' : 'bg-white/[0.06] text-gray-400 light:bg-paper light:ring-1 light:ring-gray-700'}`}>{LETTERS[i]}</span>
              <div className="min-w-0 flex-1 text-sm text-gray-200"><MathText text={opt} /></div>
              {correct === i && <Icon d={CHECK} className="h-4 w-4 shrink-0 text-emerald-300" />}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 ring-1 ring-inset ring-emerald-400/30">
          <span className="font-bold">Answer: </span>{row.answer ? <MathText text={row.answer} /> : '—'}
        </p>
      )}

      {!row.answer && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-400/[0.08] px-3 py-2 text-xs font-semibold text-amber-300 ring-1 ring-inset ring-amber-400/25">
          <Icon d={WARN} /> No correct answer — edit it, or it will be added as flagged.
        </p>
      )}
      {row.review_notes && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-400/[0.08] px-3 py-2 text-xs text-amber-200 ring-1 ring-inset ring-amber-400/25">
          <Icon d={WARN} className="mt-px h-4 w-4 shrink-0 text-amber-300" /> <span><b>Review note:</b> {row.review_notes}</span>
        </p>
      )}
      {row.explanation && (
        <div className="mt-3 rounded-xl bg-black/20 p-3 ring-1 ring-inset ring-white/[0.06] light:bg-gray-950 light:ring-gray-700">
          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">Explanation</p>
          <div className="text-sm text-gray-300"><MathText text={row.explanation} /></div>
        </div>
      )}
    </div>
  );
};

// ---------- List ----------

const BankReviewList: React.FC<{
  rows: BankRow[];
  onChange: (rows: BankRow[]) => void;
  /** Told whether a question's editor is open, so saving can wait for it. */
  onEditingChange?: (open: boolean) => void;
  disabled?: boolean;
}> = ({ rows, onChange, onEditingChange, disabled }) => {
  const [editing, setEditing] = useState<number | null>(null);
  useEffect(() => { onEditingChange?.(editing !== null); }, [editing, onEditingChange]);
  const [removed, setRemoved] = useState<{ row: BankRow; index: number } | null>(null);

  const remove = (index: number) => {
    setRemoved({ row: rows[index], index });
    if (editing === index) setEditing(null);
    else if (editing !== null && editing > index) setEditing(editing - 1);
    onChange(rows.filter((_, i) => i !== index));
  };

  const undo = () => {
    if (!removed) return;
    const next = [...rows];
    next.splice(Math.min(removed.index, next.length), 0, removed.row);
    if (editing !== null && editing >= removed.index) setEditing(editing + 1);
    onChange(next);
    setRemoved(null);
  };

  return (
    <div className="space-y-3">
      {removed && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-4 py-2.5 text-sm text-gray-300 ring-1 ring-inset ring-white/10 light:ring-gray-700 animate-fade-in">
          <span>Question {removed.index + 1} removed from this upload.</span>
          <button type="button" onClick={undo} className="font-bold text-emerald-300 hover:text-emerald-200 light:text-brand-deep">Undo</button>
        </div>
      )}

      {rows.length === 0 && (
        <p className="rounded-xl bg-white/[0.03] px-4 py-6 text-center text-sm text-gray-400 ring-1 ring-inset ring-white/[0.06]">
          All questions were removed. Close this window or undo the last removal.
        </p>
      )}

      <ol className="space-y-3">
        {rows.map((row, index) => (
          <li key={`${index}-${row.question.slice(0, 24)}`}
            className={`rounded-2xl bg-gray-900/60 ring-1 ring-inset transition light:bg-paper light:shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${editing === index ? 'ring-emerald-400/50' : 'ring-white/[0.07] hover:ring-white/15 light:ring-gray-700'}`}>
            {editing === index ? (
              <>
                <p className="border-b border-white/[0.06] px-5 pt-4 pb-3 text-xs font-black uppercase tracking-[0.16em] text-emerald-300 light:border-gray-700 light:text-brand-deep">
                  Editing question {index + 1}
                </p>
                <RowEditor row={row} onCancel={() => setEditing(null)}
                  onSave={next => { onChange(rows.map((r, i) => (i === index ? next : r))); setEditing(null); }} />
              </>
            ) : (
              <>
                <div className="flex gap-4 p-4 sm:p-5">
                  <span className="mt-0.5 w-7 shrink-0 text-right font-mono text-sm font-bold text-gray-500">{index + 1}.</span>
                  <RowPreview row={row} />
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.06] px-4 py-3 sm:px-5 light:border-gray-700">
                  <button type="button" disabled={disabled} onClick={() => setEditing(index)}
                    className={`${actionBtn} bg-emerald-400/10 text-emerald-300 ring-emerald-400/30 hover:bg-emerald-400/20 light:bg-brand-pale light:text-brand-deep light:ring-brand-line`}>
                    <Icon d={EDIT} /> Edit
                  </button>
                  <button type="button" disabled={disabled} onClick={() => remove(index)} title="Leave this question out of the upload"
                    className={`${actionBtn} text-rose-300 ring-rose-400/30 hover:bg-rose-500/10`}>
                    <Icon d={TRASH} /> Delete
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
};

export default BankReviewList;
