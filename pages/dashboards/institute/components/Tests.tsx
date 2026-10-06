import React, { useMemo, useState } from 'react';
import { useData } from '../../../../contexts/DataContext';
import { useAuth } from '../../../../contexts/AuthContext';
import CreateTestModal from './CreateTestModal';
import { Test } from '../../../../types';
import { PlusIcon, PencilSquareIcon, TrashIcon, ClipboardCheckIcon, ShieldCheckIcon } from '../../../../components/icons';
import { isOnlineTest, testStatus, testDate, formatTestDate, TestStatus } from '../../../../utils/testSchedule';

type Filter = 'all' | 'online' | 'offline';

const isOnline = isOnlineTest;
const statusOf = testStatus;
const sortKey = (t: Test) => testDate(t)?.getTime() ?? 0;

const STATUS_STYLE: Record<TestStatus, string> = {
  Upcoming: 'bg-sky-500/10 text-sky-300 border-sky-500/25',
  Live: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  Completed: 'bg-white/[0.04] text-gray-400 border-white/10',
};

const Tests: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<Test | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [actionError, setActionError] = useState('');
  const { tests, deleteTest } = useData();
  const { user } = useAuth()!;

  const instituteTests = useMemo(
    () => tests.filter(t => t.institute_id === user?.id).sort((a, b) => sortKey(b) - sortKey(a)),
    [tests, user?.id]
  );
  const counts = {
    all: instituteTests.length,
    online: instituteTests.filter(isOnline).length,
    offline: instituteTests.filter(t => !isOnline(t)).length,
  };
  const upcoming = instituteTests.filter(t => statusOf(t) !== 'Completed').length;
  const shown = instituteTests.filter(t => filter === 'all' || (filter === 'online') === isOnline(t));

  const openCreate = () => { setEditingTest(null); setIsModalOpen(true); };
  const openEdit = (t: Test) => { setEditingTest(t); setIsModalOpen(true); };

  const handleDelete = async (t: Test) => {
    if (!window.confirm(`Delete “${t.title}”? This can't be undone.`)) return;
    setActionError('');
    try { await deleteTest(t.id!); }
    catch (err: any) { setActionError(err?.message || 'Could not delete this test.'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-white">Tests</h2>
          <p className="text-sm text-gray-500 mt-1">Online tests assigned by Atlas, plus offline tests you schedule yourself.</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-black text-sm text-atlas-black bg-gradient-to-r from-atlas-primary to-emerald-400 hover:shadow-[0_12px_40px_-12px_rgba(16,185,129,0.9)] hover:-translate-y-0.5 active:scale-[0.98] transition-all shrink-0">
          <PlusIcon className="h-4 w-4" /> Schedule offline test
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[['Total tests', counts.all], ['Online (Atlas)', counts.online], ['Offline', counts.offline], ['Upcoming or live', upcoming]].map(([label, value]) => (
          <div key={label as string} className="bg-atlas-dark border border-white/5 rounded-3xl p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
            <p className="text-3xl font-black text-white mt-3">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 p-1.5 rounded-2xl bg-atlas-dark border border-white/5 w-full sm:w-fit overflow-x-auto">
        {(['all', 'online', 'offline'] as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold capitalize whitespace-nowrap transition-all ${filter === f ? 'bg-atlas-primary/15 text-white ring-1 ring-atlas-primary/30' : 'text-gray-500 hover:text-white hover:bg-white/[0.03]'}`}>
            {f}
            <span className={`min-w-[1.5rem] px-1.5 py-0.5 rounded-md text-[11px] font-black ${filter === f ? 'bg-atlas-primary text-atlas-black' : 'bg-white/5 text-gray-400'}`}>{counts[f]}</span>
          </button>
        ))}
      </div>

      {actionError && <p role="alert" className="text-sm text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl p-3">{actionError}</p>}

      <div key={filter} className="space-y-3 animate-view-in">
        {shown.length === 0 ? (
          <div className="p-14 text-center border border-dashed border-white/10 rounded-3xl">
            <ClipboardCheckIcon className="h-9 w-9 text-gray-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-300">No {filter === 'all' ? '' : `${filter} `}tests yet</p>
            <p className="text-xs text-gray-500 mt-1">{filter === 'online' ? 'Online tests appear here once Atlas assigns one to your classes.' : 'Schedule an offline test to add it to your calendar.'}</p>
          </div>
        ) : shown.map(t => {
          const status = statusOf(t);
          const online = isOnline(t);
          const whenLabel = formatTestDate(t);
          return (
            <div key={t.id} className="group bg-atlas-dark border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-atlas-primary/25 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider ${STATUS_STYLE[status]}`}>{status}</span>
                  {online ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-atlas-primary/10 text-atlas-primary text-[10px] font-bold uppercase tracking-wider"><ShieldCheckIcon className="h-3 w-3" /> Managed by Atlas</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-white/[0.04] text-gray-400 text-[10px] font-bold uppercase tracking-wider">Offline</span>
                  )}
                </div>
                <p className="font-bold text-white truncate">{t.title}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {whenLabel}
                  {t.subject ? ` · ${t.subject}` : ''}
                  {online ? ` · ${t.question_ids.length} questions` : ''}
                  {(t.duration_minutes || t.duration) ? ` · ${t.duration_minutes || t.duration} min` : ''}
                </p>
              </div>
              {!online && (
                <div className="flex items-center gap-2 shrink-0 sm:opacity-60 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(t)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-gray-300 bg-white/[0.04] hover:bg-white/[0.08] hover:text-white transition-colors">
                    <PencilSquareIcon className="h-4 w-4" /> Edit
                  </button>
                  <button onClick={() => handleDelete(t)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-red-300 bg-red-500/5 hover:bg-red-500/15 transition-colors">
                    <TrashIcon className="h-4 w-4" /> Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isModalOpen && <CreateTestModal testToEdit={editingTest} onClose={() => setIsModalOpen(false)} />}
    </div>
  );
};

export default Tests;
