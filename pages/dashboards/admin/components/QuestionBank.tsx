import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useData } from '../../../../contexts/DataContext';
import { MCQ } from '../../../../types';
import { FlagIcon, PencilSquareIcon, TrashIcon, FunnelIcon, InformationCircleIcon, PhotoIcon, MagnifyingGlassIcon } from '../../../../components/icons';
import { supabase } from '../../../../services/supabase';

interface QuestionBankProps {
  onEdit: (mcq: MCQ) => void;
}

const ITEMS_PER_PAGE = 20; // Number of questions to load per page

const QuestionBank: React.FC<QuestionBankProps> = ({ onEdit }) => {
  const { deleteMCQ, flagMCQ, unflagMCQ } = useData();

  // --- Filter States ---
  const [questions, setQuestions] = useState<MCQ[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const [search, setSearch] = useState('');
  const [filterSubject, setFilterSubject] = useState('All');
  const [filterTopic, setFilterTopic] = useState('All');
  const [filterGrade, setFilterGrade] = useState('All');
  const [filterDifficulty, setFilterDifficulty] = useState('All');
  const [filterFlag, setFilterFlag] = useState('All');

  // --- NEW: Pagination States ---
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filteredTotalCount, setFilteredTotalCount] = useState<number>(0); // Total for current filters

  // --- Dynamic Topics State ---
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);

  // --- Bulk Selection States ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // --- Flagging Modal State ---
  const [flaggingId, setFlaggingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  // --- Ref for Load More Button (for auto-scroll detection) ---
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // --- 1. Fetch Total Count (Initial Load Only) ---
  useEffect(() => {
    const fetchTotalCount = async () => {
      const { count, error } = await supabase.from('mcqs').select('*', { count: 'exact', head: true });
      if (!error && count !== null) setTotalCount(count);
    };
    fetchTotalCount();
  }, []);

  // --- 2. Fetch Topics from DB when Subject Changes ---
  useEffect(() => {
    const fetchTopics = async () => {
      setFilterTopic('All');
      
      if (filterSubject === 'All') {
        setAvailableTopics([]);
        return;
      }

      setLoadingTopics(true);
      try {
        const { data, error } = await supabase
          .from('mcqs')
          .select('topic')
          .eq('subject', filterSubject);

        if (error) throw error;

        if (data) {
          const uniqueTopics = Array.from(new Set(data.map(item => item.topic).filter(t => t))).sort();
          setAvailableTopics(uniqueTopics as string[]);
        }
      } catch (err) {
        console.error("Error fetching topics:", err);
      } finally {
        setLoadingTopics(false);
      }
    };

    fetchTopics();
  }, [filterSubject]);

  // --- 3. Reset pagination when filters change ---
  useEffect(() => {
    setCurrentPage(0);
    setQuestions([]);
    setHasMore(true);
  }, [filterSubject, filterTopic, filterGrade, filterDifficulty, filterFlag, search]);

  // --- 4. Fetch Questions with Pagination ---
  const fetchQuestions = useCallback(async (page: number, append: boolean = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      let query = supabase
        .from('mcqs')
        .select('*', { count: 'exact' })
        .order('createdAt', { ascending: false })
        .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);

      // Apply Filters
      if (filterSubject !== 'All') query = query.eq('subject', filterSubject);
      if (filterTopic !== 'All') query = query.eq('topic', filterTopic);
      if (filterGrade !== 'All') query = query.eq('grade', filterGrade);
      if (filterDifficulty !== 'All') query = query.eq('difficulty', filterDifficulty);

      // Flag Filter
      if (filterFlag === 'Flagged') query = query.eq('isFlagged', true);
      if (filterFlag === 'Unflagged') query = query.eq('isFlagged', false);

      // Search Bar
      if (search.trim()) {
        query = query.ilike('question', `%${search.trim()}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      if (data) {
        if (append) {
          setQuestions(prev => [...prev, ...(data as MCQ[])]);
        } else {
          setQuestions(data as MCQ[]);
        }

        // Update filtered total count
        if (count !== null) {
          setFilteredTotalCount(count);
          // Check if there are more items to load
          setHasMore(((page + 1) * ITEMS_PER_PAGE) < count);
        }
      }

    } catch (error) {
      console.error("Error fetching questions:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filterSubject, filterTopic, filterGrade, filterDifficulty, filterFlag, search]);

  // --- 5. Fetch when filters change (Initial Load) ---
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchQuestions(0, false);
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchQuestions]);

  // --- 6. Load More Handler ---
  const handleLoadMore = () => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    fetchQuestions(nextPage, true);
  };

  // --- 7. Optional: Intersection Observer for Auto-Load ---
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [hasMore, loadingMore, loading, currentPage]);

  // Clear selections when questions change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [questions]);

  // --- Bulk Selection Handlers ---
  const toggleSelectAll = () => {
    if (selectedIds.size === questions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(questions.map(q => q.id!)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    try {
      const deletePromises = Array.from(selectedIds).map(id => deleteMCQ(id));
      await Promise.all(deletePromises);
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
      
      // Reset and reload
      setCurrentPage(0);
      setQuestions([]);
      fetchQuestions(0, false);
      
      // Update total count
      const { count } = await supabase.from('mcqs').select('*', { count: 'exact', head: true });
      if (count !== null) setTotalCount(count);

    } catch (error) {
      console.error("Error bulk deleting questions:", error);
      alert("Failed to delete some questions. Please try again.");
    }
  };

  const confirmFlag = async () => {
    if (flaggingId) {
      await flagMCQ(flaggingId, reason);
      setFlaggingId(null);
      setReason('');
      
      // Refresh current page
      setCurrentPage(0);
      fetchQuestions(0, false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this question?')) {
      await deleteMCQ(id);
      
      // Refresh
      setCurrentPage(0);
      setQuestions([]);
      fetchQuestions(0, false);
      setTotalCount(prev => Math.max(0, prev - 1));
    }
  };

  const handleUnflag = async (id: string) => {
    await unflagMCQ(id);
    
    // Refresh
    setCurrentPage(0);
    fetchQuestions(0, false);
  };

  const isAllSelected = questions.length > 0 && selectedIds.size === questions.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < questions.length;

  return (
    <div className="space-y-6 reveal-on-scroll text-white">
      {/* --- Header & Search --- */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-start md:items-center">
          <div>
            <h2 className="text-3xl font-extrabold mb-1">Question Bank</h2>
            <div className="flex items-center gap-4 text-sm text-gray-400">
               <span className="flex items-center gap-2"><InformationCircleIcon className="h-4 w-4" /> Manage and review your MCQ repository</span>
               {/* Question Counters */}
               <span className="bg-gray-800 px-3 py-1 rounded-full text-xs font-mono text-gray-300 border border-gray-700">
                  Showing <span className="text-white font-bold">{questions.length}</span> / <span className="text-green-500 font-bold">{filteredTotalCount}</span> Filtered (<span className="text-gray-500">{totalCount}</span> Total)
               </span>
            </div>
          </div>
        </div>

        {/* --- Filter Bar --- */}
        <div className="flex flex-col md:flex-row gap-4 bg-gray-900/50 p-4 rounded-2xl border border-gray-800 backdrop-blur-md">
           
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

             {/* Topic Filter */}
             <select 
               value={filterTopic} 
               onChange={(e) => setFilterTopic(e.target.value)} 
               disabled={filterSubject === 'All' || loadingTopics}
               className={`bg-gray-800 border border-gray-700 text-xs font-bold text-white rounded-lg px-3 py-2.5 outline-none transition ${filterSubject === 'All' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-green-500'}`}
             >
                <option value="All">
                   {loadingTopics ? 'Loading topics...' : filterSubject === 'All' ? 'Select Subject First' : 'All Topics'}
                </option>
                {availableTopics.map(topic => (
                  <option key={topic} value={topic}>{topic}</option>
                ))}
             </select>

             {/* Grade */}
             <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} className="bg-gray-800 border border-gray-700 text-xs font-bold text-white rounded-lg px-3 py-2.5 outline-none cursor-pointer hover:border-green-500 transition">
                <option value="All">All Grades</option>
                <option value="10">Grade 10</option>
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

        {/* --- Bulk Actions Bar --- */}
        {selectedIds.size > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center justify-between animate-scale-in">
            <div className="flex items-center gap-3">
              <div className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
                {selectedIds.size} Selected
              </div>
              <span className="text-sm text-gray-300">
                {selectedIds.size === 1 ? '1 question selected' : `${selectedIds.size} questions selected`}
              </span>
            </div>
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl font-bold text-sm transition flex items-center gap-2 shadow-lg shadow-red-900/20"
            >
              <TrashIcon className="h-4 w-4" />
              Delete Selected
            </button>
          </div>
        )}
      </div>

      {/* --- Table --- */}
      <div className="bg-gray-900/40 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-800/50 border-b border-gray-800">
              <th className="p-5 w-12">
                <div className="flex items-center justify-center">
                  <label className="relative flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="peer sr-only"
                    />
                    <div className="w-5 h-5 border-2 border-gray-600 rounded bg-gray-800/80 peer-checked:bg-red-500 peer-checked:border-red-500 hover:border-gray-500 transition-all duration-200 flex items-center justify-center relative">
                      {isSomeSelected && !isAllSelected ? (
                        <div className="w-2.5 h-0.5 bg-white rounded-full"></div>
                      ) : (
                        <svg className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </label>
                </div>
              </th>
              <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest w-1/2">Question</th>
              <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Metadata</th>
              <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</th>
              <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {loading ? (
               <tr><td colSpan={5} className="p-10 text-center text-gray-500">Loading questions...</td></tr>
            ) : questions.length === 0 ? (
               <tr><td colSpan={5} className="p-10 text-center text-gray-500">No questions found matching your filters.</td></tr>
            ) : (
              questions.map(q => (
                <tr 
                  key={q.id} 
                  className={`group hover:bg-white/[0.02] transition-colors ${selectedIds.has(q.id!) ? 'bg-red-500/5' : ''}`}
                >
                  <td className="p-5">
                    <div className="flex items-center justify-center">
                      <label className="relative flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(q.id!)}
                          onChange={() => toggleSelectOne(q.id!)}
                          className="peer sr-only"
                        />
                        <div className="w-5 h-5 border-2 border-gray-600 rounded bg-gray-800/80 peer-checked:bg-red-500 peer-checked:border-red-500 hover:border-gray-500 transition-all duration-200 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </label>
                    </div>
                  </td>
                  <td className="p-5">
                     <div className="flex gap-3">
                       {q.imageUrl && <PhotoIcon className="h-5 w-5 text-green-500 shrink-0 mt-1" />}
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

        {/* --- NEW: Load More Section --- */}
        {!loading && questions.length > 0 && hasMore && (
          <div ref={loadMoreRef} className="border-t border-gray-800 p-6 flex flex-col items-center gap-3 bg-gray-900/20">
            {loadingMore ? (
              <div className="flex items-center gap-3 text-gray-400">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm font-medium">Loading more questions...</span>
              </div>
            ) : (
              <>
                <button
                  onClick={handleLoadMore}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-bold text-sm transition shadow-lg shadow-green-900/20 flex items-center gap-2"
                >
                  Load More Questions
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <p className="text-xs text-gray-500">
                  {filteredTotalCount - questions.length} more question{filteredTotalCount - questions.length !== 1 ? 's' : ''} available
                </p>
              </>
            )}
          </div>
        )}

        {/* --- End of Results Message --- */}
        {!loading && questions.length > 0 && !hasMore && (
          <div className="border-t border-gray-800 p-6 text-center">
            <p className="text-sm text-gray-500">
              You've reached the end! All {filteredTotalCount} question{filteredTotalCount !== 1 ? 's' : ''} loaded.
            </p>
          </div>
        )}
      </div>

      {/* --- Bulk Delete Confirmation Modal --- */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
           <div className="bg-gray-900 border border-gray-700 w-full max-w-md rounded-3xl p-8 animate-scale-in shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-4">Delete Multiple Questions</h3>
              <p className="text-sm text-gray-400 mb-6">
                Are you sure you want to delete <span className="text-red-500 font-bold">{selectedIds.size}</span> {selectedIds.size === 1 ? 'question' : 'questions'}? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-4">
                 <button 
                   onClick={() => setShowBulkDeleteConfirm(false)} 
                   className="text-gray-400 font-bold text-sm hover:text-white transition"
                 >
                   Cancel
                 </button>
                 <button 
                   onClick={handleBulkDelete} 
                   className="bg-red-600 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-red-700 transition shadow-lg shadow-red-900/20"
                 >
                   Delete {selectedIds.size} {selectedIds.size === 1 ? 'Question' : 'Questions'}
                 </button>
              </div>
           </div>
        </div>
      )}

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
