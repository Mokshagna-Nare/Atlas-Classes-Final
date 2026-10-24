import React, { useEffect, useState } from 'react';
import { supabase } from '../../../../../services/supabase';
import { checkDuplicate, getNextSequenceNumber, getQuestionPrefix } from '../MCQUpload';
import { qgJson } from './api';
import { RunResult } from './types';
import { Checkbox, Modal, Notice, PrimaryButton, SecondaryButton } from './ui';

// A question formatted for Atlas's `mcqs` table by the service
// (superscripts as Unicode, answer = text of the correct option).
interface BankRow {
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

const INSERT_BATCH = 50;

// Same storage bucket and naming the existing bulk upload uses.
const uploadImage = async (dataUrl: string): Promise<string | null> => {
  if (!dataUrl?.startsWith('data:image')) return null;
  const blob = await (await fetch(dataUrl)).blob();
  const extension = blob.type.split('/')[1] || 'png';
  const fileName = `qgen_${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
  const { error } = await supabase.storage.from('question-images').upload(fileName, blob);
  if (error) throw new Error(`Image upload failed: ${error.message}`);
  return supabase.storage.from('question-images').getPublicUrl(fileName).data.publicUrl;
};

const AddToBankModal: React.FC<{ result: RunResult; onClose: () => void; onAdded: (count: number) => void }> = ({ result, onClose, onAdded }) => {
  const [rows, setRows] = useState<BankRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [flagReviewed, setFlagReviewed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<number[] | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    qgJson<{ rows: BankRow[] }>('/bank-format', {
      json: { pages: result.pages, grade: result.grade, subject: result.subject, topic: result.topic },
    })
      .then((data) => setRows(data.rows))
      .catch((e) => setLoadError(e.message));
  }, [result]);

  const withNotes = rows?.filter((row) => row.review_notes).length || 0;
  const withoutAnswer = rows?.filter((row) => !row.answer).length || 0;

  const checkDuplicates = async () => {
    if (!rows) return;
    setBusy(true);
    setError(null);
    try {
      const found: number[] = [];
      for (let i = 0; i < rows.length; i++) {
        setStatus(`Checking for duplicates ${i + 1}/${rows.length}...`);
        if (await checkDuplicate(rows[i].question, rows[i].options)) found.push(i);
      }
      if (found.length) {
        setDuplicates(found);
        setBusy(false);
        setStatus('');
      } else {
        await insert([]);
      }
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
      setStatus('');
    }
  };

  const insert = async (skip: number[]) => {
    if (!rows) return;
    setBusy(true);
    setDuplicates(null);
    setError(null);

    try {
      const chosen = rows.filter((_, index) => !skip.includes(index));
      if (!chosen.length) throw new Error('No questions left to add after skipping duplicates.');

      const prefixCounters: Record<string, number> = {};
      const now = new Date().toISOString();
      const records = [];

      for (let i = 0; i < chosen.length; i++) {
        const row = chosen[i];
        setStatus(`Preparing question ${i + 1}/${chosen.length}...`);
        const imageUrl = row.imageUrl ? await uploadImage(row.imageUrl) : null;
        const prefix = getQuestionPrefix(row.subject || 'X', row.grade || '11');
        if (prefixCounters[prefix] === undefined) prefixCounters[prefix] = await getNextSequenceNumber(prefix);
        prefixCounters[prefix] += 1;

        const reasons: string[] = [];
        if (!row.answer) reasons.push('Answer missing — fill it in before use.');
        if (flagReviewed && row.review_notes) reasons.push(row.review_notes);

        records.push({
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
          question: row.question,
          options: row.options,
          option_images: row.type === 'Multiple Choice' ? [null, null, null, null] : [],
          answer: row.answer,
          explanation: row.explanation,
          grade: row.grade,
          subject: row.subject,
          topic: row.topic,
          sub_topic: row.sub_topic,
          question_type: row.question_type,
          difficulty: row.difficulty,
          marks: row.marks,
          question_code: `${prefix}${prefixCounters[prefix].toString().padStart(2, '0')}`,
          imageUrl,
          type: row.type,
          isFlagged: reasons.length > 0,
          flagReason: reasons.join(' | ').slice(0, 1000),
        });
      }

      for (let start = 0; start < records.length; start += INSERT_BATCH) {
        setStatus(`Saving questions ${start + 1}–${Math.min(records.length, start + INSERT_BATCH)} of ${records.length}...`);
        const { error: insertError } = await supabase.from('mcqs').insert(records.slice(start, start + INSERT_BATCH));
        if (insertError) {
          throw new Error(
            `${insertError.message}${start > 0 ? ` (the first ${start} question(s) were already saved)` : ''}`,
          );
        }
      }

      const flagged = records.filter((record) => record.isFlagged).length;
      setDone(
        `Added ${records.length} question(s) to the question bank.` +
          (flagged ? ` ${flagged} are flagged for review — find them in Question Bank and unflag after checking.` : ''),
      );
      onAdded(records.length);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
      setStatus('');
    }
  };

  return (
    <Modal title="Add to question bank" onClose={busy ? () => undefined : onClose}>
      {loadError && <Notice kind="error">{loadError}</Notice>}
      {!rows && !loadError && <p className="text-sm text-gray-400 animate-pulse">Preparing questions...</p>}

      {rows && !done && !duplicates && (
        <div className="space-y-4">
          <p className="text-sm text-gray-300">
            <b className="text-white">{rows.length}</b> question(s) will be added to the Atlas question bank under{' '}
            <b className="text-white">
              {result.subject} · Grade {result.grade} · {result.topic}
            </b>
            , with a question code generated for each (same as MCQ Upload). Figures are uploaded with their questions.
          </p>
          {withoutAnswer > 0 && (
            <Notice kind="warning">{withoutAnswer} question(s) have no answer — they will be added as flagged so they can't be used until fixed.</Notice>
          )}
          {withNotes > 0 && (
            <Checkbox
              checked={flagReviewed}
              onChange={setFlagReviewed}
              label={
                <>
                  Mark the {withNotes} question(s) that have review notes as <b>flagged</b> (recommended). Flagged questions stay out of
                  papers and tests until someone unflags them in Question Bank.
                </>
              }
            />
          )}
          {status && <p className="text-sm text-gray-400 animate-pulse">{status}</p>}
          {error && <Notice kind="error">{error}</Notice>}
          <div className="flex flex-col sm:flex-row gap-3">
            <PrimaryButton className="flex-1" disabled={busy || !rows.length} onClick={checkDuplicates}>
              {busy ? 'Working…' : `Add ${rows.length} question(s)`}
            </PrimaryButton>
            <SecondaryButton className="flex-1" disabled={busy} onClick={onClose}>
              Cancel
            </SecondaryButton>
          </div>
        </div>
      )}

      {rows && duplicates && (
        <div className="space-y-4">
          <Notice kind="warning">{duplicates.length} question(s) already exist in the question bank:</Notice>
          <div className="max-h-64 overflow-y-auto space-y-2 custom-scrollbar">
            {duplicates.map((index) => (
              <div key={index} className="text-sm text-gray-300 bg-gray-800 p-3 rounded-lg border border-gray-700">
                <span className="font-bold text-yellow-400 mr-2">Question #{index + 1}:</span>
                {rows[index].question.slice(0, 200)}
              </div>
            ))}
          </div>
          {status && <p className="text-sm text-gray-400 animate-pulse">{status}</p>}
          <div className="flex flex-col sm:flex-row gap-3">
            <PrimaryButton className="flex-1" disabled={busy} onClick={() => insert(duplicates)}>
              Skip duplicates & add the rest
            </PrimaryButton>
            <SecondaryButton disabled={busy} onClick={() => insert([])}>
              Add all anyway
            </SecondaryButton>
            <SecondaryButton disabled={busy} onClick={() => setDuplicates(null)}>
              Back
            </SecondaryButton>
          </div>
        </div>
      )}

      {done && (
        <div className="space-y-4">
          <Notice kind="success">{done}</Notice>
          <PrimaryButton className="w-full" onClick={onClose}>
            Close
          </PrimaryButton>
        </div>
      )}
    </Modal>
  );
};

export default AddToBankModal;
