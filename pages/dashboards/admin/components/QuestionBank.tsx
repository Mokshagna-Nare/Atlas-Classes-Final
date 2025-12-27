
import React, { useState } from 'react';
import { useData } from '../../../../contexts/DataContext';
import { MCQ } from '../../../../types';
import { FlagIcon, PencilSquareIcon, TrashIcon, XIcon, FunnelIcon, InformationCircleIcon } from '../../../../components/icons';

interface QuestionBankProps {
  onEdit: (mcq: MCQ) => void;
}

const QuestionBank: React.FC<QuestionBankProps> = ({ onEdit }) => {
  const { mcqBank, deleteMCQ, flagMCQ, unflagMCQ } = useData();
  const [filterSub, setFilterSub] = useState('All');
  const [filterFlag, setFilterFlag] = useState('All');
  const [flaggingId, setFlaggingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const filtered = mcqBank.filter(q => {
    const subMatch = filterSub === 'All' || q.subject === filterSub;
    const flagMatch = filterFlag === 'All' || (filterFlag === 'Flagged' ? q.isFlagged : !q.isFlagged);
    return subMatch && flagMatch;
  });

  const confirmFlag = () => {
    if (flaggingId) {
      flagMCQ(flaggingId, reason);
      setFlaggingId(null);
      setReason('');
    }
  };

  return (
    <div className="space-y-6 reveal-on-scroll">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-white mb-1">Question Bank</h2>
          <p className="text-atlas-text-muted text-sm flex items-center gap-2"><InformationCircleIcon className="h-4 w-4" /> Manage and review your MCQ repository</p>
        </div>
        <div className="flex items-center gap-3 bg-atlas-dark p-2 rounded-2xl border border-gray-800">
           <FunnelIcon className="h-4 w-4 text-atlas-primary ml-2" />
           <select value={filterSub} onChange={(e) => setFilterSub(e.target.value)} className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer pr-4">
              <option value="All">All Subjects</option>
              <option value="Physics">Physics</option><option value="Chemistry">Chemistry</option>
              <option value="Biology">Biology</option><option value="Mathematics">Mathematics</option>
           </select>
           <div className="w-px h-4 bg-gray-800 mx-1"></div>
           <select value={filterFlag} onChange={(e) => setFilterFlag(e.target.value)} className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer pr-4">
              <option value="All">All Status</option>
              <option value="Flagged">Only Flagged</option>
              <option value="Unflagged">Only Clean</option>
           </select>
        </div>
      </div>

      <div className="bg-atlas-soft/40 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-atlas-dark/50 border-b border-gray-800">
              <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Question</th>
              <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Subject</th>
              <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</th>
              <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {filtered.map(q => (
              <tr key={q.id} className="group hover:bg-white/[0.02] transition-colors">
                <td className="p-5">
                   <p className="text-sm text-gray-200 line-clamp-1">{q.question}</p>
                   <p className="text-[10px] text-gray-500 mt-1">{q.topic}</p>
                </td>
                <td className="p-5">
                   <span className="px-2 py-1 bg-atlas-primary/5 text-atlas-primary border border-atlas-primary/20 text-[10px] font-bold rounded uppercase">{q.subject}</span>
                </td>
                <td className="p-5">
                   {q.isFlagged ? <span className="flex items-center gap-1.5 text-xs font-bold text-red-500 animate-pulse"><FlagIcon className="h-3.5 w-3.5" /> Flagged</span> : <span className="text-xs text-gray-600">Clean</span>}
                </td>
                <td className="p-5 text-right whitespace-nowrap">
                   <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => q.isFlagged ? unflagMCQ(q.id!) : setFlaggingId(q.id!)} className={`p-2 rounded-lg transition ${q.isFlagged ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-red-500 hover:bg-red-500/10'}`} title="Flag/Unflag"><FlagIcon className="h-4 w-4" /></button>
                      <button onClick={() => onEdit(q)} className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition" title="Edit"><PencilSquareIcon className="h-4 w-4" /></button>
                      <button onClick={() => deleteMCQ(q.id!)} className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition" title="Delete"><TrashIcon className="h-4 w-4" /></button>
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="p-20 text-center text-gray-500">No questions found.</div>}
      </div>

      {flaggingId && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
           <div className="bg-atlas-soft border border-gray-700 w-full max-w-md rounded-3xl p-8 animate-scale-in">
              <h3 className="text-xl font-bold text-white mb-4">Flag Question</h3>
              <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for flagging (optional)..." className="w-full p-4 bg-atlas-dark border border-gray-700 rounded-2xl text-white resize-none mb-6 focus:border-red-500 outline-none" rows={4} />
              <div className="flex justify-end gap-4">
                 <button onClick={() => setFlaggingId(null)} className="text-gray-500 font-bold text-sm">Cancel</button>
                 <button onClick={confirmFlag} className="bg-red-600 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-red-500 transition">Confirm Flag</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default QuestionBank;