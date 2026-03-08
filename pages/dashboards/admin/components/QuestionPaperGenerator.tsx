import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../services/supabase';
import { MCQ } from '../../../../types';
import { InformationCircleIcon, FunnelIcon, TrashIcon } from '../../../../components/icons';
import jsPDF from 'jspdf';

// --- Type Definition for Offline Paper History ---
interface OfflinePaper {
  id: string;
  title: string;
  duration: number;
  total_marks: number;
  subject: string;
  grade: string;
  question_ids: string[];
  created_at: string;
}

const ALL_SUBJECTS = ['Physics', 'Chemistry', 'Biology', 'Mathematics'];

type TabView = 'generator' | 'history';

const QuestionPaperGenerator: React.FC = () => {
  // --- View Toggle State ---
  const [activeTab, setActiveTab] = useState<TabView>('generator');

  // --- Form & Basic Filter States ---
  const [paperTitle, setPaperTitle] = useState('');
  const [duration, setDuration] = useState<number | string>(60);
  const [numberOfQuestions, setNumberOfQuestions] = useState<number | string>(20);
  const [filterGrade, setFilterGrade] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [filterDifficulty, setFilterDifficulty] = useState('All');

  // --- Multi-Select Array States ---
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedSubTopics, setSelectedSubTopics] = useState<string[]>([]);

  // --- Search Input States ---
  const [subjectSearch, setSubjectSearch] = useState('');
  const [topicSearch, setTopicSearch] = useState('');
  const [subTopicSearch, setSubTopicSearch] = useState('');

  // --- Difficulty Distribution States ---
  const [useDistribution, setUseDistribution] = useState(false);
  const [easyPercent, setEasyPercent] = useState(50);
  const [mediumPercent, setMediumPercent] = useState(30);
  const [hardPercent, setHardPercent] = useState(20);

  // --- Dynamic Dropdown States ---
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [availableSubTopics, setAvailableSubTopics] = useState<string[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [loadingSubTopics, setLoadingSubTopics] = useState(false);

  // --- Generation & Saving States ---
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [generatedPaper, setGeneratedPaper] = useState<MCQ[]>([]);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // --- History States ---
  const [paperHistory, setPaperHistory] = useState<OfflinePaper[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // --- View Paper Modal States ---
  const [historyQuestionsOpen, setHistoryQuestionsOpen] = useState(false);
  const [historyActivePaper, setHistoryActivePaper] = useState<OfflinePaper | null>(null);
  const [historyQuestions, setHistoryQuestions] = useState<MCQ[]>([]);
  const [loadingHistoryQuestions, setLoadingHistoryQuestions] = useState(false);
  const [historyQuestionsError, setHistoryQuestionsError] = useState<string | null>(null);

  // Percent total validation
  const distributionTotal = easyPercent + mediumPercent + hardPercent;
  const isDistributionValid = distributionTotal === 100;

  const safeDuration = Number(duration) || 0;
  const safeTotalQuestions = Number(numberOfQuestions) || 0;

  // --- Fetch Topics when Selected Subjects Change ---
  useEffect(() => {
    const fetchTopics = async () => {
      setSelectedTopics([]);
      setSelectedSubTopics([]);
      setAvailableSubTopics([]);

      if (selectedSubjects.length === 0) {
        setAvailableTopics([]);
        return;
      }

      setLoadingTopics(true);
      try {
        const { data, error } = await supabase
          .from('mcqs')
          .select('topic')
          .in('subject', selectedSubjects)
          .eq('isFlagged', false);

        if (!error && data) {
          const uniqueTopics = Array.from(
            new Set(data.map(item => item.topic).filter(Boolean))
          ).sort();
          setAvailableTopics(uniqueTopics as string[]);
        }
      } catch (err) {
        console.error('Error fetching topics:', err);
      } finally {
        setLoadingTopics(false);
      }
    };
    fetchTopics();
  }, [selectedSubjects]);

  // --- Fetch Sub-Topics when Selected Topics Change ---
  useEffect(() => {
    const fetchSubTopics = async () => {
      setSelectedSubTopics([]);

      if (selectedTopics.length === 0) {
        setAvailableSubTopics([]);
        return;
      }

      setLoadingSubTopics(true);
      try {
        const { data, error } = await supabase
          .from('mcqs')
          .select('sub_topic')
          .in('topic', selectedTopics)
          .eq('isFlagged', false);

        if (!error && data) {
          const uniqueSubTopics = Array.from(
            new Set(data.map(item => item.sub_topic).filter(Boolean))
          ).sort();
          setAvailableSubTopics(uniqueSubTopics as string[]);
        }
      } catch (err) {
        console.error('Error fetching sub-topics:', err);
      } finally {
        setLoadingSubTopics(false);
      }
    };
    fetchSubTopics();
  }, [selectedTopics]);

  // --- Fetch History of Generated Papers ---
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('offline_papers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setPaperHistory(data as OfflinePaper[]);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Fetch history when tab changes to history
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  // --- Handle Generate Paper ---
  const handleGenerate = async () => {
    setMessage(null);
    setGeneratedPaper([]);

    if (!paperTitle.trim()) {
      setMessage({ type: 'error', text: 'Please enter a title for the Question Paper.' });
      return;
    }

    if (!safeTotalQuestions || safeTotalQuestions < 1) {
      setMessage({ type: 'error', text: 'Please enter a valid number of questions.' });
      return;
    }

    if (useDistribution && !isDistributionValid) {
      setMessage({ type: 'error', text: 'Difficulty percentages must add up to 100%.' });
      return;
    }

    setGenerating(true);
    try {
      let query = supabase.from('mcqs').select('*').eq('isFlagged', false);

      if (filterGrade !== 'All') query = query.eq('grade', filterGrade);
      if (selectedSubjects.length > 0) query = query.in('subject', selectedSubjects);
      if (selectedTopics.length > 0) query = query.in('topic', selectedTopics);
      if (selectedSubTopics.length > 0) query = query.in('sub_topic', selectedSubTopics);
      if (filterType !== 'All') query = query.eq('type', filterType);

      if (!useDistribution && filterDifficulty !== 'All') {
        query = query.eq('difficulty', filterDifficulty);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        setMessage({
          type: 'error',
          text: 'No questions found matching your selected filters in the Question Bank.',
        });
        setGenerating(false);
        return;
      }

      let selectedQuestions: MCQ[] = [];
      const shuffleArray = (arr: MCQ[]) => arr.sort(() => 0.5 - Math.random());

      if (useDistribution) {
        const easyQuestions = data.filter(q => q.difficulty === 'Easy');
        const mediumQuestions = data.filter(q => q.difficulty === 'Medium');
        const hardQuestions = data.filter(q => q.difficulty === 'Hard');

        const easyCount = Math.round((easyPercent / 100) * safeTotalQuestions);
        const mediumCount = Math.round((mediumPercent / 100) * safeTotalQuestions);
        const hardCount = Math.round((hardPercent / 100) * safeTotalQuestions);

        if (
          easyQuestions.length < easyCount ||
          mediumQuestions.length < mediumCount ||
          hardQuestions.length < hardCount
        ) {
          setMessage({
            type: 'error',
            text: `Insufficient questions. Available: Easy(${easyQuestions.length}), Medium(${mediumQuestions.length}), Hard(${hardQuestions.length}).`,
          });
          setGenerating(false);
          return;
        }

        const selectedEasy = shuffleArray([...easyQuestions]).slice(0, easyCount);
        const selectedMedium = shuffleArray([...mediumQuestions]).slice(0, mediumCount);
        const selectedHard = shuffleArray([...hardQuestions]).slice(0, hardCount);

        selectedQuestions = shuffleArray([...selectedEasy, ...selectedMedium, ...selectedHard]);
      } else {
        const shuffled = shuffleArray(data as MCQ[]);
        selectedQuestions = shuffled.slice(0, Math.min(safeTotalQuestions, data.length));

        if (data.length < safeTotalQuestions) {
          setMessage({
            type: 'success',
            text: `Only ${data.length} questions matched your filters. Added all of them.`,
          });
        }
      }

      if (selectedQuestions.length > 0) {
        setGeneratedPaper(selectedQuestions);
        if (!message) {
          setMessage({
            type: 'success',
            text: `Successfully generated ${selectedQuestions.length} questions!`,
          });
        }
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to generate paper. Please try again.' });
    } finally {
      setGenerating(false);
    }
  };

  // --- Handle Save to Database ---
  const handleSavePaper = async () => {
    if (generatedPaper.length === 0) return;
    setSaving(true);
    setMessage(null);

    try {
      const questionIds = generatedPaper.map(q => q.id);
      const totalMarks = generatedPaper.reduce((sum, q) => sum + (q.marks || 1), 0);
      const subjectText = selectedSubjects.length > 0 ? selectedSubjects.join(', ') : 'Mixed';

      const { error } = await supabase.from('offline_papers').insert([
        {
          title: paperTitle,
          duration: safeDuration || 60,
          question_ids: questionIds,
          total_marks: totalMarks,
          subject: subjectText,
          grade: filterGrade !== 'All' ? filterGrade : 'Mixed',
        },
      ]);

      if (error) throw new Error(error.message);

      setMessage({ type: 'success', text: 'Offline Paper successfully saved to history!' });

      setTimeout(() => {
        setGeneratedPaper([]);
        setPaperTitle('');
        setMessage(null);
      }, 2500);
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: `Failed to save: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  // --- Helper Function: Generate PDF ---
  const generatePDFDocument = (questions: MCQ[], docTitle: string, docDuration: number, docSubject: string) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(docTitle, pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Duration: ${docDuration} minutes | Total Questions: ${questions.length}`, pageWidth / 2, 28, { align: 'center' });
    doc.text(`Subject: ${docSubject}`, pageWidth / 2, 34, { align: 'center' });

    doc.setDrawColor(200);
    doc.line(margin, 38, pageWidth - margin, 38);

    let yPosition = 48;

    questions.forEach((q, index) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`Q${index + 1}.`, margin, yPosition);

      doc.setFont('helvetica', 'normal');
      const questionLines = doc.splitTextToSize(q.question, pageWidth - margin * 2 - 10);
      doc.text(questionLines, margin + 10, yPosition);
      yPosition += questionLines.length * 5 + 2;

      if (q.type === 'Multiple Choice' && q.options) {
        const opts = Array.isArray(q.options) ? q.options : [];
        opts.forEach((opt: string, i: number) => {
          const optionText = `${String.fromCharCode(65 + i)}) ${opt}`;
          const optionLines = doc.splitTextToSize(optionText, pageWidth - margin * 2 - 15);
          doc.text(optionLines, margin + 15, yPosition);
          yPosition += optionLines.length * 5;
        });
      }

      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`[${q.difficulty || 'N/A'} | ${q.subject} | ${q.topic || 'General'}]`, margin + 10, yPosition + 2);
      doc.setTextColor(0);
      yPosition += 10;
    });

    const fileName = `${docTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  // --- Handle Current PDF Download ---
  const handleDownloadPDF = () => {
    const subjectText = selectedSubjects.length > 0 ? selectedSubjects.join(', ') : 'Mixed';
    generatePDFDocument(generatedPaper, paperTitle, safeDuration, subjectText);
    setMessage({ type: 'success', text: 'PDF downloaded successfully!' });
  };

  // --- Handle Re-Download PDF from History ---
  const handleReDownload = async (paper: OfflinePaper) => {
    setDownloadingPDF(true);
    setMessage({ type: 'success', text: 'Fetching questions to rebuild PDF...' });
    
    try {
      const { data: questions, error } = await supabase
        .from('mcqs')
        .select('*')
        .in('id', paper.question_ids);

      if (error) throw error;
      if (!questions || questions.length === 0) {
        throw new Error("Questions for this paper no longer exist in the database.");
      }

      const orderedQuestions = paper.question_ids
        .map(id => questions.find(q => q.id === id))
        .filter(Boolean) as MCQ[];

      generatePDFDocument(orderedQuestions, paper.title, paper.duration, paper.subject);
      setMessage({ type: 'success', text: 'PDF downloaded successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      console.error('Re-download error:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to re-download PDF.' });
    } finally {
      setDownloadingPDF(false);
    }
  };

  // --- Handle Delete Paper History ---
  const handleDeletePaper = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this paper record?")) return;
    try {
      const { error } = await supabase.from('offline_papers').delete().eq('id', id);
      if (error) throw error;
      setPaperHistory(prev => prev.filter(p => p.id !== id));
      setMessage({ type: 'success', text: 'Paper deleted from history!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to delete the paper.' });
    }
  };

  // --- Handle View Paper Questions (Modal) ---
  const handleViewPaperQuestions = async (paper: OfflinePaper) => {
    setHistoryActivePaper(paper);
    setHistoryQuestions([]);
    setHistoryQuestionsError(null);
    setHistoryQuestionsOpen(true);

    if (!paper.question_ids || paper.question_ids.length === 0) {
      setHistoryQuestionsError('No questions were saved for this paper.');
      return;
    }

    setLoadingHistoryQuestions(true);
    try {
      const { data, error } = await supabase
        .from('mcqs')
        .select('*')
        .in('id', paper.question_ids);

      if (error) throw error;

      const questions = (data || []) as MCQ[];
      
      const ordered = paper.question_ids
        .map(id => questions.find(q => q.id === id))
        .filter(Boolean) as MCQ[];

      const missingCount = paper.question_ids.length - ordered.length;
      if (missingCount > 0) {
        setHistoryQuestionsError(`${missingCount} question(s) from this paper are missing in the Question Bank.`);
      }

      setHistoryQuestions(ordered);
    } catch (e: any) {
      setHistoryQuestionsError(e?.message || 'Failed to load questions.');
    } finally {
      setLoadingHistoryQuestions(false);
    }
  };

  const closeHistoryQuestions = () => {
    setHistoryQuestionsOpen(false);
    setTimeout(() => {
      setHistoryActivePaper(null);
      setHistoryQuestions([]);
      setHistoryQuestionsError(null);
    }, 200); 
  };

  // --- PREMIUM Searchable Checkbox Component ---
  const renderSearchableList = (
    title: string,
    items: string[],
    selected: string[],
    setSelected: React.Dispatch<React.SetStateAction<string[]>>,
    searchQuery: string,
    setSearchQuery: React.Dispatch<React.SetStateAction<string>>,
    disabled: boolean,
    emptyMessage: string,
    isLoading: boolean = false
  ) => {
    const filteredItems = items.filter(item => 
      item.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleToggle = (val: string) => {
      setSelected(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
    };

    const handleSelectAll = () => {
      if (selected.length === items.length && items.length > 0) setSelected([]);
      else setSelected([...items]);
    };

    return (
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center px-1">
          <label className="text-[13px] font-extrabold text-gray-300 uppercase tracking-widest">{title}</label>
          {!disabled && items.length > 0 && !isLoading && (
            <button 
              type="button" 
              onClick={handleSelectAll} 
              className={`text-xs font-bold px-3 py-1 rounded-md border transition-all duration-200 ${
                selected.length === items.length && items.length > 0
                  ? 'bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white' 
                  : 'bg-green-600/10 border-green-500/30 text-green-400 hover:bg-green-500 hover:text-white hover:border-green-500'
              }`}
            >
              {selected.length === items.length && items.length > 0 ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>
        
        <div className={`bg-gray-800/60 border border-gray-700/80 rounded-2xl overflow-hidden flex flex-col transition-all duration-300 shadow-lg ${disabled ? 'opacity-50 pointer-events-none' : 'focus-within:border-green-500/50 focus-within:ring-2 focus-within:ring-green-500/10 focus-within:bg-gray-800/90'}`}>
          <div className="relative border-b border-gray-700/60 bg-gray-900/40">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input 
              type="text" 
              placeholder={`Search ${title.toLowerCase()}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm pl-11 pr-4 py-3.5 outline-none text-white placeholder-gray-500 font-medium transition-colors"
              disabled={disabled || isLoading}
            />
          </div>

          <div className="h-52 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar relative">
            {isLoading ? (
              <div className="flex flex-col gap-3 p-2 animate-pulse">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded bg-gray-700/50 flex-shrink-0"></div>
                    <div className="h-4 bg-gray-700/50 rounded w-full max-w-[80%]"></div>
                  </div>
                ))}
              </div>
            ) : disabled ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-gray-500 text-center px-4 font-medium">{emptyMessage}</p>
              </div>
            ) : items.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-gray-500 text-center px-4 font-medium">No data found</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-gray-500 text-center px-4 font-medium">No match for "{searchQuery}"</p>
              </div>
            ) : (
              filteredItems.map(item => {
                const isSelected = selected.includes(item);
                return (
                  <div 
                    key={item} 
                    onClick={() => handleToggle(item)}
                    className={`flex items-start gap-3.5 cursor-pointer p-3 rounded-xl transition-all duration-200 group animate-fade-in
                      ${isSelected ? 'bg-green-500/10 border border-green-500/30 shadow-sm' : 'hover:bg-gray-700/40 border border-transparent'}`}
                  >
                    <div className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all duration-200 flex-shrink-0
                      ${isSelected ? 'bg-green-500 border-green-500 scale-105' : 'bg-gray-900 border-gray-600 group-hover:border-gray-400 group-hover:bg-gray-800'}`}
                    >
                      {isSelected && (
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm leading-tight transition-colors duration-200 pt-0.5 ${isSelected ? 'text-green-400 font-bold' : 'text-gray-300 font-medium group-hover:text-white'}`}>
                      {item}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="text-white relative min-h-screen">
      {/* Header and Toggle Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 reveal-on-scroll">
        <div>
          <h2 className="text-3xl font-extrabold mb-1 tracking-tight">Question Paper</h2>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-2">
              <InformationCircleIcon className="h-4 w-4" />
              Generate tailored question papers or manage history.
            </span>
          </div>
        </div>

        {/* --- PREMIUM SEGMENTED CONTROL TABS --- */}
        <div className="bg-gray-900/60 backdrop-blur-xl p-1.5 rounded-2xl border border-gray-800/80 shadow-inner flex items-center gap-1 w-full md:w-auto overflow-hidden">
          <button
            onClick={() => setActiveTab('generator')}
            className={`flex-1 md:w-48 py-2.5 px-4 rounded-xl text-sm font-bold transition-all duration-300 relative ${
              activeTab === 'generator' 
                ? 'text-white bg-gray-800 shadow-md border border-gray-700/50' 
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 border border-transparent'
            }`}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Generate Paper
            </span>
          </button>
          
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 md:w-48 py-2.5 px-4 rounded-xl text-sm font-bold transition-all duration-300 relative ${
              activeTab === 'history' 
                ? 'text-white bg-gray-800 shadow-md border border-gray-700/50' 
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 border border-transparent'
            }`}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Paper History
            </span>
          </button>
        </div>
      </div>

      {/* --- TAB CONTENT RENDERER --- */}
      <div className="relative">
        
        {/* ========================================================
            GENERATOR TAB VIEW
        ======================================================== */}
        {activeTab === 'generator' && (
          <div className="space-y-8 animate-fade-in pb-12">
            {/* Configuration Form */}
            <div className="bg-gray-900/40 p-6 lg:p-8 rounded-3xl border border-gray-800 backdrop-blur-xl space-y-8 shadow-2xl">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 flex flex-col gap-2.5">
                  <label className="text-sm font-bold text-gray-400">Paper Title <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="e.g., Grade 11 Mid-Term Exam" value={paperTitle} onChange={e => setPaperTitle(e.target.value)} className="w-full bg-gray-800/80 border border-gray-700/80 text-sm rounded-xl py-3 px-4 focus:border-green-500 outline-none text-white transition-all shadow-inner focus:ring-1 focus:ring-green-500/20"/>
                </div>
                <div className="flex flex-col gap-2.5">
                  <label className="text-sm font-bold text-gray-400">Duration (Minutes)</label>
                  <input type="number" value={duration} onChange={e => setDuration(e.target.value === '' ? '' : parseInt(e.target.value, 10))} className="w-full bg-gray-800/80 border border-gray-700/80 text-sm rounded-xl py-3 px-4 focus:border-green-500 outline-none text-white transition-all shadow-inner focus:ring-1 focus:ring-green-500/20"/>
                </div>
              </div>

              <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-700 to-transparent opacity-50" />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-extrabold text-gray-500 uppercase tracking-widest pl-1">Grade</label>
                  <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className="bg-gray-800/80 border border-gray-700/80 text-sm font-bold text-white rounded-xl px-4 py-3 outline-none cursor-pointer hover:border-green-500 transition-colors focus:border-green-500">
                    <option value="All">All Grades</option>
                    <option value="10">Grade 10</option>
                    <option value="11">Grade 11</option>
                    <option value="12">Grade 12</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-extrabold text-gray-500 uppercase tracking-widest pl-1">Question Type</label>
                  <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-gray-800/80 border border-gray-700/80 text-sm font-bold text-white rounded-xl px-4 py-3 outline-none cursor-pointer hover:border-green-500 transition-colors focus:border-green-500">
                    <option value="All">All Types</option>
                    <option value="Multiple Choice">Multiple Choice</option>
                    <option value="True/False">True/False</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-extrabold text-gray-500 uppercase tracking-widest pl-1">Difficulty</label>
                  <select value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)} disabled={useDistribution} className={`bg-gray-800/80 border border-gray-700/80 text-sm font-bold text-white rounded-xl px-4 py-3 outline-none transition-colors ${useDistribution ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-green-500 focus:border-green-500'}`}>
                    <option value="All">Mixed Difficulty</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-extrabold text-green-500 uppercase tracking-widest pl-1">Total Questions</label>
                  <input type="number" min={1} max={200} value={numberOfQuestions} onChange={e => setNumberOfQuestions(e.target.value === '' ? '' : parseInt(e.target.value, 10))} className="w-full bg-gray-800/80 border border-green-500/30 text-sm font-bold rounded-xl py-3 px-4 focus:border-green-500 outline-none text-white transition-all shadow-inner focus:ring-1 focus:ring-green-500/20"/>
                </div>
              </div>

              <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-700 to-transparent opacity-50" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                {renderSearchableList('Subjects', ALL_SUBJECTS, selectedSubjects, setSelectedSubjects, subjectSearch, setSubjectSearch, false, '', false)}
                {renderSearchableList('Topics', availableTopics, selectedTopics, setSelectedTopics, topicSearch, setTopicSearch, selectedSubjects.length === 0, 'Select at least one Subject first', loadingTopics)}
                {renderSearchableList('Sub-Topics', availableSubTopics, selectedSubTopics, setSelectedSubTopics, subTopicSearch, setSubTopicSearch, selectedTopics.length === 0, 'Select at least one Topic first', loadingSubTopics)}
              </div>

              <div className="border border-gray-700/80 rounded-2xl p-6 bg-gray-800/40 shadow-inner">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={useDistribution} onChange={e => setUseDistribution(e.target.checked)} className="sr-only peer" />
                      <div className="w-12 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500 shadow-inner" />
                    </label>
                    <span className="text-sm font-bold text-white tracking-wide">Use Difficulty Distribution</span>
                  </div>
                  {!isDistributionValid && useDistribution && <span className="text-xs font-bold text-red-400 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">Must equal 100%</span>}
                </div>

                {useDistribution && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in mt-6">
                    <div className="flex flex-col gap-3">
                      <label className="text-xs font-bold text-green-400 uppercase flex items-center justify-between"><span>Easy</span><span className="bg-green-500/10 px-2 py-0.5 rounded text-green-400">{easyPercent}%</span></label>
                      <input type="range" min={0} max={100} step={5} value={easyPercent} onChange={e => setEasyPercent(parseInt(e.target.value, 10))} className="w-full accent-green-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                    </div>
                    <div className="flex flex-col gap-3">
                      <label className="text-xs font-bold text-yellow-400 uppercase flex items-center justify-between"><span>Medium</span><span className="bg-yellow-500/10 px-2 py-0.5 rounded text-yellow-400">{mediumPercent}%</span></label>
                      <input type="range" min={0} max={100} step={5} value={mediumPercent} onChange={e => setMediumPercent(parseInt(e.target.value, 10))} className="w-full accent-yellow-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                    </div>
                    <div className="flex flex-col gap-3">
                      <label className="text-xs font-bold text-red-400 uppercase flex items-center justify-between"><span>Hard</span><span className="bg-red-500/10 px-2 py-0.5 rounded text-red-400">{hardPercent}%</span></label>
                      <input type="range" min={0} max={100} step={5} value={hardPercent} onChange={e => setHardPercent(parseInt(e.target.value, 10))} className="w-full accent-red-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"/>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-between items-center">
                <div className="flex-1">
                  {message && <p className={`text-sm font-bold animate-fade-in ${message.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>{message.text}</p>}
                </div>
                <button onClick={handleGenerate} disabled={generating || (useDistribution && !isDistributionValid)} className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:from-gray-700 disabled:to-gray-700 disabled:opacity-50 text-white px-8 py-3.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-green-900/20 flex items-center gap-2 transform active:scale-95">
                  {generating ? 'Searching Bank...' : 'Generate Question Paper'}
                  {!generating && <FunnelIcon className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {generatedPaper.length > 0 && (
              <div className="bg-gray-900/40 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl animate-fade-in">
                <div className="p-6 bg-gray-800/40 border-b border-gray-800 flex justify-between items-center flex-wrap gap-4">
                  <div>
                    <h3 className="font-bold text-white text-lg tracking-wide">Generated Paper Preview</h3>
                    <p className="text-xs text-gray-400 mt-1">{generatedPaper.length} Questions Ready</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleDownloadPDF} disabled={downloadingPDF} className="bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-purple-900/20 flex items-center gap-2 transform active:scale-95">
                      {downloadingPDF ? 'Generating...' : <span>Download PDF</span>}
                      {!downloadingPDF && <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>}
                    </button>

                    <button onClick={handleSavePaper} disabled={saving} className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/20 transform active:scale-95">
                      {saving ? 'Saving Paper...' : 'Save & Finalize Paper'}
                    </button>
                  </div>
                </div>

                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-800/20 border-b border-gray-800">
                      <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest w-16 text-center">No.</th>
                      <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest w-2/3">Question</th>
                      <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Metadata</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {generatedPaper.map((q, index) => (
                      <tr key={q.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-5 text-center text-gray-500 font-mono text-sm">{index + 1}</td>
                        <td className="p-5">
                          <p className="text-sm text-gray-200 font-medium leading-relaxed">{q.question}</p>
                          <p className="text-[10px] text-gray-500 mt-3 flex items-center gap-2">
                            {q.question_code && <span className="bg-gray-800 border border-gray-700 px-2 py-0.5 rounded font-mono">{q.question_code}</span>}
                            <span className="bg-gray-800/50 px-2 py-0.5 rounded border border-gray-700/50">{q.type}</span>
                          </p>
                        </td>
                        <td className="p-5">
                          <div className="flex flex-col gap-2 items-start">
                            <span className="px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 text-[10px] font-bold rounded uppercase tracking-wider">{q.subject}</span>
                            <span className="text-[11px] text-gray-400 font-medium bg-gray-800/50 px-2 py-0.5 rounded border border-gray-700/50">
                              G{q.grade || 'N/A'} • {q.difficulty}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            PAPER HISTORY TAB VIEW
        ======================================================== */}
        {activeTab === 'history' && (
          <div className="bg-gray-900/40 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl animate-fade-in">
            <div className="p-6 md:p-8 bg-gray-800/40 border-b border-gray-800 flex justify-between items-center backdrop-blur-md">
              <div>
                <h3 className="text-2xl font-bold text-white tracking-wide">Paper History</h3>
                <p className="text-sm text-gray-400 mt-1">Review, re-download, or delete previously generated offline papers.</p>
              </div>
              <button onClick={fetchHistory} className="text-sm text-green-500 hover:text-green-400 font-bold transition-colors flex items-center gap-2 bg-green-500/10 hover:bg-green-500/20 px-4 py-2.5 rounded-xl border border-green-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                Refresh
              </button>
            </div>

            <div className="overflow-x-auto w-full pb-10">
              {message && activeTab === 'history' && (
                <div className="p-4 m-4 mb-0 rounded-xl bg-gray-800/50 border border-gray-700 text-center animate-fade-in">
                  <p className={`text-sm font-bold ${message.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>{message.text}</p>
                </div>
              )}
              
              <table className="w-full text-left min-w-[800px]">
                <thead>
                  <tr className="bg-gray-800/20 border-b border-gray-800">
                    <th className="p-6 text-xs font-extrabold text-gray-500 uppercase tracking-widest w-1/3">Title</th>
                    <th className="p-6 text-xs font-extrabold text-gray-500 uppercase tracking-widest">Metadata</th>
                    <th className="p-6 text-xs font-extrabold text-gray-500 uppercase tracking-widest">Date Created</th>
                    <th className="p-6 text-xs font-extrabold text-gray-500 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {loadingHistory ? (
                    <tr><td colSpan={4} className="p-16 text-center text-gray-500 text-base font-medium">Loading history...</td></tr>
                  ) : paperHistory.length === 0 ? (
                    <tr><td colSpan={4} className="p-16 text-center text-gray-500 text-base font-medium flex flex-col items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mb-4 opacity-50"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                      No saved papers found. Switch to the Generator tab to create one.
                    </td></tr>
                  ) : (
                    paperHistory.map((paper) => (
                      <tr key={paper.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="p-6">
                          <p className="text-base font-bold text-gray-200 group-hover:text-white transition-colors">{paper.title}</p>
                          <p className="text-[11px] text-gray-400 mt-2 font-medium bg-gray-800/80 inline-block px-2.5 py-1 rounded border border-gray-700/80">
                            {paper.question_ids?.length || 0} Questions • {paper.duration} Mins
                          </p>
                        </td>
                        <td className="p-6">
                          <div className="flex gap-2 flex-wrap">
                            <span className="px-2.5 py-1 bg-green-500/10 text-green-400 border border-green-500/20 text-[10px] font-bold rounded uppercase max-w-[200px] truncate tracking-wider" title={paper.subject}>{paper.subject}</span>
                            {paper.grade !== 'All' && <span className="px-2.5 py-1 bg-gray-800/50 text-gray-300 border border-gray-700/50 text-[10px] font-bold rounded">G{paper.grade}</span>}
                          </div>
                        </td>
                        <td className="p-6 text-sm text-gray-400 font-medium">
                          {new Date(paper.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="p-6 text-right">
                          <div className="flex justify-end gap-3">
                            <button onClick={() => handleViewPaperQuestions(paper)} className="p-2.5 text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-500/30 rounded-xl transition-all border border-emerald-500/20" title="View Questions">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </button>

                            <button onClick={() => handleReDownload(paper)} disabled={downloadingPDF} className="p-2.5 text-purple-400 hover:text-white bg-purple-500/10 hover:bg-purple-500/30 rounded-xl transition-all disabled:opacity-50 border border-purple-500/20" title="Re-download PDF">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                            </button>

                            <button onClick={() => handleDeletePaper(paper.id)} className="p-2.5 text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500/30 rounded-xl transition-all border border-red-500/20" title="Delete Record">
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
          </div>
        )}
      </div>

      {/* --- VIEW QUESTIONS MODAL (PREMIUM GLASSMORPHISM) --- */}
      {historyQuestionsOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={closeHistoryQuestions}/>

          <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-gray-900/90 border border-gray-700/60 rounded-3xl shadow-2xl overflow-hidden animate-scale-in backdrop-blur-xl">
            <div className="p-5 md:p-6 border-b border-gray-800 bg-gray-800/40 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl md:text-2xl font-extrabold text-white tracking-wide">
                  {historyActivePaper?.title || 'Paper Preview'}
                </h3>
                <div className="flex gap-3 items-center mt-2 text-sm">
                  <span className="text-gray-400 font-medium">
                    {historyActivePaper?.question_ids?.length || 0} Questions
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-600"></span>
                  <span className="text-gray-400 font-medium">
                    {historyActivePaper?.duration || 0} Mins
                  </span>
                  {historyActivePaper?.subject && (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-600"></span>
                      <span className="text-green-400 font-bold uppercase tracking-wider text-[11px] bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
                        {historyActivePaper.subject}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button onClick={closeHistoryQuestions} className="p-2.5 rounded-xl border border-gray-700/50 bg-gray-800/60 hover:bg-gray-700 hover:text-white text-gray-400 transition-all flex-shrink-0 group">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 md:p-6 custom-scrollbar">
              {historyQuestionsError && (
                <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm font-medium text-red-400 flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  {historyQuestionsError}
                </div>
              )}

              {loadingHistoryQuestions ? (
                <div className="space-y-4 animate-pulse">
                  {[1, 2, 3].map(n => (
                    <div key={n} className="rounded-2xl border border-gray-800 bg-gray-800/30 p-5 md:p-6">
                      <div className="flex justify-between items-start gap-4 mb-4">
                        <div className="w-full">
                          <div className="h-4 w-full bg-gray-700/50 rounded mb-2" />
                          <div className="h-4 w-3/4 bg-gray-700/50 rounded" />
                        </div>
                        <div className="h-6 w-16 bg-gray-700/50 rounded flex-shrink-0" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
                        <div className="h-10 bg-gray-800/60 rounded-xl border border-gray-700/30" />
                        <div className="h-10 bg-gray-800/60 rounded-xl border border-gray-700/30" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : historyQuestions.length === 0 && !historyQuestionsError ? (
                <div className="text-center text-gray-500 py-16 flex flex-col items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <p className="font-medium">No question data available.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {historyQuestions.map((q, idx) => (
                    <div key={q.id} className="rounded-2xl border border-gray-700/50 bg-gray-800/30 hover:bg-gray-800/50 transition-colors p-5 md:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="text-[15px] text-gray-200 font-medium leading-relaxed flex-1">
                          <span className="text-green-500 font-bold mr-2 select-none">Q{idx + 1}.</span>
                          {q.question}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <span className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${
                            q.difficulty === 'Easy' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                            q.difficulty === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                            q.difficulty === 'Hard' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                            'bg-gray-700/30 text-gray-400 border-gray-600/50'
                          }`}>
                            {q.difficulty || 'N/A'}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-gray-900/50 border border-gray-700 text-gray-400 font-mono">
                            {q.type}
                          </span>
                        </div>
                      </div>

                      {q.type === 'Multiple Choice' && Array.isArray(q.options) && q.options.length > 0 && (
                        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                          {q.options.map((opt: string, i: number) => (
                            <div key={`${q.id}-opt-${i}`} className="text-sm text-gray-300 bg-gray-900/50 border border-gray-700/50 rounded-xl px-4 py-3 flex items-start gap-3">
                              <span className="text-gray-500 font-bold font-mono bg-gray-800 w-6 h-6 flex items-center justify-center rounded-md flex-shrink-0">
                                {String.fromCharCode(65 + i)}
                              </span>
                              <span className="mt-0.5">{opt}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-5 pt-4 border-t border-gray-700/30 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-medium text-gray-500">
                        {q.topic && (
                          <div className="flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                            Topic: <span className="text-gray-400">{q.topic}</span>
                          </div>
                        )}
                        {q.sub_topic && (
                          <div className="flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                            Sub-Topic: <span className="text-gray-400">{q.sub_topic}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #374151; border-radius: 20px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background-color: #4B5563; }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.96) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}} />
    </div>
  );
};

export default QuestionPaperGenerator;
