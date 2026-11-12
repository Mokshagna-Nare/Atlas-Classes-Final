import React, { useState } from 'react';
import { MCQ } from '../../../../../types';
import { markersToHtml } from '../../../../../utils/renderMath';
import { getCorrectOptionIndex } from '../../../../../utils/mcqAnswer';
import { getQuestionImages, getOptionImages, McqImageList } from '../../../../../utils/mcqContent';
import { Svg, ICONS, Chip, DIFFICULTY_TONE } from '../../../../../components/ui/admin';
import ModalPortal from '../../../../../components/ModalPortal';
import MCQUpload from '../MCQUpload';

// Question Paper Generator → review list for questions picked from the bank, shown before they
// go into the paper. Each question can be previewed in full (options, answer, explanation),
// edited in the bank, swapped for a similar question, or removed from the paper.

const EYE = 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178zM15 12a3 3 0 11-6 0 3 3 0 016 0z';
const SWAP = 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99';
const LETTERS = 'ABCDEFGHIJ';

const actionBtn =
  'inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold ring-1 ring-inset transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40';

interface Props {
  questions: (MCQ & { _trackContext?: string })[];
  /** Remove the question at this position from the paper (it stays in the Question Bank). */
  onRemove: (index: number) => void;
  /** Swap the question at this position for a similar unused one. */
  onReplace: (index: number) => Promise<void>;
  /** Called with the saved question after it was edited in the bank. */
  onEdited: (index: number) => Promise<void>;
  /** Number shown for the first question (sections in the final preview restart at 1). */
  startNumber?: number;
}

