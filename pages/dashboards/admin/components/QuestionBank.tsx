import React, { useState, useEffect, useCallback } from 'react';
import { useData } from '../../../../contexts/DataContext';
import { MCQ } from '../../../../types';
import { FlagIcon, PencilSquareIcon, TrashIcon, FunnelIcon, InformationCircleIcon, PhotoIcon, MagnifyingGlassIcon } from '../../../../components/icons';
import { supabase } from '../../../../services/supabase';

interface QuestionBankProps {
  onEdit: (mcq: MCQ) => void;
}

const QuestionBank: React.FC<QuestionBankProps> = ({ onEdit }) => {
  const { deleteMCQ, flagMCQ, unflagMCQ } = useData();

  // --- Filter States ---
  const [questions, setQuestions] = useState<MCQ[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [search, setSearch] = useState('');
  const [filterSubject, setFilterSubject] = useState('All');
  const [filterGrade, setFilterGrade] = useState('All');
  const [filterDifficulty, setFilterDifficulty] = useState('All');
  const [filterFlag, setFilterFlag] = useState('All');

  // --- Flagging Modal State ---
  const [flaggingId, setFlaggingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  // --- Fetch Logic (Server-Side Filtering) ---
  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from('mcqs').select('*').order('createdAt', { ascending: false });

      // 1. Dropdown Filters (Exact Match)
      if (filterSubject !== 'All') query = query.eq('subject', filterSubject);
      if (filterGrade !== 'All') query = query.eq('grade', filterGrade);
      if (filterDifficulty !== 'All') query = query.eq('difficulty', filterDifficulty);

      // 2. Flag Filter
      if (filterFlag === 'Flagged') query = query.eq('isFlagged', true);
      if (filterFlag === 'Unflagged') query = query.eq('isFlagged', false);

      // 3. Search Bar (Text Search)
      if (search.trim()) {
        query = query.ilike('question', `%${search.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setQuestions(data as MCQ[]);

    } catch (error) {
      console.error("Error fetching questions:", error);
    } finally {
      setLoading(false);
    }
  }, [filterSubject, filterGrade, filterDifficulty, filterFlag, search]);

  // Fetch when filters change (Debounce search slightly if needed)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchQuestions();
    }, 300); // 300ms debounce
    return () => clearTimeout(timer);
  }, [fetchQuestions]);


  const confirmFlag = async () => {
    if (flaggingId) {
      await flagMCQ(flaggingId, reason);
      setFlaggingId(null);
      setReason('');
      fetchQuestions(); // Refresh list
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this question?')) {
      await deleteMCQ(id);
      fetchQuestions(); // Refresh list
    }
  };

  const handleUnflag = async (id: string) => {
    await unflagMCQ(id);
    fetchQuestions(); // Refresh
  };

  return (
    <div className="space-y-6 reveal-on-scroll text-white">
      {/* --- Header & Search --- */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-start md:items-center">
          <div>
            <h2 className="text-3xl font-extrabold mb-1">Question Bank</h2>
            <p className="text-gray-400 text-sm flex items-center gap-2"><InformationCircleIcon className="h-4 w-4" /> Manage and review your MCQ repository</p>
          </div>
        </div>

        {/* --- Filter Bar --- */}
        <div className="flex flex-col md:flex-row gap-4 bg-gray-900/50 p-4 rounded-2xl border border-gray-800 backdrop-blur-md">
           
           {/* Search Input */}
           <div className="flex-1 relative">
             <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
             <input 
               type="text" 
               placeholder="Search question text..." 
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               className="w-full bg-gray-800 border border-gray-700 text-sm rounded-xl py-2.5 pl-10 pr-4 focus:border-green-500 outline-none text-white placeholder-gray-500"
             />
           </div>

           {/* Filters */}
           <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
             <FunnelIcon className="h-5 w-5 text-green-500 hidden md:block mr-2" />
             
             {/* Subject */}
             <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="bg-gray-800 border border-gray-700 text-xs font-bold text-white rounded-lg px-3 py-2.5 outline-none cursor-pointer hover:border-green-500 transition">
                <option value="All">All Subjects</option>
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Biology">Biology</option>
                <option value="Mathematics">Mathematics</option>
             </select>

             {/* Grade */}
             <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} className="bg-gray-800 border border-gray-700 text-xs font-bold text-white rounded-lg px-3 py-2.5 outline-none cursor-pointer hover:border-green-500 transition">
                <option value="All">All Grades</option>
                <option value="11">Grade 11</option>
                <option value="12">Grade 12</option>
             </select>

             {/* Difficulty */}
             <select value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)} className="bg-gray-800 border border-gray-700 text-xs font-bold text-white rounded-lg px-3 py-2.5 outline-none cursor-pointer hover:border-green-500 transition">
                <option value="All">All Difficulty</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
             </select>

             {/* Flag Status */}
             <select value={filterFlag} onChange={(e) => setFilterFlag(e.target.value)} className="bg-gray-800 border border-gray-700 text-xs font-bold text-white rounded-lg px-3 py-2.5 outline-none cursor-pointer hover:border-green-500 transition">
                <option value="All">All Status</option>
                <option value="Flagged">Flagged</option>
                <option value="Unflagged">Clean</option>
             </select>
           </div>
        </div>
      </div>

      {/* --- Table --- */}
      <div className="bg-gray-900/40 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-800/50 border-b border-gray-800">
              <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest w-1/2">Question</th>
              <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Metadata</th>
              <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</th>
              <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {loading ? (
               <tr><td colSpan={4} className="p-10 text-center text-gray-500">Loading questions...</td></tr>
            ) : questions.length === 0 ? (
               <tr><td colSpan={4} className="p-10 text-center text-gray-500">No questions found matching your filters.</td></tr>
            ) : (
              questions.map(q => (
                <tr key={q.id} className="group hover:bg-white/[0.02] transition-colors">
                  <td className="p-5">
                     <div className="flex gap-3">
                       
                       {/* Question Image Icon (Green) */}
                       {q.imageUrl && <PhotoIcon className="h-5 w-5 text-green-500 shrink-0 mt-1" />}
                       
                       {/* NEW: Option Images Icon (Blue) */}
                       {q.option_images && q.option_images.some(img => img) && (
                         <PhotoIcon className="h-5 w-5 text-blue-400 shrink-0 mt-1"  />
                       )}

                       <div>
                         <p className="text-sm text-gray-200 line-clamp-2 font-medium">{q.question}</p>
                         <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-2">
                           <span className="bg-gray-800 px-1.5 rounded">{q.question_code || 'No Code'}</span>
                           <span>• {q.topic}</span>
                           {q.sub_topic && <span>• {q.sub_topic}</span>}
                         </p>
                       </div>
                     </div>
                  </td>
                  <td className="p-5">
                     <div className="flex flex-col gap-1 items-start">
                        <span className="px-2 py-0.5 bg-green-500/10 text-green-500 border border-green-500/20 text-[10px] font-bold rounded uppercase">{q.subject}</span>
                        <span className="text-[10px] text-gray-400">Grade {q.grade} • {q.difficulty}</span>
                     </div>
                  </td>
                  <td className="p-5">
                     {q.isFlagged ? (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-red-500 animate-pulse">
                          <FlagIcon className="h-3.5 w-3.5" /> Flagged
                        </span> 
                      ) : (
                        <span className="text-xs text-gray-600 bg-gray-800/50 px-2 py-1 rounded-full">Clean</span>
                      )}
                  </td>
                  <td className="p-5 text-right whitespace-nowrap">
                     <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => q.isFlagged ? handleUnflag(q.id!) : setFlaggingId(q.id!)} className={`p-2 rounded-lg transition ${q.isFlagged ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-red-500 hover:bg-red-500/10'}`} title={q.isFlagged ? "Unflag" : "Flag"}>
                          <FlagIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => onEdit(q)} className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition" title="Edit">
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(q.id!)} className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition" title="Delete">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                     </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* --- Flag Modal --- */}
      {flaggingId && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
           <div className="bg-gray-900 border border-gray-700 w-full max-w-md rounded-3xl p-8 animate-scale-in shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-4">Flag Question</h3>
              <p className="text-sm text-gray-400 mb-4">Why are you flagging this question?</p>
              <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (e.g. Wrong answer key)..." className="w-full p-4 bg-black/50 border border-gray-700 rounded-2xl text-white resize-none mb-6 focus:border-red-500 outline-none" rows={4} />
              <div className="flex justify-end gap-4">
                 <button onClick={() => setFlaggingId(null)} className="text-gray-400 font-bold text-sm hover:text-white transition">Cancel</button>
                 <button onClick={confirmFlag} className="bg-red-600 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-red-700 transition shadow-lg shadow-red-900/20">Confirm Flag</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default QuestionBank;
