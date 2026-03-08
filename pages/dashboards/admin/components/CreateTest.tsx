import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../services/supabase';
import { InformationCircleIcon, FunnelIcon } from '../../../../components/icons';

const CreateTest: React.FC = () => {
  // --- 1. Global Test Metadata ---
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState<number | string>(60);
  const [startWindow, setStartWindow] = useState('');
  const [endWindow, setEndWindow] = useState('');
  
  const [finalQuestionIds, setFinalQuestionIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'custom' | 'existing'>('existing');

  // --- 2. Existing Paper Tab ---
  const [offlinePapers, setOfflinePapers] = useState<any[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState('All');

  // --- 3. Custom Tab Filters ---
  const [numberOfQuestions, setNumberOfQuestions] = useState<number | string>(20);
  const [filterGrade, setFilterGrade] = useState('All');
  const [filterSubject, setFilterSubject] = useState('All');
  const [filterTopic, setFilterTopic] = useState('All');
  const [filterSubTopic, setFilterSubTopic] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [filterDifficulty, setFilterDifficulty] = useState('All');

  // --- 4. Difficulty Distribution ---
  const [useDistribution, setUseDistribution] = useState(false);
  const [easyPercent, setEasyPercent] = useState(50);
  const [mediumPercent, setMediumPercent] = useState(30);
  const [hardPercent, setHardPercent] = useState(20);

  const distributionTotal = easyPercent + mediumPercent + hardPercent;
  const isDistributionValid = distributionTotal === 100;

  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [availableSubTopics, setAvailableSubTopics] = useState<string[]>([]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState<any[]>([]);
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Fetch Existing Papers ---
  useEffect(() => {
    const fetchPapers = async () => {
      const { data } = await supabase.from('offline_papers').select('*').order('created_at', { ascending: false });
      if (data) setOfflinePapers(data);
    };
    fetchPapers();
  }, []);

  // --- Dynamic Topics ---
  useEffect(() => {
    const fetchTopics = async () => {
      setFilterTopic('All'); setFilterSubTopic('All'); setAvailableSubTopics([]);
      if (filterSubject === 'All') { setAvailableTopics([]); return; }
      const { data } = await supabase.from('mcqs').select('topic').eq('subject', filterSubject).eq('isFlagged', false);
      if (data) setAvailableTopics(Array.from(new Set(data.map(item => item.topic).filter(Boolean))).sort() as string[]);
    };
    fetchTopics();
  }, [filterSubject]);

  // --- Dynamic Sub-Topics ---
  useEffect(() => {
    const fetchSubTopics = async () => {
      setFilterSubTopic('All');
      if (filterTopic === 'All') { setAvailableSubTopics([]); return; }
      const { data } = await supabase.from('mcqs').select('sub_topic').eq('topic', filterTopic).eq('isFlagged', false);
      if (data) setAvailableSubTopics(Array.from(new Set(data.map(item => item.sub_topic).filter(Boolean))).sort() as string[]);
    };
    fetchSubTopics();
  }, [filterTopic]);

  const handlePaperSelection = async (paperId: string) => {
    setSelectedPaperId(paperId);
    if (paperId === 'All') {
      setFinalQuestionIds([]);
      setPreviewQuestions([]);
      return;
    }
    const paper = offlinePapers.find(p => p.id === paperId);
    if (paper) {
      const ids = paper.question_ids || paper.questionids || [];
      setFinalQuestionIds(ids);
      const { data } = await supabase.from('mcqs').select('*').in('id', ids);
      if (data) setPreviewQuestions(data);
    }
  };

  const handleAutoSelect = async () => {
    setMessage(null);
    const targetCount = Number(numberOfQuestions);
    if (!targetCount || targetCount < 1) return setMessage({ type: 'error', text: 'Enter a valid number of questions.' });
    if (useDistribution && !isDistributionValid) return setMessage({ type: 'error', text: 'Difficulty percentages must equal 100%.' });

    setIsGenerating(true);
    try {
      let query = supabase.from('mcqs').select('*').eq('isFlagged', false);
      
      if (filterGrade !== 'All') query = query.eq('grade', filterGrade);
      if (filterSubject !== 'All') query = query.eq('subject', filterSubject);
      if (filterTopic !== 'All') query = query.eq('topic', filterTopic);
      if (filterSubTopic !== 'All') query = query.eq('sub_topic', filterSubTopic);
      if (filterType !== 'All') query = query.eq('type', filterType);
      if (!useDistribution && filterDifficulty !== 'All') query = query.eq('difficulty', filterDifficulty);

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) {
        setIsGenerating(false);
        return setMessage({ type: 'error', text: 'No questions match your filters.' });
      }

      let selectedQuestions: any[] = [];
      const shuffleArray = (arr: any[]) => [...arr].sort(() => 0.5 - Math.random());

      if (useDistribution) {
        const easyQuestions = data.filter(q => q.difficulty === 'Easy');
        const mediumQuestions = data.filter(q => q.difficulty === 'Medium');
        const hardQuestions = data.filter(q => q.difficulty === 'Hard');

        const easyCount = Math.round((easyPercent / 100) * targetCount);
        const mediumCount = Math.round((mediumPercent / 100) * targetCount);
        const hardCount = Math.round((hardPercent / 100) * targetCount);

        if (easyQuestions.length < easyCount || mediumQuestions.length < mediumCount || hardQuestions.length < hardCount) {
          setIsGenerating(false);
          return setMessage({ type: 'error', text: `Insufficient questions. Available: Easy(${easyQuestions.length}), Medium(${mediumQuestions.length}), Hard(${hardQuestions.length}).` });
        }

        selectedQuestions = [
          ...shuffleArray(easyQuestions).slice(0, easyCount),
          ...shuffleArray(mediumQuestions).slice(0, mediumCount),
          ...shuffleArray(hardQuestions).slice(0, hardCount)
        ];
        
        // Shuffle the combined array so easy/medium/hard are mixed
        selectedQuestions = shuffleArray(selectedQuestions);
      } else {
        const shuffled = shuffleArray(data);
        selectedQuestions = shuffled.slice(0, Math.min(targetCount, data.length));
      }

      setPreviewQuestions(selectedQuestions);
      setFinalQuestionIds(selectedQuestions.map(q => q.id));

      if (data.length < targetCount && !useDistribution) {
        setMessage({ type: 'success', text: `Only ${data.length} questions matched filters. Added all of them.` });
      } else {
        setMessage({ type: 'success', text: `Successfully auto-selected ${selectedQuestions.length} questions!` });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to fetch questions.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateTest = async () => {
    setMessage(null);
    if (!title.trim()) return setMessage({ type: 'error', text: 'Test title is required.' });
    if (!startWindow || !endWindow) return setMessage({ type: 'error', text: 'Start and End dates are required.' });
    if (finalQuestionIds.length === 0) return setMessage({ type: 'error', text: 'You must select or generate questions first.' });

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('tests').insert({
        title: title,
        duration_minutes: Number(duration),
        start_window: new Date(startWindow).toISOString(),
        end_window: new Date(endWindow).toISOString(),
        status: 'Upcoming',
        question_ids: finalQuestionIds
      });

      if (error) throw error;
      setMessage({ type: 'success', text: `Test "${title}" created successfully with ${finalQuestionIds.length} questions!` });
      
      setTitle(''); setStartWindow(''); setEndWindow(''); setFinalQuestionIds([]); setPreviewQuestions([]); setSelectedPaperId('All');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to create test.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 text-white pb-20">
      <div>
        <h2 className="text-3xl font-extrabold mb-1">Create Online Test</h2>
        <p className="text-sm text-gray-400 flex items-center gap-2">
          <InformationCircleIcon className="h-4 w-4" /> 
          Configure test metadata and generate your question pool.
        </p>
      </div>

      <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800 space-y-6">
        <h3 className="text-xl font-bold border-b border-gray-800 pb-2">1. Test Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-400">Test Title <span className="text-red-500">*</span></label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Mid Term Exam" className="bg-gray-800 border border-gray-700 rounded-xl py-2.5 px-4 focus:border-green-500 outline-none text-sm" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-400">Duration (Mins) <span className="text-red-500">*</span></label>
            <input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-xl py-2.5 px-4 focus:border-green-500 outline-none text-sm" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-400">Start Date & Time <span className="text-red-500">*</span></label>
            <input type="datetime-local" value={startWindow} onChange={e => setStartWindow(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-xl py-2.5 px-4 focus:border-green-500 outline-none text-sm" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-400">Expiry Date & Time <span className="text-red-500">*</span></label>
            <input type="datetime-local" value={endWindow} onChange={e => setEndWindow(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-xl py-2.5 px-4 focus:border-green-500 outline-none text-sm" />
          </div>
        </div>
      </div>

      <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800">
        <div className="flex justify-between items-center border-b border-gray-800 pb-4 mb-4">
          <h3 className="text-xl font-bold">2. Select Questions</h3>
          <span className="bg-green-600/20 text-green-500 px-3 py-1 rounded-full text-sm font-bold border border-green-500/20">
            Questions Ready: {finalQuestionIds.length}
          </span>
        </div>

        <div className="flex gap-4 mb-6">
          <button onClick={() => setActiveTab('existing')} className={`px-6 py-2.5 rounded-xl font-bold text-sm transition ${activeTab === 'existing' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            Load from Existing Paper
          </button>
          <button onClick={() => setActiveTab('custom')} className={`px-6 py-2.5 rounded-xl font-bold text-sm transition ${activeTab === 'custom' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            Auto-Generate from Bank
          </button>
        </div>

        {activeTab === 'existing' && (
          <div className="animate-fade-in flex flex-col gap-2 max-w-md">
            <label className="text-sm font-bold text-gray-400">Select an Offline Paper</label>
            <select value={selectedPaperId} onChange={(e) => handlePaperSelection(e.target.value)} className="bg-gray-800 border border-gray-700 text-sm font-bold text-white rounded-lg px-3 py-3 outline-none cursor-pointer">
              <option value="All">-- Choose a Paper --</option>
              {offlinePapers.map(paper => (
                <option key={paper.id} value={paper.id}>{paper.title} ({paper.subject})</option>
              ))}
            </select>
          </div>
        )}

        {activeTab === 'custom' && (
          <div className="animate-fade-in space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
               <div className="flex flex-col gap-2">
                 <label className="text-xs font-bold text-gray-500 uppercase">Grade</label>
                 <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className="bg-gray-800 border border-gray-700 text-sm font-bold text-white rounded-lg px-3 py-2.5 outline-none hover:border-green-500">
                    <option value="All">All Grades</option>
                    <option value="10">Grade 10</option>
                    <option value="11">Grade 11</option>
                    <option value="12">Grade 12</option>
                 </select>
               </div>
               <div className="flex flex-col gap-2">
                 <label className="text-xs font-bold text-gray-500 uppercase">Subject</label>
                 <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className="bg-gray-800 border border-gray-700 text-sm font-bold text-white rounded-lg px-3 py-2.5 outline-none hover:border-green-500">
                    <option value="All">All Subjects</option>
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Biology">Biology</option>
                    <option value="Mathematics">Mathematics</option>
                 </select>
               </div>
               <div className="flex flex-col gap-2">
                 <label className="text-xs font-bold text-gray-500 uppercase">Topic</label>
                 <select value={filterTopic} onChange={e => setFilterTopic(e.target.value)} disabled={filterSubject === 'All'} className="bg-gray-800 border border-gray-700 text-sm font-bold text-white rounded-lg px-3 py-2.5 outline-none disabled:opacity-50 hover:border-green-500">
                    <option value="All">{filterSubject === 'All' ? 'Select Subject First' : 'All Topics'}</option>
                    {availableTopics.map(t => <option key={t} value={t}>{t}</option>)}
                 </select>
               </div>
               <div className="flex flex-col gap-2">
                 <label className="text-xs font-bold text-gray-500 uppercase">Difficulty</label>
                 <select value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)} disabled={useDistribution} className="bg-gray-800 border border-gray-700 text-sm font-bold text-white rounded-lg px-3 py-2.5 outline-none hover:border-green-500 disabled:opacity-50">
                    <option value="All">Mixed Difficulty</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                 </select>
               </div>
               <div className="flex flex-col gap-2">
                 <label className="text-xs font-bold text-green-500 uppercase">Total Questions</label>
                 <input type="number" min="1" max="100" value={numberOfQuestions} onChange={e => setNumberOfQuestions(e.target.value)} className="w-full bg-gray-800 border border-green-500/50 text-sm font-bold rounded-lg py-2.5 px-4 focus:border-green-500 outline-none text-white transition" />
               </div>
            </div>

            {/* Difficulty Distribution Toggle */}
            <div className="border border-gray-700 rounded-xl p-4 bg-gray-800/30">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={useDistribution} onChange={(e) => setUseDistribution(e.target.checked)} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                  <span className="text-sm font-bold text-white">Use Difficulty Distribution</span>
                </div>
                {!isDistributionValid && useDistribution && <span className="text-xs font-bold text-red-500">Must equal 100%</span>}
              </div>

              {useDistribution && (
                <div className="grid grid-cols-3 gap-4 animate-fade-in">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-green-400 uppercase flex items-center justify-between"><span>Easy</span><span>{easyPercent}%</span></label>
                    <input type="range" min="0" max="100" step="5" value={easyPercent} onChange={(e) => setEasyPercent(parseInt(e.target.value, 10))} className="w-full accent-green-500" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-yellow-400 uppercase flex items-center justify-between"><span>Medium</span><span>{mediumPercent}%</span></label>
                    <input type="range" min="0" max="100" step="5" value={mediumPercent} onChange={(e) => setMediumPercent(parseInt(e.target.value, 10))} className="w-full accent-yellow-500" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-red-400 uppercase flex items-center justify-between"><span>Hard</span><span>{hardPercent}%</span></label>
                    <input type="range" min="0" max="100" step="5" value={hardPercent} onChange={(e) => setHardPercent(parseInt(e.target.value, 10))} className="w-full accent-red-500" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
               <button onClick={handleAutoSelect} disabled={isGenerating || (useDistribution && !isDistributionValid)} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg flex items-center gap-2">
                  {isGenerating ? 'Selecting...' : 'Auto-Select Questions'}
                  {!isGenerating && <FunnelIcon className="h-4 w-4" />}
               </button>
            </div>
          </div>
        )}

        {previewQuestions.length > 0 && (
          <div className="mt-8 animate-fade-in">
            <h4 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">Preview ({previewQuestions.length} Questions)</h4>
            <div className="border border-gray-800 rounded-xl overflow-hidden shadow-xl max-h-80 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-800/90 sticky top-0 backdrop-blur">
                  <tr>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase border-b border-gray-700 w-12 text-center">#</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase border-b border-gray-700">Question Text</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase border-b border-gray-700 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50 bg-gray-900/30">
                  {previewQuestions.map((q, index) => (
                    <tr key={q.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 text-center text-gray-500 font-mono text-sm">{index + 1}</td>
                      <td className="p-4 text-sm text-gray-300 font-medium">{q.question}</td>
                      <td className="p-4 text-xs text-gray-500 text-right">{q.subject} • {q.difficulty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between pt-4 gap-4 border-t border-gray-800">
        <div className="flex-1">
          {message && <p className={`text-sm font-bold ${message.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>{message.text}</p>}
        </div>
        <button onClick={handleCreateTest} disabled={isSubmitting || finalQuestionIds.length === 0} className="w-full md:w-auto bg-green-600 hover:bg-green-700 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white px-10 py-3 rounded-xl font-bold text-lg shadow-lg transition">
          {isSubmitting ? 'Publishing...' : 'Publish Online Test'}
        </button>
      </div>
    </div>
  );
};

export default CreateTest;