const PaperQuestionReview: React.FC<Props> = ({ questions, onRemove, onReplace, onEdited, startNumber = 1 }) => {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ q: MCQ; index: number } | null>(null);
  const allOpen = questions.length > 0 && questions.every(q => open.has(q.id!));

  const toggle = (id: string) => setOpen(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const replace = async (index: number, id: string) => {
    setBusy(id);
    try { await onReplace(index); } finally { setBusy(null); }
  };

  const finishEdit = async () => {
    if (!editing) return;
    const { index } = editing;
    setEditing(null);
    await onEdited(index);
  };

  return (
    <div>
      <div className="flex items-center justify-end px-5 pt-4">
        <button
          type="button"
          onClick={() => setOpen(allOpen ? new Set() : new Set(questions.map(q => q.id!)))}
          className={`${actionBtn} text-gray-300 ring-white/10 hover:bg-white/[0.06] hover:text-white light:ring-gray-700 light:hover:bg-gray-800`}
        >
          <Svg d={EYE} className="h-4 w-4" /> {allOpen ? 'Collapse all' : 'Preview all'}
        </button>
      </div>

      <ol className="space-y-3 p-5">
        {questions.map((q, index) => {
          const id = q.id!;
          const isOpen = open.has(id);
          const correct = getCorrectOptionIndex(q);
          const qImages = getQuestionImages(q as any);
          return (
            <li key={`${id}-${index}`} className="rounded-2xl bg-gray-900/60 ring-1 ring-inset ring-white/[0.07] transition hover:ring-white/15 light:bg-paper light:ring-gray-700 light:shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="flex gap-4 p-4 sm:p-5">
                <span className="mt-0.5 w-7 shrink-0 text-right font-mono text-sm font-bold text-gray-500">{startNumber + index}.</span>
                <div className="min-w-0 flex-1">
                  <div className="prose prose-invert max-w-none text-[15px] font-medium leading-relaxed text-gray-100" dangerouslySetInnerHTML={{ __html: markersToHtml(q.question) }} />
                  {qImages.length > 0 && <McqImageList images={qImages} alt="Question figure" className="mt-3 flex flex-wrap gap-2" />}

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {q._trackContext && <Chip tone="sky">{q._trackContext}</Chip>}
                    {q.question_code && <Chip>{q.question_code}</Chip>}
                    {q.difficulty && <Chip tone={DIFFICULTY_TONE[q.difficulty.toLowerCase()] || 'gray'}>{q.difficulty}</Chip>}
                    {q.grade && <Chip>Grade {q.grade}</Chip>}
                    {q.topic && <Chip className="max-w-[220px]" title={q.topic}>{q.topic}</Chip>}
                    {q.sub_topic && <Chip className="max-w-[220px]" title={q.sub_topic}>{q.sub_topic}</Chip>}
                  </div>

                  {isOpen && (
                    <div className="mt-4 space-y-3 animate-fade-in">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(q.options || []).map((opt, i) => {
                          const isCorrect = correct === i;
                          const optImages = getOptionImages(q as any, i);
                          return (
                            <div key={i} className={`flex items-start gap-3 rounded-xl p-3 ring-1 ring-inset ${isCorrect ? 'bg-emerald-500/10 ring-emerald-400/40 light:bg-brand-pale light:ring-brand-line' : 'bg-black/20 ring-white/[0.06] light:bg-gray-950 light:ring-gray-700'}`}>
                              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-black ${isCorrect ? 'bg-emerald-400 text-gray-950' : 'bg-white/[0.06] text-gray-400 light:bg-paper light:ring-1 light:ring-gray-700'}`}>{LETTERS[i]}</span>
                              <div className="min-w-0 flex-1">
                                <div className="prose prose-invert max-w-none text-sm text-gray-200" dangerouslySetInnerHTML={{ __html: markersToHtml(opt || '') }} />
                                {optImages.length > 0 && <McqImageList images={optImages} alt={`Option ${LETTERS[i]}`} className="mt-2 flex flex-wrap gap-2" />}
                              </div>
                              {isCorrect && <Svg d={ICONS.check} className="h-4 w-4 shrink-0 text-emerald-300 light:text-brand-deep" />}
                            </div>
                          );
                        })}
                      </div>
                      {correct === null && (
                        <p className="flex items-center gap-2 rounded-xl bg-amber-400/[0.08] px-3 py-2 text-xs font-semibold text-amber-300 ring-1 ring-inset ring-amber-400/25">
                          <Svg d={ICONS.warning} className="h-4 w-4" /> No correct option is marked for this question — edit it before using it.
                        </p>
                      )}
                      {q.explanation && (
                        <div className="rounded-xl bg-black/20 p-3 ring-1 ring-inset ring-white/[0.06] light:bg-gray-950 light:ring-gray-700">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">Explanation</p>
                          <div className="prose prose-invert max-w-none text-sm text-gray-300" dangerouslySetInnerHTML={{ __html: markersToHtml(q.explanation) }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.06] px-4 py-3 sm:px-5 light:border-gray-700">
                <button type="button" onClick={() => toggle(id)} aria-expanded={isOpen}
                  className={`${actionBtn} text-gray-300 ring-white/10 hover:bg-white/[0.06] hover:text-white light:ring-gray-700 light:hover:bg-gray-800`}>
                  <Svg d={EYE} className="h-4 w-4" /> {isOpen ? 'Hide' : 'Preview'}
                </button>
                <button type="button" onClick={() => setEditing({ q, index })}
                  className={`${actionBtn} text-emerald-300 ring-emerald-400/30 bg-emerald-400/10 hover:bg-emerald-400/20 light:text-brand-deep light:bg-brand-pale light:ring-brand-line`}>
                  <Svg d={ICONS.edit} className="h-4 w-4" /> Edit
                </button>
                <button type="button" onClick={() => replace(index, id)} disabled={busy !== null}
                  title="Swap for another question with the same subject, difficulty and topic"
                  className={`${actionBtn} text-gray-300 ring-white/10 hover:bg-white/[0.06] hover:text-white light:ring-gray-700 light:hover:bg-gray-800`}>
                  <Svg d={SWAP} className={`h-4 w-4 ${busy === id ? 'animate-spin' : ''}`} /> {busy === id ? 'Finding…' : 'Replace'}
                </button>
                <button type="button" onClick={() => onRemove(index)}
                  title="Remove from this paper. The question stays in the Question Bank."
                  className={`${actionBtn} text-rose-300 ring-rose-400/30 hover:bg-rose-500/10 light:text-rose-300`}>
                  <Svg d={ICONS.trash} className="h-4 w-4" /> Remove
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      {editing && (
        <ModalPortal>
          <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-scrim/80 p-4 backdrop-blur-md animate-fade-in sm:p-8">
            <div className="relative w-full max-w-5xl rounded-3xl bg-atlas-black p-4 ring-1 ring-white/10 sm:p-8 light:bg-gray-950 light:ring-gray-700">
              <MCQUpload editingMcq={editing.q} onFinished={finishEdit} />
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default PaperQuestionReview;
