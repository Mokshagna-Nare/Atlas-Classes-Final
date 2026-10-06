import React, { useState } from 'react';
import { useData } from '../../../../contexts/DataContext';
import { useAuth } from '../../../../contexts/AuthContext';
import { XIcon, ClipboardCheckIcon } from '../../../../components/icons';
import ModalPortal from '../../../../components/ModalPortal';
import { Test } from '../../../../types';

interface CreateTestModalProps {
  onClose: () => void;
  testToEdit: Test | null;
}

const SUBJECTS = ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'Mixed'];
const inputCls = 'w-full p-3 bg-atlas-black border border-white/10 rounded-xl focus:outline-none focus:border-atlas-primary/60 focus:ring-4 focus:ring-atlas-primary/10 text-white text-sm transition-all [color-scheme:dark]';

const CreateTestModal: React.FC<CreateTestModalProps> = ({ onClose, testToEdit }) => {
  const isEditMode = Boolean(testToEdit);
  const [title, setTitle] = useState(testToEdit?.title || '');
  const [subject, setSubject] = useState(testToEdit?.subject || 'Physics');
  // `tests.date` comes back as a full timestamp; the date input needs YYYY-MM-DD.
  const [date, setDate] = useState(testToEdit?.date ? testToEdit.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState<number | string>(testToEdit?.duration ?? 60);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const { addTest, editTest } = useData();
  const { user } = useAuth()!;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError('Please give the test a title.');
    const minutes = Number(duration);
    if (!minutes || minutes < 1) return setError('Duration must be at least 1 minute.');
    setSaving(true);
    setError('');
    try {
      if (isEditMode && testToEdit) {
        await editTest({ ...testToEdit, title: title.trim(), subject, date, duration: minutes });
      } else {
        await addTest({ title: title.trim(), subject, date, duration: minutes, status: 'Upcoming', institute_id: user!.id, question_ids: [] });
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Could not save the test. Please try again.');
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
        <div className="relative w-full max-w-lg rounded-3xl bg-atlas-dark border border-white/10 p-7 sm:p-8 shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
          <button onClick={onClose} className="absolute top-5 right-5 p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors" aria-label="Close">
            <XIcon className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-atlas-primary/10 border border-atlas-primary/20 text-atlas-primary"><ClipboardCheckIcon className="h-5 w-5" /></div>
            <h2 className="text-xl font-black text-white">{isEditMode ? 'Edit test' : 'Schedule an offline test'}</h2>
          </div>
          <p className="text-xs text-gray-500 mb-6">
            Records a pen-and-paper test on your institute's calendar. Online tests with questions are created and assigned by Atlas.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="block text-xs font-bold text-gray-400 mb-2">Title</span>
              <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} placeholder="e.g., Unit Test 3 — Thermodynamics" autoFocus />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="block text-xs font-bold text-gray-400 mb-2">Subject</span>
                <select value={subject} onChange={e => setSubject(e.target.value)} className={inputCls}>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  {subject && !SUBJECTS.includes(subject) && <option value={subject}>{subject}</option>}
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-bold text-gray-400 mb-2">Duration (minutes)</span>
                <input type="number" min={1} value={duration} onChange={e => setDuration(e.target.value)} className={inputCls} />
              </label>
            </div>
            <label className="block">
              <span className="block text-xs font-bold text-gray-400 mb-2">Date</span>
              <input type="date" value={date || ''} onChange={e => setDate(e.target.value)} className={inputCls} />
            </label>
            {error && <p role="alert" className="text-sm text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl p-3 animate-shake">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} disabled={saving} className="flex-1 py-3 rounded-xl font-bold text-sm text-gray-400 bg-white/[0.04] hover:bg-white/[0.08] hover:text-white transition-colors">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl font-black text-sm text-atlas-black bg-gradient-to-r from-atlas-primary to-emerald-400 hover:shadow-[0_12px_40px_-12px_rgba(16,185,129,0.9)] transition-all disabled:opacity-60 disabled:cursor-wait">
                {saving ? 'Saving…' : isEditMode ? 'Save changes' : 'Schedule test'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default CreateTestModal;
