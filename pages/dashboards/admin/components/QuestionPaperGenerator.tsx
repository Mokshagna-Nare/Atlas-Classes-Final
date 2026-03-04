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

const QuestionPaperGenerator: React.FC = () => {
  // --- Form & Filter States ---
  const [paperTitle, setPaperTitle] = useState('');
  const [duration, setDuration] = useState<number | string>(60);
  const [numberOfQuestions, setNumberOfQuestions] = useState<number | string>(20);

  const [filterGrade, setFilterGrade] = useState('All');
  const [filterSubject, setFilterSubject] = useState('All');
  const [filterTopic, setFilterTopic] = useState('All');
  const [filterSubTopic, setFilterSubTopic] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [filterDifficulty, setFilterDifficulty] = useState('All');

  // --- Difficulty Distribution States ---
  const [useDistribution, setUseDistribution] = useState(false);
  const [easyPercent, setEasyPercent] = useState(50);
  const [mediumPercent, setMediumPercent] = useState(30);
  const [hardPercent, setHardPercent] = useState(20);

  // --- Dynamic Dropdown States ---
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [availableSubTopics, setAvailableSubTopics] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // --- Generation & Saving States ---
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [generatedPaper, setGeneratedPaper] = useState<MCQ[]>([]);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // --- History States ---
  const [paperHistory, setPaperHistory] = useState<OfflinePaper[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Percent total validation
  const distributionTotal = easyPercent + mediumPercent + hardPercent;
  const isDistributionValid = distributionTotal === 100;

  // Helper to get safe numbers from state
  const safeDuration = Number(duration) || 0;
  const safeTotalQuestions = Number(numberOfQuestions) || 0;

  // --- Fetch Topics when Subject Changes ---
  useEffect(() => {
    const fetchTopics = async () => {
      setFilterTopic('All');
      setFilterSubTopic('All');
      setAvailableSubTopics([]);

      if (filterSubject === 'All') {
        setAvailableTopics([]);
        return;
      }

      setLoadingOptions(true);
      try {
        const { data, error } = await supabase
          .from('mcqs')
          .select('topic')
          .eq('subject', filterSubject)
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
        setLoadingOptions(false);
      }
    };
    fetchTopics();
  }, [filterSubject]);

  // --- Fetch Sub-Topics when Topic Changes ---
  useEffect(() => {
    const fetchSubTopics = async () => {
      setFilterSubTopic('All');

      if (filterTopic === 'All') {
        setAvailableSubTopics([]);
        return;
      }

      setLoadingOptions(true);
      try {
        const { data, error } = await supabase
          .from('mcqs')
          .select('sub_topic')
          .eq('topic', filterTopic)
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
        setLoadingOptions(false);
      }
    };
    fetchSubTopics();
  }, [filterTopic]);

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

  useEffect(() => {
    fetchHistory();
  }, []);

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
      if (filterSubject !== 'All') query = query.eq('subject', filterSubject);
      if (filterTopic !== 'All') query = query.eq('topic', filterTopic);
      if (filterSubTopic !== 'All') query = query.eq('sub_topic', filterSubTopic);
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

      const { error } = await supabase.from('offline_papers').insert([
        {
          title: paperTitle,
          duration: safeDuration || 60,
          question_ids: questionIds,
          total_marks: totalMarks,
          subject: filterSubject !== 'All' ? filterSubject : 'Mixed',
          grade: filterGrade !== 'All' ? filterGrade : 'Mixed',
        },
      ]);

      if (error) {
        console.error("Insert Error Details:", error);
        throw new Error(error.message);
      }

      setMessage({ type: 'success', text: 'Offline Paper successfully saved to history!' });
      
      fetchHistory();

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

      if ((q.type === 'Multiple Choice' && q.options)) {
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
    generatePDFDocument(generatedPaper, paperTitle, safeDuration, filterSubject !== 'All' ? filterSubject : 'Mixed');
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

  return (
    <div className="space-y-8 reveal-on-scroll text-white">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-3xl font-extrabold mb-1">Question Paper Generator</h2>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-2">
              <InformationCircleIcon className="h-4 w-4" />
              Automatically compile a tailored question paper from your Question Bank.
            </span>
          </div>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800 backdrop-blur-md space-y-6 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-400">
              Paper Title <span className="text-red-500">*</span>
            </label>
            <input type="text" placeholder="e.g., Grade 11 Biology Mid-Term" value={paperTitle} onChange={e => setPaperTitle(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-sm rounded-xl py-2.5 px-4 focus:border-green-500 outline-none text-white transition"/>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-400">Duration (Minutes)</label>
            <input type="number" value={duration} onChange={e => setDuration(e.target.value === '' ? '' : parseInt(e.target.value, 10))} className="w-full bg-gray-800 border border-gray-700 text-sm rounded-xl py-2.5 px-4 focus:border-green-500 outline-none text-white transition"/>
          </div>
        </div>

        <div className="h-px w-full bg-gray-800" />

        {/* Filters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Grade</label>
            <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className="bg-gray-800 border border-gray-700 text-sm font-bold text-white rounded-lg px-3 py-2.5 outline-none cursor-pointer hover:border-green-500 transition">
              <option value="All">All Grades</option>
              <option value="10">Grade 10</option>
              <option value="11">Grade 11</option>
              <option value="12">Grade 12</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Subject</label>
            <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className="bg-gray-800 border border-gray-700 text-sm font-bold text-white rounded-lg px-3 py-2.5 outline-none cursor-pointer hover:border-green-500 transition">
              <option value="All">All Subjects</option>
              <option value="Physics">Physics</option>
              <option value="Chemistry">Chemistry</option>
              <option value="Biology">Biology</option>
              <option value="Mathematics">Mathematics</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Topic</label>
            <select value={filterTopic} onChange={e => setFilterTopic(e.target.value)} disabled={filterSubject === 'All' || loadingOptions} className={`bg-gray-800 border border-gray-700 text-sm font-bold text-white rounded-lg px-3 py-2.5 outline-none transition ${filterSubject === 'All' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-green-500'}`}>
              <option value="All">{loadingOptions ? 'Loading...' : filterSubject === 'All' ? 'Select Subject First' : 'All Topics'}</option>
              {availableTopics.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Sub-Topic</label>
            <select value={filterSubTopic} onChange={e => setFilterSubTopic(e.target.value)} disabled={filterTopic === 'All' || loadingOptions} className={`bg-gray-800 border border-gray-700 text-sm font-bold text-white rounded-lg px-3 py-2.5 outline-none transition ${filterTopic === 'All' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-green-500'}`}>
              <option value="All">{loadingOptions ? 'Loading...' : filterTopic === 'All' ? 'Select Topic First' : 'All Sub-Topics'}</option>
              {availableSubTopics.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Question Type</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-gray-800 border border-gray-700 text-sm font-bold text-white rounded-lg px-3 py-2.5 outline-none cursor-pointer hover:border-green-500 transition">
              <option value="All">All Types</option>
              <option value="Multiple Choice">Multiple Choice</option>
              <option value="True/False">True/False</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-green-500 uppercase">Total Questions</label>
            <input type="number" min={1} max={200} value={numberOfQuestions} onChange={e => setNumberOfQuestions(e.target.value === '' ? '' : parseInt(e.target.value, 10))} className="w-full bg-gray-800 border border-green-500/50 text-sm font-bold rounded-lg py-2.5 px-4 focus:border-green-500 outline-none text-white transition"/>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Difficulty</label>
            <select value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)} disabled={useDistribution} className={`bg-gray-800 border border-gray-700 text-sm font-bold text-white rounded-lg px-3 py-2.5 outline-none transition ${useDistribution ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-green-500'}`}>
              <option value="All">Mixed Difficulty</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
        </div>

        {/* Difficulty Distribution Toggle */}
        <div className="border border-gray-700 rounded-xl p-4 bg-gray-800/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={useDistribution} onChange={e => setUseDistribution(e.target.checked)} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600" />
              </label>
              <span className="text-sm font-bold text-white">Use Difficulty Distribution</span>
            </div>
            {!isDistributionValid && useDistribution && <span className="text-xs font-bold text-red-500">Must equal 100%</span>}
          </div>

          {useDistribution && (
            <div className="grid grid-cols-3 gap-4 animate-scale-in">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-green-400 uppercase flex items-center justify-between"><span>Easy</span><span>{easyPercent}%</span></label>
                <input type="range" min={0} max={100} step={5} value={easyPercent} onChange={e => setEasyPercent(parseInt(e.target.value, 10))} className="w-full accent-green-500"/>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-yellow-400 uppercase flex items-center justify-between"><span>Medium</span><span>{mediumPercent}%</span></label>
                <input type="range" min={0} max={100} step={5} value={mediumPercent} onChange={e => setMediumPercent(parseInt(e.target.value, 10))} className="w-full accent-yellow-500"/>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-red-400 uppercase flex items-center justify-between"><span>Hard</span><span>{hardPercent}%</span></label>
                <input type="range" min={0} max={100} step={5} value={hardPercent} onChange={e => setHardPercent(parseInt(e.target.value, 10))} className="w-full accent-red-500"/>
              </div>
            </div>
          )}
        </div>

        {/* Generate Actions */}
        <div className="pt-4 flex justify-between items-center">
          <div className="flex-1">
            {message && <p className={`text-sm font-bold ${message.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>{message.text}</p>}
          </div>
          <button onClick={handleGenerate} disabled={generating || (useDistribution && !isDistributionValid)} className="bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:opacity-50 text-white px-8 py-3 rounded-xl font-bold text-sm transition shadow-lg shadow-green-900/20 flex items-center gap-2">
            {generating ? 'Searching Bank...' : 'Generate Question Paper'}
            {!generating && <FunnelIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Generated Paper Preview */}
      {generatedPaper.length > 0 && (
        <div className="bg-gray-900/40 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl animate-scale-in">
          <div className="p-5 bg-gray-800/50 border-b border-gray-800 flex justify-between items-center flex-wrap gap-4">
            <div>
              <h3 className="font-bold text-white text-lg">Generated Paper Preview</h3>
              <p className="text-xs text-gray-400 mt-1">{generatedPaper.length} Questions Ready</p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleDownloadPDF} disabled={downloadingPDF} className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition shadow-lg flex items-center gap-2">
                {downloadingPDF ? 'Generating...' : <span>Download PDF</span>}
                {!downloadingPDF && <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>}
              </button>

              <button onClick={handleSavePaper} disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition shadow-lg">
                {saving ? 'Saving Paper...' : 'Save & Finalize Paper'}
              </button>
            </div>
          </div>

          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-800/30 border-b border-gray-800">
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
                    <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-2">
                      {q.question_code && <span className="bg-gray-800 px-1.5 rounded">{q.question_code}</span>}
                      <span>{q.type}</span>
                    </p>
                  </td>
                  <td className="p-5">
                    <div className="flex flex-col gap-1.5 items-start">
                      <span className="px-2 py-0.5 bg-green-500/10 text-green-500 border border-green-500/20 text-[10px] font-bold rounded uppercase">{q.subject}</span>
                      <span className="text-[10px] text-gray-400">Grade {q.grade || 'N/A'} • {q.difficulty}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* --- HISTORY SECTION --- */}
      <div className="bg-gray-900/30 border border-gray-800 rounded-3xl overflow-hidden mt-8 shadow-xl">
        <div className="p-6 bg-gray-800/40 border-b border-gray-800 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-white">Paper History</h3>
            <p className="text-sm text-gray-400 mt-1">Previously generated offline papers</p>
          </div>
          <button onClick={fetchHistory} className="text-sm text-green-500 hover:text-green-400 font-bold transition">
            Refresh History
          </button>
        </div>

        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-800/30 border-b border-gray-800">
              <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Title</th>
              <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Metadata</th>
              <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Date Created</th>
              <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {loadingHistory ? (
              <tr><td colSpan={4} className="p-8 text-center text-gray-500 text-sm">Loading history...</td></tr>
            ) : paperHistory.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-gray-500 text-sm">No saved papers found.</td></tr>
            ) : (
              paperHistory.map((paper) => (
                <tr key={paper.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="p-5">
                    <p className="text-sm font-bold text-gray-200">{paper.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{paper.question_ids?.length || 0} Questions • {paper.duration} Mins</p>
                  </td>
                  <td className="p-5">
                    <div className="flex gap-2">
                      <span className="px-2 py-0.5 bg-green-500/10 text-green-500 border border-green-500/20 text-[10px] font-bold rounded uppercase">{paper.subject}</span>
                      {paper.grade !== 'All' && <span className="px-2 py-0.5 bg-gray-800 text-gray-400 border border-gray-700 text-[10px] font-bold rounded">G{paper.grade}</span>}
                    </div>
                  </td>
                  <td className="p-5 text-sm text-gray-400">
                    {new Date(paper.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleReDownload(paper)} disabled={downloadingPDF} className="p-2 text-purple-400 hover:text-white hover:bg-purple-600/20 rounded-lg transition disabled:opacity-50" title="Re-download PDF">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                      </button>
                      <button onClick={() => handleDeletePaper(paper.id)} className="p-2 text-red-500 hover:text-white hover:bg-red-600/20 rounded-lg transition" title="Delete Record">
                        <TrashIcon className="h-5 w-5" />
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
  );
};

export default QuestionPaperGenerator;
