import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../../../services/supabase';
import { MCQ } from '../../../../types';
import { InformationCircleIcon, FunnelIcon, TrashIcon } from '../../../../components/icons';
import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

// --- Type Definition for Offline Paper History ---
interface OfflinePaper {
  id: string;
  title: string;
  exam_date?: string; // NEW: Exam Date
  duration: number;
  total_marks: number;
  subject: string;
  grade: string;
  section?: string;
  assessment_type?: string;
  exam_type?: string;
  tracks_enabled?: boolean;
  subject_config?: any;
  question_allocations?: any; // NEW: Structured storage for cart
  question_ids: string[]; // Flat list maintained for legacy/download compatibility
  created_at: string;
  downloads: number;
  student_downloads?: number;
  teacher_downloads?: number;
  status?: string; // Tracks 'Draft' vs 'Finalized'
}

const ALL_SUBJECTS = ['Physics', 'Chemistry', 'Biology', 'Mathematics'];
const QUESTION_TYPE_OPTIONS = ['Multiple Choice', 'True/False'];
const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard'];

type TabView = 'generator' | 'history';
type SubjectConfigType = Record<string, { track1: number | ''; track2: number | '' }>;
type AllocationsType = Record<string, { track1: string[]; track2: string[] }>;

// --- Premium Reusable Multi-Select Dropdown Component ---
const MultiSelectDropdown = ({ 
  label, options, selected, setSelected, disabled = false 
}: { 
  label: string, options: string[], selected: string[], setSelected: React.Dispatch<React.SetStateAction<string[]>>, disabled?: boolean
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (opt: string) => setSelected(prev => prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt]);

  return (
    <div className={`relative flex flex-col gap-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`} ref={dropdownRef}>
      <label className="text-[11px] font-extrabold text-gray-500 uppercase tracking-widest pl-1">{label}</label>
      <div onClick={() => setIsOpen(!isOpen)} className="bg-gray-800/80 border border-gray-700/80 text-sm font-bold text-white rounded-xl px-4 py-3 cursor-pointer flex justify-between items-center hover:border-green-500 transition-colors">
        <span className="truncate pr-2 text-gray-300">{selected.length === 0 ? 'All' : selected.join(', ')}</span>
        <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </div>
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto custom-scrollbar animate-fade-in p-1.5 space-y-0.5">
          {options.map(opt => {
            const isSelected = selected.includes(opt);
            return (
              <div key={opt} className="px-3 py-1.5 flex items-center gap-3 hover:bg-gray-700/50 rounded-lg cursor-pointer transition-colors group" onClick={(e) => { e.stopPropagation(); handleToggle(opt); }}>
                <div className={`w-[18px] h-[18px] rounded flex items-center justify-center border-2 transition-all duration-200 flex-shrink-0 ${isSelected ? 'bg-green-500 border-green-500 scale-105' : 'bg-gray-900 border-gray-600 group-hover:border-gray-400'}`}>
                  {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className={`text-sm pt-0.5 ${isSelected ? 'text-green-400 font-bold' : 'text-gray-300 font-medium'}`}>{opt}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const QuestionPaperGenerator: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabView>('generator');
  useEffect(() => { setMessage(null); }, [activeTab]);

  // --- FLOW STATES ---
  const [creationStep, setCreationStep] = useState<1 | 2>(1);
  const [draftPaperId, setDraftPaperId] = useState<string | null>(null);

  const [examName, setExamName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [assessmentType, setAssessmentType] = useState<'Assignment' | 'Test'>('Assignment');
  const [examType, setExamType] = useState('');
  const [duration, setDuration] = useState<number | string>(60);

  const [tracksEnabled, setTracksEnabled] = useState(false);
  const [subjectConfig, setSubjectConfig] = useState<SubjectConfigType>({});

  // --- ITERATIVE CART STATES ---
  const [questionAllocations, setQuestionAllocations] = useState<AllocationsType>({});
  const [currentTarget, setCurrentTarget] = useState<string | null>(null); // e.g., "Physics|track1"
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [fullDraftQuestions, setFullDraftQuestions] = useState<MCQ[]>([]);
  const [loadingFullDraft, setLoadingFullDraft] = useState(false);

  // --- Filter States ---
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedSubTopics, setSelectedSubTopics] = useState<string[]>([]);

  const [topicSearch, setTopicSearch] = useState('');
  const [subTopicSearch, setSubTopicSearch] = useState('');
  const [subTopicConfig, setSubTopicConfig] = useState<Record<string, { easy: string; medium: string; hard: string }>>({});

  const [useDistribution, setUseDistribution] = useState(false);
  const [easyPercent, setEasyPercent] = useState(50);
  const [mediumPercent, setMediumPercent] = useState(30);
  const [hardPercent, setHardPercent] = useState(20);

  const [metadataPool, setMetadataPool] = useState<any[]>([]);
  const [loadingPool, setLoadingPool] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [generatedPaper, setGeneratedPaper] = useState<MCQ[]>([]); // "Stash" of pending items
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // --- History & Modal States ---
  const [paperHistory, setPaperHistory] = useState<OfflinePaper[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyQuestionsOpen, setHistoryQuestionsOpen] = useState(false);
  const [historyActivePaper, setHistoryActivePaper] = useState<OfflinePaper | null>(null);
  const [historyQuestions, setHistoryQuestions] = useState<MCQ[]>([]);
  const [loadingHistoryQuestions, setLoadingHistoryQuestions] = useState(false);
  const [historyQuestionsError, setHistoryQuestionsError] = useState<string | null>(null);

  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [downloadType, setDownloadType] = useState<'student' | 'teacher'>('student');
  const [downloadData, setDownloadData] = useState<{ questions: MCQ[], title: string, duration: number, subject: string, paperId?: string } | null>(null);
  const [formatModalOpen, setFormatModalOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'docx'>('pdf');

  // --- COMPUTED TARGET METRICS ---
  const targetSubj = currentTarget?.split('|')[0] || '';
  const targetTrck = (currentTarget?.split('|')[1] as 'track1' | 'track2') || 'track1';
  const currentBucketQuota = currentTarget ? (Number(subjectConfig[targetSubj]?.[targetTrck]) || 0) : 0;
  const currentBucketFilled = currentTarget ? (questionAllocations[targetSubj]?.[targetTrck]?.length || 0) : 0;
  const remainingInBucket = currentBucketQuota - currentBucketFilled;

  const totalQuestionsNeeded = Object.values(subjectConfig).reduce((sum, c) => sum + (Number(c.track1) || 0) + (tracksEnabled ? (Number(c.track2) || 0) : 0), 0);
  const totalQuestionsFilled = Object.values(questionAllocations).reduce((sum, c) => sum + (c.track1?.length || 0) + (tracksEnabled ? (c.track2?.length || 0) : 0), 0);
  const isDraftComplete = totalQuestionsNeeded > 0 && totalQuestionsFilled === totalQuestionsNeeded;

  const distributionTotal = easyPercent + mediumPercent + hardPercent;
  const isDistributionValid = distributionTotal === 100;
  const safeDuration = Number(duration) || 0;

  const requestedSpecificQuestions = selectedSubTopics.reduce((acc, sub) => {
    const config = subTopicConfig[sub];
    if (!config) return acc;
    return acc + (parseInt(config.easy) || 0) + (parseInt(config.medium) || 0) + (parseInt(config.hard) || 0);
  }, 0);

  // --- STEP 1: AUTO-FILL SUBJECT CONFIG LOGIC ---
  useEffect(() => {
    if (assessmentType === 'Assignment') {
      setExamType('');
      setSubjectConfig({ Physics: { track1: 10, track2: 0 }, Chemistry: { track1: 10, track2: 0 }, Biology: { track1: 10, track2: 0 }, Mathematics: { track1: 10, track2: 0 }});
    } else if (assessmentType === 'Test') {
      if (examType === 'NEET') { setSubjectConfig({ Physics: { track1: 45, track2: 0 }, Chemistry: { track1: 45, track2: 0 }, Biology: { track1: 90, track2: 0 } }); setDuration(180); } 
      else if (examType === 'JEE') { setSubjectConfig({ Physics: { track1: 30, track2: 0 }, Chemistry: { track1: 30, track2: 0 }, Mathematics: { track1: 30, track2: 0 } }); setDuration(180); } 
      else if (examType === 'KCET-Eng') { setSubjectConfig({ Physics: { track1: 60, track2: 0 }, Chemistry: { track1: 60, track2: 0 }, Mathematics: { track1: 60, track2: 0 } }); setDuration(240); } 
      else if (examType === 'KCET-Agri') { setSubjectConfig({ Physics: { track1: 60, track2: 0 }, Chemistry: { track1: 60, track2: 0 }, Biology: { track1: 60, track2: 0 } }); setDuration(240); } 
      else { setSubjectConfig({}); }
    }
  }, [examType, assessmentType]);

  const updateSubjectTrack = (subject: string, track: 'track1' | 'track2', val: string) => {
    const num = val === '' ? '' : parseInt(val, 10);
    setSubjectConfig(prev => ({ ...prev, [subject]: { ...prev[subject], [track]: num } }));
  };

  // --- STEP 1 -> STEP 2 (SAVE DRAFT) ---
  const handleCreateExamProceed = async () => {
    if (!examName.trim()) return setMessage({ type: 'error', text: 'Exam Name is required.' });
    if (!examDate) return setMessage({ type: 'error', text: 'Exam Date is required.' });
    if (!grade) return setMessage({ type: 'error', text: 'Please select a Grade.' });
    if (totalQuestionsNeeded < 1) return setMessage({ type: 'error', text: 'Please allocate questions to at least one subject.' });
    if (!safeDuration || safeDuration < 1) return setMessage({ type: 'error', text: 'Valid Duration is required.' });
    
    setMessage(null); setSaving(true);
    
    try {
      await supabase.auth.refreshSession();
      const initialAllocations: AllocationsType = {};
      Object.keys(subjectConfig).forEach(subj => { initialAllocations[subj] = { track1: [], track2: [] }; });

      const payload = {
        title: examName,
        exam_date: examDate,
        duration: safeDuration,
        grade: grade,
        section: section,
        assessment_type: assessmentType,
        exam_type: assessmentType === 'Test' ? examType : null,
        tracks_enabled: tracksEnabled,
        subject_config: subjectConfig,
        question_allocations: initialAllocations,
        question_ids: [], 
        total_marks: 0,
        downloads: 0,
        student_downloads: 0,
        teacher_downloads: 0,
        subject: Object.keys(subjectConfig).join(', '),
        status: 'Draft' 
      };

      const { data, error } = await supabase.from('offline_papers').insert([payload]).select('id').single();
      
      if (error) throw new Error(error.message);
      
      if (data) {
        setDraftPaperId(data.id);
        setQuestionAllocations(initialAllocations);
        setSelectedGrades([grade]); 
        setCreationStep(2);
        
        // Auto-select first target
        const firstSubj = Object.keys(subjectConfig)[0];
        if (firstSubj) setCurrentTarget(`${firstSubj}|track1`);
        
        setMessage({ type: 'success', text: 'Exam Draft Saved! Start filling your buckets.' });
      }
    } catch (err: any) { setMessage({ type: 'error', text: `Failed to create exam: ${err.message}` }); } 
    finally { setSaving(false); }
  };

  // --- RESUME DRAFT LOGIC ---
  const handleResumeDraft = (paper: OfflinePaper) => {
    setDraftPaperId(paper.id);
    setExamName(paper.title);
    setExamDate(paper.exam_date || '');
    setDuration(paper.duration);
    setGrade(paper.grade);
    setSection(paper.section || '');
    setAssessmentType((paper.assessment_type as 'Assignment' | 'Test') || 'Assignment');
    if (paper.exam_type) setExamType(paper.exam_type);
    setTracksEnabled(paper.tracks_enabled || false);
    if (paper.subject_config) setSubjectConfig(paper.subject_config);
    if (paper.question_allocations) setQuestionAllocations(paper.question_allocations);
    else {
      // Fallback if older draft has no allocations
      const init: AllocationsType = {};
      Object.keys(paper.subject_config || {}).forEach(s => init[s] = {track1: [], track2: []});
      setQuestionAllocations(init);
    }
    
    setSelectedGrades([paper.grade]);
    setCreationStep(2);
    setActiveTab('generator');
    
    // Auto-select first incomplete target
    let foundTarget = false;
    for (const subj of Object.keys(paper.subject_config || {})) {
      if ((paper.question_allocations?.[subj]?.track1?.length || 0) < (paper.subject_config[subj]?.track1 || 0)) { setCurrentTarget(`${subj}|track1`); foundTarget = true; break; }
      if (paper.tracks_enabled && (paper.question_allocations?.[subj]?.track2?.length || 0) < (paper.subject_config[subj]?.track2 || 0)) { setCurrentTarget(`${subj}|track2`); foundTarget = true; break; }
    }
    if (!foundTarget && Object.keys(paper.subject_config || {}).length > 0) setCurrentTarget(`${Object.keys(paper.subject_config || {})[0]}|track1`);
    
    setMessage({ type: 'success', text: `Resumed Draft: ${paper.title}.` });
  };

  // --- METADATA FETCHING (Step 2) ---
  useEffect(() => {
    const fetchPool = async () => {
      setLoadingPool(true);
      try {
        let query = supabase.from('mcqs').select('id, subject, topic, sub_topic, difficulty').eq('isFlagged', false).limit(10000);
        if (selectedGrades.length > 0) query = query.in('grade', selectedGrades);
        if (selectedTypes.length > 0) query = query.in('type', selectedTypes);
        // Force pool to only load matching subject to currentTarget
        if (targetSubj) query = query.eq('subject', targetSubj);
        
        const { data, error } = await query;
        if (error) throw error;
        if (data) setMetadataPool(data);
      } catch (err) { console.error('Error fetching metadata pool:', err); } 
      finally { setLoadingPool(false); }
    };
    if (creationStep === 2 && targetSubj) fetchPool();
  }, [selectedGrades, selectedTypes, creationStep, targetSubj]);

  const availableTopicsMap = useMemo(() => {
    const map: Record<string, { count: number, subject: string }> = {};
    metadataPool.forEach(q => {
      if (q.topic) {
        if (!map[q.topic]) map[q.topic] = { count: 0, subject: q.subject };
        map[q.topic].count += 1;
      }
    });
    return map;
  }, [metadataPool]);

  const availableSubTopicsMap = useMemo(() => {
    const map: Record<string, { total: number, easy: number, medium: number, hard: number, subject: string, topic: string }> = {};
    metadataPool.filter(q => selectedTopics.includes(q.topic)).forEach(q => {
        if (q.sub_topic) {
          if (!map[q.sub_topic]) map[q.sub_topic] = { total: 0, easy: 0, medium: 0, hard: 0, subject: q.subject, topic: q.topic };
          map[q.sub_topic].total += 1;
          if (q.difficulty === 'Easy') map[q.sub_topic].easy += 1;
          else if (q.difficulty === 'Medium') map[q.sub_topic].medium += 1;
          else if (q.difficulty === 'Hard') map[q.sub_topic].hard += 1;
        }
      });
    return map;
  }, [metadataPool, selectedTopics]);

  const availableTopics = useMemo(() => Object.keys(availableTopicsMap).sort((a, b) => a.localeCompare(b)), [availableTopicsMap]);
  const availableSubTopics = useMemo(() => Object.keys(availableSubTopicsMap).sort((a, b) => a.localeCompare(b)), [availableSubTopicsMap]);

  // --- HISTORY LOGIC ---
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase.from('offline_papers').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        const mappedData: OfflinePaper[] = data.map(paper => ({
          ...paper, student_downloads: paper.student_downloads || 0, teacher_downloads: paper.teacher_downloads || 0
        }));
        setPaperHistory(mappedData);
      }
    } catch (err) { console.error('Error fetching history:', err); setMessage({ type: 'error', text: 'Failed to load paper history.' }); } 
    finally { setLoadingHistory(false); }
  };

  useEffect(() => { if (activeTab === 'history') fetchHistory(); }, [activeTab]);

  // --- QUESTION GENERATION LOGIC (ITERATIVE STASH) ---
  const handleGenerate = async () => {
    setMessage(null); setGeneratedPaper([]);

    if (!currentTarget) return setMessage({ type: 'error', text: 'Please select a Subject/Track bucket from the Progress Dashboard.' });
    if (remainingInBucket <= 0) return setMessage({ type: 'error', text: 'This bucket is already full!' });
    if (useDistribution && !isDistributionValid) return setMessage({ type: 'error', text: 'Difficulty percentages must add up to 100%.' });
    if (requestedSpecificQuestions > remainingInBucket) return setMessage({ type: 'error', text: `Requested specific questions exceed remaining bucket space.` });

    setGenerating(true);
    try {
      let query = supabase.from('mcqs').select('*').eq('isFlagged', false).eq('subject', targetSubj);

      if (selectedGrades.length > 0) query = query.in('grade', selectedGrades);
      if (selectedTypes.length > 0) query = query.in('type', selectedTypes);
      if (selectedTopics.length > 0) query = query.in('topic', selectedTopics);
      if (selectedSubTopics.length > 0) query = query.in('sub_topic', selectedSubTopics);
      if (!useDistribution && selectedDifficulties.length > 0) query = query.in('difficulty', selectedDifficulties);

      const { data, error } = await query;
      if (error) throw error;

      // Ensure we don't pick questions already in the entire draft (to prevent cross-track duplicates)
      const allUsedIds = new Set(Object.values(questionAllocations).flatMap(t => [...(t.track1 || []), ...(t.track2 || [])]));
      let pool = (data || []).filter(q => !allUsedIds.has(q.id));

      if (pool.length === 0) {
        setGenerating(false); return setMessage({ type: 'error', text: 'No fresh questions found matching your filters.' });
      }

      const shuffleArray = (arr: MCQ[]) => arr.sort(() => 0.5 - Math.random());
      let selectedQuestions: MCQ[] = [];

      for (const subTopic of selectedSubTopics) {
        const config = subTopicConfig[subTopic];
        if (config) {
          const pickSpecific = (diff: string, req: number) => {
            if (req === 0) return;
            const avail = pool.filter(q => q.sub_topic === subTopic && q.difficulty === diff);
            if (avail.length < req) throw new Error(`Not enough ${diff} questions for "${subTopic}". Required: ${req}, Available: ${avail.length}`);
            const picked = shuffleArray(avail).slice(0, req);
            selectedQuestions.push(...picked);
            pool = pool.filter(q => !picked.find(p => p.id === q.id)); 
          };
          pickSpecific('Easy', parseInt(config.easy) || 0); 
          pickSpecific('Medium', parseInt(config.medium) || 0); 
          pickSpecific('Hard', parseInt(config.hard) || 0);
        }
      }

      const remainingNeeded = remainingInBucket - selectedQuestions.length;
      if (remainingNeeded > 0) {
        if (useDistribution) {
          const eReq = Math.round((easyPercent / 100) * remainingNeeded);
          const mReq = Math.round((mediumPercent / 100) * remainingNeeded);
          const hReq = remainingNeeded - eReq - mReq; 

          const availE = pool.filter(q => q.difficulty === 'Easy');
          const availM = pool.filter(q => q.difficulty === 'Medium');
          const availH = pool.filter(q => q.difficulty === 'Hard');

          if (availE.length < eReq || availM.length < mReq || availH.length < hReq) {
            throw new Error(`Insufficient questions for distribution. Needed: ${remainingNeeded}. Required Easy:${eReq}, Medium:${mReq}, Hard:${hReq}.`);
          }

          selectedQuestions.push(...shuffleArray(availE).slice(0, eReq));
          selectedQuestions.push(...shuffleArray(availM).slice(0, mReq));
          selectedQuestions.push(...shuffleArray(availH).slice(0, hReq));
        } else {
          const shuffledPool = shuffleArray(pool);
          selectedQuestions.push(...shuffledPool.slice(0, Math.min(remainingNeeded, pool.length)));
        }
      }

      if (selectedQuestions.length > 0) {
        setGeneratedPaper(shuffleArray(selectedQuestions));
        setMessage({ type: 'success', text: `Found ${selectedQuestions.length} questions for ${targetSubj}! Review below and Add to Draft.` });
      }

    } catch (err: any) { setMessage({ type: 'error', text: err.message || 'Failed to generate paper.' }); } 
    finally { setGenerating(false); }
  };

  // --- ADD TO DRAFT BUCKET ---
  const handleAddToDraft = async () => {
    if (!currentTarget || generatedPaper.length === 0 || !draftPaperId) return;
    setSaving(true);
    try {
      await supabase.auth.refreshSession();
      const newIds = generatedPaper.map(q => q.id);
      
      const newAllocations = { ...questionAllocations };
      if (!newAllocations[targetSubj]) newAllocations[targetSubj] = { track1: [], track2: [] };
      newAllocations[targetSubj][targetTrck] = [...newAllocations[targetSubj][targetTrck], ...newIds];

      await supabase.from('offline_papers').update({ question_allocations: newAllocations }).eq('id', draftPaperId);
      
      setQuestionAllocations(newAllocations);
      setGeneratedPaper([]);
      setMessage({ type: 'success', text: `Added ${newIds.length} questions to ${targetSubj} ${targetTrck.toUpperCase()}!` });
    } catch (err: any) { setMessage({ type: 'error', text: `Failed to add to draft: ${err.message}` }); }
    finally { setSaving(false); }
  };

  const handleClearBucket = async (subj: string, track: 'track1' | 'track2') => {
    if (!window.confirm(`Clear all questions currently in ${subj} - ${track.toUpperCase()}?`)) return;
    try {
      await supabase.auth.refreshSession();
      const newAllocations = { ...questionAllocations };
      newAllocations[subj][track] = [];
      await supabase.from('offline_papers').update({ question_allocations: newAllocations }).eq('id', draftPaperId);
      setQuestionAllocations(newAllocations);
      if (targetSubj === subj && targetTrck === track) setGeneratedPaper([]); 
    } catch (err) { console.error(err); }
  };

  // --- FINAL PREVIEW MODAL ---
  const handleOpenReviewModal = async () => {
    setLoadingFullDraft(true); setReviewModalOpen(true);
    try {
      const allFlatIds: string[] = [];
      Object.keys(subjectConfig).forEach(subj => {
        allFlatIds.push(...(questionAllocations[subj]?.track1 || []));
        if (tracksEnabled) allFlatIds.push(...(questionAllocations[subj]?.track2 || []));
      });

      const { data, error } = await supabase.from('mcqs').select('*').in('id', allFlatIds);
      if (error) throw error;
      
      // Order strictly by how they are defined in allocations
      const orderedDraft: MCQ[] = [];
      Object.keys(subjectConfig).forEach(subj => {
        const t1 = questionAllocations[subj]?.track1 || [];
        t1.forEach(id => { const q = data.find(d => d.id === id); if(q) orderedDraft.push({...q, _trackContext: 'T1'}); });
        
        if (tracksEnabled) {
          const t2 = questionAllocations[subj]?.track2 || [];
          t2.forEach(id => { const q = data.find(d => d.id === id); if(q) orderedDraft.push({...q, _trackContext: 'T2'}); });
        }
      });
      setFullDraftQuestions(orderedDraft);
    } catch (err) { console.error(err); }
    finally { setLoadingFullDraft(false); }
  };

  // --- FINAL SAVE & LOCK EXAM ---
  const handleFinalizePaper = async () => {
    if (!draftPaperId) return;
    setSaving(true); setMessage(null);
    try {
      await supabase.auth.refreshSession();

      const flatIds = fullDraftQuestions.map(q => q.id);
      const totalMarks = fullDraftQuestions.reduce((sum, q) => sum + (q.marks || 1), 0);
      
      const payload = {
        question_ids: flatIds, 
        total_marks: totalMarks,
        status: 'Finalized' // Mark it as complete
      };
      
      const { error } = await supabase.from('offline_papers').update(payload).eq('id', draftPaperId);
      if (error) throw new Error(error.message);
      
      setMessage({ type: 'success', text: 'Exam Finalized & Locked! Moving to Database...' });
      setReviewModalOpen(false);
      setTimeout(() => { 
        setCreationStep(1); 
        setDraftPaperId(null);
        setExamName(''); 
        setExamDate('');
        setSection('');
        setMessage(null); 
        setActiveTab('history'); 
      }, 2500);
    } catch (err: any) {
      setMessage({ type: 'error', text: `Failed to finalize: ${err.message}` });
    } finally { setSaving(false); }
  };

  // ============ PDF GENERATION ENGINE ============
  const generatePDFDocument = (questions: MCQ[], docTitle: string, docDuration: number, docSubject: string, copyType: 'student' | 'teacher') => {
    const doc = new jsPDF(); 
    const pageWidth = doc.internal.pageSize.getWidth(); 
    const margin = 15;
    const finalTitle = copyType === 'teacher' ? `${docTitle} (Teacher Copy)` : docTitle;
    
    doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text(finalTitle, pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Duration: ${docDuration} mins | Total Qs: ${questions.length}`, pageWidth / 2, 28, { align: 'center' });
    doc.text(`Subject: ${docSubject}`, pageWidth / 2, 34, { align: 'center' });
    doc.setDrawColor(200); doc.line(margin, 38, pageWidth - margin, 38);

    let yPosition = 48;
    questions.forEach((q, index) => {
      if (yPosition > 270) { doc.addPage(); yPosition = 20; }
      
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
      doc.text(`Q${index + 1}.`, margin, yPosition);
      doc.setFont('helvetica', 'normal');
      const qLines = doc.splitTextToSize(q.question, pageWidth - margin * 2 - 10);
      doc.text(qLines, margin + 10, yPosition); yPosition += qLines.length * 5 + 2;

      if (q.type === 'Multiple Choice' && q.options) {
        const opts = Array.isArray(q.options) ? q.options : [];
        opts.forEach((opt: string, i: number) => {
          const optText = `${String.fromCharCode(65 + i)}) ${opt}`;
          const oLines = doc.splitTextToSize(optText, pageWidth - margin * 2 - 15);
          doc.text(oLines, margin + 15, yPosition); yPosition += oLines.length * 5;
        });
      }

      if (copyType === 'teacher') {
        const ans = (q as any).answer || (q as any).correct_answer || (q as any).correct_option || 'Not specified';
        const qIdStr = q.question_code || q.id.substring(0, 8); 

        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(22, 163, 74);
        doc.text(`Correct Answer: ${ans}`, margin + 10, yPosition + 2);
        
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(120); 
        doc.text(`[ID: ${qIdStr} | Diff: ${q.difficulty || 'N/A'} | Subj: ${q.subject} | Topic: ${q.topic || 'General'}]`, margin + 10, yPosition + 8);
        doc.setTextColor(0); yPosition += 16;
      } else {
        yPosition += 8;
      }
    });

    return doc;
  };

  // ============ DOCX GENERATION ENGINE ============
  const generateDOCXDocument = async (questions: MCQ[], docTitle: string, docDuration: number, docSubject: string, copyType: 'student' | 'teacher') => {
    const finalTitle = copyType === 'teacher' ? `${docTitle} (Teacher Copy)` : docTitle;
    const sections: any[] = [];
  
    sections.push(new Paragraph({ text: finalTitle, alignment: "center", spacing: { after: 200 }, children: [new TextRun({ text: finalTitle, size: 36, bold: true, font: "Helvetica" })] }));
    sections.push(new Paragraph({ alignment: "center", spacing: { after: 100 }, children: [new TextRun({ text: `Duration: ${docDuration} mins | Total Qs: ${questions.length}`, size: 20, font: "Helvetica" })] }));
    sections.push(new Paragraph({ alignment: "center", spacing: { after: 400 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: "CCCCCC", space: 10 } }, children: [new TextRun({ text: `Subject: ${docSubject}`, size: 20, font: "Helvetica" })] }));
  
    questions.forEach((q, index) => {
      sections.push(new Paragraph({ spacing: { before: 300, after: 100 }, children: [new TextRun({ text: `Q${index + 1}. `, bold: true, size: 22, font: "Helvetica" }), new TextRun({ text: q.question, size: 22, font: "Helvetica" })] }));
      if (q.type === 'Multiple Choice' && Array.isArray(q.options) && q.options.length > 0) {
        q.options.forEach((opt: string, i: number) => {
          sections.push(new Paragraph({ spacing: { after: 80 }, indent: { left: 400 }, children: [new TextRun({ text: `${String.fromCharCode(65 + i)}) ${opt}`, size: 22, font: "Helvetica" })] }));
        });
      }
      if (copyType === 'teacher') {
        const ans = (q as any).answer || (q as any).correct_answer || (q as any).correct_option || 'Not specified';
        const qIdStr = q.question_code || q.id.substring(0, 8); 
        sections.push(new Paragraph({ spacing: { before: 100, after: 40 }, indent: { left: 400 }, children: [new TextRun({ text: `Correct Answer: ${ans}`, bold: true, size: 20, font: "Helvetica", color: "16A34A" })] }));
        sections.push(new Paragraph({ spacing: { after: 200 }, indent: { left: 400 }, children: [new TextRun({ text: `[ID: ${qIdStr} | Diff: ${q.difficulty || 'N/A'} | Subj: ${q.subject} | Topic: ${q.topic || 'General'}]`, size: 16, font: "Helvetica", color: "777777" })] }));
      } else {
        sections.push(new Paragraph({ spacing: { after: 200 } }));
      }
    });
  
    const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children: sections }] });
    const blob = await Packer.toBlob(doc);
    const fileNameSuffix = copyType === 'teacher' ? 'Teacher_Copy' : 'Student_Copy';
    saveAs(blob, `${docTitle.replace(/\s+/g, '_')}_${fileNameSuffix}_${new Date().toISOString().split('T')[0]}.docx`);
  };

  const extractOrderedQuestions = async (paper: OfflinePaper) => {
    const allIds: string[] = [];
    if (paper.question_allocations && Object.keys(paper.question_allocations).length > 0) {
      Object.keys(paper.subject_config || {}).forEach(subj => {
        allIds.push(...(paper.question_allocations[subj]?.track1 || []));
        if (paper.tracks_enabled) allIds.push(...(paper.question_allocations[subj]?.track2 || []));
      });
    } else { allIds.push(...(paper.question_ids || [])); } 

    const { data, error } = await supabase.from('mcqs').select('*').in('id', allIds);
    if (error) throw error;
    return allIds.map(id => data.find(q => q.id === id)).filter(Boolean) as MCQ[];
  };

  const handlePrepareHistoryDownload = async (paper: OfflinePaper) => {
    setDownloadingPDF(true); setMessage({ type: 'success', text: 'Preparing questions...' });
    try {
      const ordered = await extractOrderedQuestions(paper);
      setDownloadData({ questions: ordered, title: paper.title, duration: paper.duration, subject: paper.subject, paperId: paper.id });
      setDownloadType('student'); setDownloadModalOpen(true); setMessage(null);
    } catch (err: any) { setMessage({ type: 'error', text: err.message }); } 
    finally { setDownloadingPDF(false); }
  };

  const proceedToFormatSelection = () => { setDownloadModalOpen(false); setSelectedFormat('pdf'); setFormatModalOpen(true); };

  const executeDownload = async () => {
    if (!downloadData) return;
    try {
      if (selectedFormat === 'pdf') {
        const pdfDoc = generatePDFDocument(downloadData.questions, downloadData.title, downloadData.duration, downloadData.subject, downloadType);
        const fileNameSuffix = downloadType === 'teacher' ? 'Teacher_Copy' : 'Student_Copy';
        pdfDoc.save(`${downloadData.title.replace(/\s+/g, '_')}_${fileNameSuffix}_${new Date().toISOString().split('T')[0]}.pdf`);
      } else {
        await generateDOCXDocument(downloadData.questions, downloadData.title, downloadData.duration, downloadData.subject, downloadType);
      }

      if (downloadData.paperId) {
        const isTeacher = downloadType === 'teacher';
        const currentPaper = paperHistory.find(p => p.id === downloadData.paperId);
        let updatedStudentCount = currentPaper?.student_downloads || currentPaper?.downloads || 0;
        let updatedTeacherCount = currentPaper?.teacher_downloads || 0;

        if (isTeacher) updatedTeacherCount += 1;
        else updatedStudentCount += 1;
        
        setPaperHistory(prev => prev.map(p => p.id === downloadData.paperId ? { ...p, student_downloads: updatedStudentCount, teacher_downloads: updatedTeacherCount } : p));
        supabase.from('offline_papers').update(isTeacher ? { teacher_downloads: updatedTeacherCount } : { student_downloads: updatedStudentCount }).eq('id', downloadData.paperId).then();
      }

      setMessage({ type: 'success', text: `Downloaded ${downloadType === 'teacher' ? 'Teacher' : 'Student'} Copy as ${selectedFormat.toUpperCase()}!` });
      setFormatModalOpen(false); setTimeout(() => setMessage(null), 3000);
    } catch (err: any) { console.error(err); setMessage({ type: 'error', text: `Download failed: ${err.message}` }); }
  };

  const handleDeletePaper = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this paper record?")) return;
    try {
      await supabase.from('offline_papers').delete().eq('id', id);
      setPaperHistory(prev => prev.filter(p => p.id !== id));
      setMessage({ type: 'success', text: 'Paper deleted!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) { console.error(err); }
  };

  const handleViewPaperQuestions = async (paper: OfflinePaper) => {
    setHistoryActivePaper(paper); setHistoryQuestions([]); setHistoryQuestionsError(null); setHistoryQuestionsOpen(true);
    setLoadingHistoryQuestions(true);
    try {
      const ordered = await extractOrderedQuestions(paper);
      setHistoryQuestions(ordered);
    } catch (e: any) { setHistoryQuestionsError(e?.message); } 
    finally { setLoadingHistoryQuestions(false); }
  };

  const closeHistoryQuestions = () => {
    setHistoryQuestionsOpen(false);
    setTimeout(() => { setHistoryActivePaper(null); setHistoryQuestions([]); setHistoryQuestionsError(null); }, 200); 
  };

  const renderSearchableList = (
    title: string, items: string[], selected: string[], setSelected: React.Dispatch<React.SetStateAction<string[]>>,
    searchQuery: string, setSearchQuery: React.Dispatch<React.SetStateAction<string>>, disabled: boolean, emptyMessage: string, isLoading: boolean,
    renderBadge?: (item: string) => React.ReactNode, renderExtra?: (item: string) => React.ReactNode,
    getItemSubject?: (item: string) => string | undefined, getItemTopic?: (item: string) => string | undefined
  ) => {
    const filteredItems = items.filter(item => item.toLowerCase().includes(searchQuery.toLowerCase()));
    const handleToggle = (val: string) => setSelected(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
    const handleSelectAll = () => { if (selected.length === items.length && items.length > 0) setSelected([]); else setSelected([...items]); };

    return (
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center px-1">
          <label className="text-[13px] font-extrabold text-gray-300 uppercase tracking-widest">{title}</label>
          {!disabled && items.length > 0 && !isLoading && (
            <button type="button" onClick={handleSelectAll} className={`text-xs font-bold px-3 py-1 rounded-md border transition-all duration-200 ${
              selected.length === items.length && items.length > 0 ? 'bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white' : 'bg-green-600/10 border-green-500/30 text-green-400 hover:bg-green-500 hover:text-white hover:border-green-500'}`}>
              {selected.length === items.length && items.length > 0 ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>
        
        <div className={`bg-gray-800/60 border border-gray-700/80 rounded-2xl overflow-hidden flex flex-col transition-all duration-300 shadow-lg ${disabled ? 'opacity-50 pointer-events-none' : 'focus-within:border-green-500/50 focus-within:ring-2 focus-within:ring-green-500/10'}`}>
          <div className="relative border-b border-gray-700/60 bg-gray-900/40">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <input type="text" placeholder={`Search ${title.toLowerCase()}...`} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-transparent text-sm pl-11 pr-4 py-3.5 outline-none text-white placeholder-gray-500 font-medium transition-colors" disabled={disabled || isLoading}/>
          </div>

          <div className="h-64 overflow-y-auto p-2 space-y-1.5 custom-scrollbar relative">
            {isLoading ? (
              <div className="flex flex-col gap-3 p-2 animate-pulse">
                {[1, 2, 3].map((n) => (<div key={n} className="flex items-center gap-3"><div className="w-5 h-5 rounded bg-gray-700/50 flex-shrink-0"></div><div className="h-4 bg-gray-700/50 rounded w-full max-w-[80%]"></div></div>))}
              </div>
            ) : disabled ? (
              <div className="h-full flex items-center justify-center p-4"><p className="text-sm text-gray-500 text-center font-medium">{emptyMessage}</p></div>
            ) : items.length === 0 ? (
              <div className="h-full flex items-center justify-center p-4"><p className="text-sm text-gray-500 text-center font-medium">No items found</p></div>
            ) : filteredItems.length === 0 ? (
              <div className="h-full flex items-center justify-center p-4"><p className="text-sm text-gray-500 text-center font-medium">No match for "{searchQuery}"</p></div>
            ) : (
              filteredItems.map(item => {
                const isSelected = selected.includes(item);
                const subj = getItemSubject ? getItemSubject(item) : null;
                const topc = getItemTopic ? getItemTopic(item) : null;

                return (
                  <div key={item} className={`flex flex-col p-3 rounded-xl transition-all duration-200 group animate-fade-in ${isSelected ? 'bg-gray-700/30 border border-gray-600/50 shadow-sm' : 'hover:bg-gray-700/40 border border-transparent cursor-pointer'}`} onClick={() => !isSelected && handleToggle(item)}>
                    <div className="flex items-start justify-between cursor-pointer" onClick={(e) => { if(isSelected){ e.stopPropagation(); handleToggle(item); }}}>
                      <div className="flex items-start gap-3.5">
                        <div className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all duration-200 flex-shrink-0 ${isSelected ? 'bg-green-500 border-green-500 scale-105' : 'bg-gray-900 border-gray-600 group-hover:border-gray-400'}`}>
                          {isSelected && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <div className="flex flex-col items-start pr-2">
                          <span className={`text-sm leading-tight transition-colors duration-200 pt-0.5 ${isSelected ? 'text-green-400 font-bold' : 'text-gray-300 font-medium group-hover:text-white'}`}>{item}</span>
                          {subj && (
                            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-bold text-gray-400 border-gray-600 bg-gray-700`}>{subj}</span>
                              {topc && (<><span className="text-gray-600 text-[10px] font-black">/</span><span className="text-[9px] truncate max-w-[120px] text-gray-500">{topc}</span></>)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-0.5">{renderBadge && renderBadge(item)}</div>
                    </div>
                    {isSelected && renderExtra && (<div onClick={e => e.stopPropagation()}>{renderExtra(item)}</div>)}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSubTopicConfig = (subTopic: string) => {
    const stats = availableSubTopicsMap[subTopic] || { easy: 0, medium: 0, hard: 0, total: 0 };
    const config = subTopicConfig[subTopic] || { easy: '', medium: '', hard: '' };
    const handleChange = (diff: 'easy' | 'medium' | 'hard', val: string) => setSubTopicConfig(prev => ({ ...prev, [subTopic]: { ...prev[subTopic], [diff]: val } }));
    
    const eExceed = (parseInt(config.easy) || 0) > stats.easy;
    const mExceed = (parseInt(config.medium) || 0) > stats.medium;
    const hExceed = (parseInt(config.hard) || 0) > stats.hard;

    return (
      <div className="mt-4 ml-[34px] grid grid-cols-3 gap-2.5 animate-fade-in pb-1">
        <div className="flex flex-col gap-1.5"><span className="text-[10px] text-green-400 font-bold uppercase tracking-wider pl-0.5 flex justify-between">Easy <span>{stats.easy}</span></span><input type="number" min="0" max={stats.easy} value={config.easy} onChange={e => handleChange('easy', e.target.value)} placeholder={`Max: ${stats.easy}`} className={`w-full bg-gray-900 border rounded-lg px-2 text-xs font-medium py-2 outline-none transition-colors shadow-inner placeholder-gray-600 ${eExceed ? 'border-red-500/80 text-red-400 focus:border-red-500' : 'border-gray-700/80 text-white focus:border-green-500 focus:bg-gray-800'}`} /></div>
        <div className="flex flex-col gap-1.5"><span className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider pl-0.5 flex justify-between">Medium <span>{stats.medium}</span></span><input type="number" min="0" max={stats.medium} value={config.medium} onChange={e => handleChange('medium', e.target.value)} placeholder={`Max: ${stats.medium}`} className={`w-full bg-gray-900 border rounded-lg px-2 text-xs font-medium py-2 outline-none transition-colors shadow-inner placeholder-gray-600 ${mExceed ? 'border-red-500/80 text-red-400 focus:border-red-500' : 'border-gray-700/80 text-white focus:border-yellow-500 focus:bg-gray-800'}`} /></div>
        <div className="flex flex-col gap-1.5"><span className="text-[10px] text-red-400 font-bold uppercase tracking-wider pl-0.5 flex justify-between">Hard <span>{stats.hard}</span></span><input type="number" min="0" max={stats.hard} value={config.hard} onChange={e => handleChange('hard', e.target.value)} placeholder={`Max: ${stats.hard}`} className={`w-full bg-gray-900 border rounded-lg px-2 text-xs font-medium py-2 outline-none transition-colors shadow-inner placeholder-gray-600 ${hExceed ? 'border-red-500/80 text-red-400 focus:border-red-500' : 'border-gray-700/80 text-white focus:border-red-500 focus:bg-gray-800'}`} /></div>
      </div>
    );
  };

  return (
    <div className="text-white relative min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 reveal-on-scroll">
        <div>
          <h2 className="text-3xl font-extrabold mb-1 tracking-tight">Question Paper</h2>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-2"><InformationCircleIcon className="h-4 w-4" /> Generate tailored question papers or manage history.</span>
          </div>
        </div>

        <div className="bg-gray-900/60 backdrop-blur-xl p-1.5 rounded-2xl border border-gray-800/80 shadow-inner flex items-center gap-1 w-full md:w-auto overflow-hidden">
          <button onClick={() => setActiveTab('generator')} className={`flex-1 md:w-48 py-2.5 px-4 rounded-xl text-sm font-bold transition-all duration-300 relative ${activeTab === 'generator' ? 'text-white bg-gray-800 shadow-md border border-gray-700/50' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 border border-transparent'}`}>
            <span className="relative z-10 flex items-center justify-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg> Generator</span>
          </button>
          <button onClick={() => setActiveTab('history')} className={`flex-1 md:w-48 py-2.5 px-4 rounded-xl text-sm font-bold transition-all duration-300 relative ${activeTab === 'history' ? 'text-white bg-gray-800 shadow-md border border-gray-700/50' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 border border-transparent'}`}>
            <span className="relative z-10 flex items-center justify-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Database</span>
          </button>
        </div>
      </div>

      <div className="relative">
        {activeTab === 'generator' && (
          <div className="animate-fade-in pb-12 max-w-6xl mx-auto">
            
            {/* ================================= STEP 1: SETUP ================================= */}
            {creationStep === 1 && (
              <div className="bg-gray-900/40 p-8 rounded-3xl border border-gray-800 backdrop-blur-xl shadow-2xl">
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-white tracking-wide">Step 1: Exam Draft Details</h3>
                  <p className="text-sm text-gray-400 mt-1">Configure the blueprint and rules. You can save this draft and resume adding questions later.</p>
                </div>

                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2.5">
                      <label className="text-sm font-bold text-gray-400">Exam Name <span className="text-red-500">*</span></label>
                      <input type="text" placeholder="e.g., Mid-Term Assessment" value={examName} onChange={e => setExamName(e.target.value)} className="w-full bg-gray-800/80 border border-gray-700/80 text-sm rounded-xl py-3 px-4 focus:border-green-500 outline-none text-white transition-all shadow-inner focus:ring-1 focus:ring-green-500/20"/>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      <label className="text-sm font-bold text-gray-400">Exam Date <span className="text-red-500">*</span></label>
                      <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} className="w-full bg-gray-800/80 border border-gray-700/80 text-sm rounded-xl py-3 px-4 focus:border-green-500 outline-none text-white transition-all shadow-inner cursor-pointer" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2.5">
                      <label className="text-sm font-bold text-gray-400">Grade & Section <span className="text-red-500">*</span></label>
                      <div className="flex gap-4">
                        <select value={grade} onChange={e => setGrade(e.target.value)} className="w-1/2 bg-gray-800/80 border border-gray-700/80 text-sm rounded-xl py-3 px-4 focus:border-green-500 outline-none text-white transition-all shadow-inner appearance-none cursor-pointer">
                          <option value="" disabled>Grade</option><option value="10">Grade 10</option><option value="11">Grade 11</option><option value="12">Grade 12</option>
                        </select>
                        <input type="text" placeholder="Section (Optional)" value={section} onChange={e => setSection(e.target.value)} className="w-1/2 bg-gray-800/80 border border-gray-700/80 text-sm rounded-xl py-3 px-4 focus:border-green-500 outline-none text-white transition-all shadow-inner"/>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2.5">
                       <label className="text-sm font-bold text-gray-400">Assessment Type</label>
                       <div className="flex gap-4">
                        <select value={assessmentType} onChange={e => setAssessmentType(e.target.value as any)} className="w-1/2 bg-gray-800/80 border border-gray-700/80 text-sm rounded-xl py-3 px-4 focus:border-green-500 outline-none text-white transition-all shadow-inner cursor-pointer">
                          <option value="Assignment">Assignment</option><option value="Test">Competitive Test</option>
                        </select>
                        <select value={examType} onChange={e => setExamType(e.target.value)} disabled={assessmentType === 'Assignment'} className="w-1/2 bg-gray-800/80 border border-gray-700/80 text-sm rounded-xl py-3 px-4 focus:border-purple-500 outline-none text-white transition-all shadow-inner appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                          <option value="" disabled>Exam Pattern</option><option value="NEET">NEET</option><option value="JEE">JEE Main</option><option value="KCET-Eng">KCET (Engineering)</option><option value="KCET-Agri">KCET (Agriculture)</option>
                        </select>
                       </div>
                    </div>
                  </div>

                  <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-700 to-transparent opacity-50" />

                  {/* DYNAMIC SUBJECT TRACKS CONFIGURATOR */}
                  <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                    <div className="p-5 border-b border-gray-700/50 flex flex-wrap gap-4 justify-between items-center bg-gray-900/30">
                      <div>
                        <h4 className="text-white font-bold tracking-wide">Subject Breakdown</h4>
                        <p className="text-xs text-gray-400 mt-1">Allocate questions per subject based on your pattern.</p>
                      </div>
                      
                      <div className="flex items-center gap-3 bg-gray-800 px-4 py-2 rounded-xl border border-gray-700">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={tracksEnabled} onChange={e => setTracksEnabled(e.target.checked)} className="sr-only peer" />
                          <div className="w-10 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500" />
                        </label>
                        <span className="text-sm font-bold text-gray-300">Enable Tracks</span>
                      </div>
                    </div>
                    
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                      {Object.keys(subjectConfig).length === 0 ? (
                        <p className="text-sm text-gray-500 italic col-span-2">Select an assessment type to configure subjects.</p>
                      ) : (
                        Object.entries(subjectConfig).map(([subj, counts]) => (
                          <div key={subj} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl border border-gray-700/80 hover:border-gray-600 transition-colors">
                            <span className="font-bold text-gray-300 w-1/3">{subj}</span>
                            <div className="flex gap-4 items-center justify-end w-2/3">
                              <div className="flex items-center gap-2">
                                {tracksEnabled && <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">T1</span>}
                                <input type="number" min="0" value={counts.track1} onChange={e => updateSubjectTrack(subj, 'track1', e.target.value)} className="w-16 bg-gray-900 border border-gray-600 rounded-lg text-sm text-center py-2 text-white outline-none focus:border-green-500" />
                              </div>
                              {tracksEnabled && (
                                <div className="flex items-center gap-2 animate-fade-in">
                                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">T2</span>
                                  <input type="number" min="0" value={counts.track2} onChange={e => updateSubjectTrack(subj, 'track2', e.target.value)} className="w-16 bg-gray-900 border border-gray-600 rounded-lg text-sm text-center py-2 text-white outline-none focus:border-blue-500" />
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="p-4 bg-gray-900/60 border-t border-gray-700/50 flex justify-between items-center">
                      <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest">Total Questions</span>
                          <span className="text-lg font-bold text-green-400">{totalQuestionsNeeded}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest">Duration (Mins) <span className="text-red-500">*</span></span>
                          <input type="number" value={duration} onChange={e => setDuration(e.target.value === '' ? '' : parseInt(e.target.value, 10))} className="w-20 bg-gray-800 border border-gray-700 rounded-lg text-sm font-bold text-yellow-400 px-3 py-1 outline-none focus:border-yellow-500"/>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                <div className="mt-8 pt-6 border-t border-gray-800 flex justify-between items-center">
                  <div className="flex-1 pr-4">
                    {message && <p className={`text-sm font-bold animate-fade-in ${message.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>{message.text}</p>}
                  </div>
                  <button onClick={handleCreateExamProceed} disabled={saving} className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 text-white px-8 py-3.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2 transform active:scale-95">
                    {saving ? 'Creating Draft...' : 'Save Draft & Proceed'} <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                  </button>
                </div>
              </div>
            )}

            {/* ================================= STEP 2: ITERATIVE GENERATION ================================= */}
            {creationStep === 2 && (
              <div className="space-y-6 animate-fade-in">
                
                {/* --- DRAFT PROGRESS DASHBOARD --- */}
                <div className="bg-gray-900/60 p-6 lg:p-8 rounded-3xl border border-gray-800 backdrop-blur-xl shadow-xl">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-2xl font-bold text-white tracking-wide">Exam Draft: {examName}</h3>
                      <p className="text-sm text-gray-400 mt-1">Total Progress: <span className="text-white font-bold">{totalQuestionsFilled} / {totalQuestionsNeeded} Questions</span></p>
                    </div>
                    <button onClick={() => setCreationStep(1)} className="px-4 py-2 rounded-xl bg-gray-800 text-gray-300 text-sm font-bold border border-gray-700 hover:bg-gray-700 hover:text-white transition-all flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg> Edit Blueprint
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Object.keys(subjectConfig).map(subj => {
                      const t1Req = Number(subjectConfig[subj].track1) || 0;
                      const t2Req = tracksEnabled ? (Number(subjectConfig[subj].track2) || 0) : 0;
                      if (t1Req === 0 && t2Req === 0) return null;
                      
                      return (
                        <div key={subj} className="flex flex-col gap-3 p-4 bg-gray-800/40 rounded-xl border border-gray-700/50 hover:border-gray-600 transition-colors">
                          <div className="font-bold text-sm text-gray-300">{subj}</div>
                          {t1Req > 0 && (
                            <div 
                              onClick={() => setCurrentTarget(`${subj}|track1`)} 
                              className={`flex justify-between items-center p-2.5 rounded-lg border-2 cursor-pointer transition-all ${currentTarget === `${subj}|track1` ? 'border-green-500 bg-green-500/10 scale-[1.02] shadow-lg shadow-green-900/20' : 'border-gray-700 hover:border-gray-500 bg-gray-800/50'}`}
                            >
                              <span className={`text-xs font-bold ${currentTarget === `${subj}|track1` ? 'text-green-400' : 'text-gray-400'}`}>Track 1</span>
                              <span className={`text-xs font-mono font-bold ${(questionAllocations[subj]?.track1?.length || 0) === t1Req ? 'text-green-400' : 'text-yellow-400'}`}>{questionAllocations[subj]?.track1?.length || 0} / {t1Req}</span>
                            </div>
                          )}
                          {tracksEnabled && t2Req > 0 && (
                            <div 
                              onClick={() => setCurrentTarget(`${subj}|track2`)} 
                              className={`flex justify-between items-center p-2.5 rounded-lg border-2 cursor-pointer transition-all ${currentTarget === `${subj}|track2` ? 'border-green-500 bg-green-500/10 scale-[1.02] shadow-lg shadow-green-900/20' : 'border-gray-700 hover:border-gray-500 bg-gray-800/50'}`}
                            >
                              <span className={`text-xs font-bold ${currentTarget === `${subj}|track2` ? 'text-green-400' : 'text-gray-400'}`}>Track 2</span>
                              <span className={`text-xs font-mono font-bold ${(questionAllocations[subj]?.track2?.length || 0) === t2Req ? 'text-green-400' : 'text-yellow-400'}`}>{questionAllocations[subj]?.track2?.length || 0} / {t2Req}</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  
                  <div className="mt-8 pt-6 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-gray-500 font-medium">{isDraftComplete ? 'All buckets are filled. You can now review and publish the final exam.' : 'Select a bucket above to start adding questions to it.'}</p>
                    <button 
                      onClick={handleOpenReviewModal} 
                      disabled={!isDraftComplete}
                      className={`px-8 py-3.5 rounded-xl font-bold text-sm transition-all shadow-lg transform active:scale-95 ${isDraftComplete ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-blue-900/30' : 'bg-gray-800 border border-gray-700 text-gray-500 cursor-not-allowed opacity-50'}`}
                    >
                      {isDraftComplete ? 'Review & Finalize Paper' : 'Fill All Buckets to Finalize'}
                    </button>
                  </div>
                </div>

                {/* --- GENERATOR UI (Target Context) --- */}
                {currentTarget && remainingInBucket > 0 ? (
                  <div className="bg-gray-900/40 p-6 lg:p-8 rounded-3xl border border-gray-800 backdrop-blur-xl shadow-2xl animate-fade-in">
                    
                    <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-800/50 p-5 rounded-2xl border border-gray-700/50 gap-4">
                      <div>
                        <h4 className="text-lg font-bold text-white flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                          Generating for: <span className="text-green-400">{targetSubj} {tracksEnabled ? `(Track ${targetTrck.replace('track', '')})` : ''}</span>
                        </h4>
                        <p className="text-sm text-gray-400 mt-1">Need <strong className="text-white bg-gray-800 px-2 py-0.5 rounded mx-1 border border-gray-600">{remainingInBucket}</strong> more questions to complete this bucket.</p>
                      </div>
                      <button onClick={() => handleClearBucket(targetSubj, targetTrck)} className="text-xs font-bold text-red-400 bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center gap-2">
                        <TrashIcon className="w-3.5 h-3.5" /> Clear Bucket
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <MultiSelectDropdown label="Question Type" options={QUESTION_TYPE_OPTIONS} selected={selectedTypes} setSelected={setSelectedTypes} />
                      <MultiSelectDropdown label="Difficulty" options={DIFFICULTY_OPTIONS} selected={selectedDifficulties} setSelected={setSelectedDifficulties} disabled={useDistribution} />
                      
                      <div className="flex flex-col gap-2 lg:col-span-2">
                        <label className="text-[11px] font-extrabold text-green-500 uppercase tracking-widest pl-1">Specific Sub-Topic Requirement Progress</label>
                        <div className="w-full bg-gray-900 border border-gray-700/80 rounded-xl p-3 flex flex-col justify-center h-[46px]">
                          <div className="flex justify-between items-center px-1 mb-1">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">Allocated to Sub-Topics:</span>
                            <span className={`text-[11px] font-bold ${requestedSpecificQuestions > remainingInBucket ? 'text-red-400' : 'text-green-400'}`}>
                              {requestedSpecificQuestions} / {remainingInBucket} Requested
                            </span>
                          </div>
                          <div className="w-full bg-gray-800/80 h-1.5 rounded-full overflow-hidden border border-gray-700/50">
                            <div className={`h-full transition-all duration-300 ${requestedSpecificQuestions > remainingInBucket ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min((requestedSpecificQuestions / remainingInBucket) * 100, 100)}%` }}></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-700 to-transparent opacity-50 my-8" />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                      {renderSearchableList('Topics', availableTopics, selectedTopics, setSelectedTopics, topicSearch, setTopicSearch, false, '', loadingPool, (item) => <span className="bg-gray-800/80 border border-gray-700 text-gray-400 text-[10px] font-mono px-2 py-0.5 rounded-md">{availableTopicsMap[item]?.count || 0}</span>, undefined, (item) => availableTopicsMap[item]?.subject)}
                      {renderSearchableList('Sub-Topics', availableSubTopics, selectedSubTopics, setSelectedSubTopics, subTopicSearch, setSubTopicSearch, selectedTopics.length === 0, 'Select at least one Topic first', loadingPool, (item) => <span className="bg-gray-800/80 border border-gray-700 text-gray-400 text-[10px] font-mono px-2 py-0.5 rounded-md">{availableSubTopicsMap[item]?.total || 0}</span>, renderSubTopicConfig, (item) => availableSubTopicsMap[item]?.subject, (item) => availableSubTopicsMap[item]?.topic)}
                    </div>

                    <div className="border border-gray-700/80 rounded-2xl p-6 bg-gray-800/40 shadow-inner mt-8">
                      <div className="flex items-center justify-between mb-2 flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={useDistribution} onChange={e => setUseDistribution(e.target.checked)} className="sr-only peer" />
                            <div className="w-12 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500 shadow-inner" />
                          </label>
                          <div>
                            <span className="text-sm font-bold text-white tracking-wide block">Use Global Difficulty Distribution</span>
                            <span className="text-xs text-gray-500 block">Applies globally to the remaining questions not handled by specific sub-topic rules.</span>
                          </div>
                        </div>
                        {!isDistributionValid && useDistribution && <span className="text-xs font-bold text-red-400 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">Must equal 100%</span>}
                      </div>

                      {useDistribution && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in mt-6">
                          <div className="flex flex-col gap-3"><label className="text-xs font-bold text-green-400 uppercase flex items-center justify-between"><span>Easy</span><span className="bg-green-500/10 px-2 py-0.5 rounded text-green-400">{easyPercent}%</span></label><input type="range" min={0} max={100} step={5} value={easyPercent} onChange={e => setEasyPercent(parseInt(e.target.value, 10))} className="w-full accent-green-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"/></div>
                          <div className="flex flex-col gap-3"><label className="text-xs font-bold text-yellow-400 uppercase flex items-center justify-between"><span>Medium</span><span className="bg-yellow-500/10 px-2 py-0.5 rounded text-yellow-400">{mediumPercent}%</span></label><input type="range" min={0} max={100} step={5} value={mediumPercent} onChange={e => setMediumPercent(parseInt(e.target.value, 10))} className="w-full accent-yellow-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"/></div>
                          <div className="flex flex-col gap-3"><label className="text-xs font-bold text-red-400 uppercase flex items-center justify-between"><span>Hard</span><span className="bg-red-500/10 px-2 py-0.5 rounded text-red-400">{hardPercent}%</span></label><input type="range" min={0} max={100} step={5} value={hardPercent} onChange={e => setHardPercent(parseInt(e.target.value, 10))} className="w-full accent-red-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"/></div>
                        </div>
                      )}
                    </div>

                    <div className="pt-6 flex justify-between items-center">
                      <div className="flex-1 pr-4">
                        {message && <p className={`text-sm font-bold animate-fade-in ${message.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>{message.text}</p>}
                      </div>
                      <button onClick={handleGenerate} disabled={generating || (useDistribution && !isDistributionValid) || loadingPool} className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:from-gray-700 disabled:to-gray-700 disabled:opacity-50 text-white px-8 py-3.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-green-900/20 flex items-center gap-2 transform active:scale-95 whitespace-nowrap">
                        {generating ? 'Searching Bank...' : `Generate ${remainingInBucket} Questions`}
                        {!generating && <FunnelIcon className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                ) : currentTarget && remainingInBucket === 0 ? (
                  <div className="bg-green-500/10 border border-green-500/30 p-10 rounded-3xl text-center animate-fade-in">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/40">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8 text-green-400"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                    </div>
                    <h3 className="text-2xl font-bold text-green-400 mb-2">Bucket Complete!</h3>
                    <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">You have successfully added all {currentBucketQuota} required questions for {targetSubj} {targetTrck.toUpperCase()}. Select another incomplete bucket from the Progress Dashboard above.</p>
                    <button onClick={() => handleClearBucket(targetSubj, targetTrck)} className="mt-6 text-xs font-bold text-red-400 hover:text-red-300 underline transition-colors">Clear Bucket & Start Over</button>
                  </div>
                ) : (
                  <div className="bg-gray-800/40 border border-gray-700/50 p-10 rounded-3xl text-center flex flex-col items-center animate-fade-in">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-gray-600 mb-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zm-7.518-.267A8.25 8.25 0 1120.25 10.5M8.288 14.212A5.25 5.25 0 1117.25 10.5" /></svg>
                    <p className="text-gray-400 font-medium">Select a target bucket from the Dashboard above to start generating questions.</p>
                  </div>
                )}

                {/* --- STASH PREVIEW (Pending Add) --- */}
                {generatedPaper.length > 0 && (
                  <div className="bg-gray-900/40 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl animate-fade-in">
                     <div className="p-6 bg-gray-800/40 border-b border-gray-800 flex justify-between items-center flex-wrap gap-4">
                        <div>
                          <h3 className="font-bold text-white text-lg tracking-wide">Pending Questions</h3>
                          <p className="text-xs text-gray-400 mt-1">Review these {generatedPaper.length} questions before adding them to {targetSubj}.</p>
                        </div>
                        <button onClick={handleAddToDraft} disabled={saving} className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/20 transform active:scale-95">
                          {saving ? 'Adding...' : `Add ${generatedPaper.length} Questions to Draft`}
                        </button>
                     </div>
                     <div className="overflow-x-auto">
                      <table className="w-full text-left min-w-[600px]">
                        <thead>
                          <tr className="bg-gray-800/20 border-b border-gray-800">
                            <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest w-16 text-center">No.</th>
                            <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest w-2/3">Question</th>
                            <th className="p-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Metadata</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50 max-h-96 overflow-y-auto">
                          {generatedPaper.map((q, index) => (
                            <tr key={q.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="p-5 text-center text-gray-500 font-mono text-sm">{index + 1}</td>
                              <td className="p-5">
                                <p className="text-sm text-gray-200 font-medium leading-relaxed">{q.question}</p>
                                <p className="text-[10px] text-gray-500 mt-3 flex items-center gap-2">
                                  {q.question_code && <span className="bg-gray-800 border border-gray-700 px-2 py-0.5 rounded font-mono">{q.question_code}</span>}
                                  <span className="bg-gray-800/50 px-2 py-0.5 rounded border border-gray-700/50">{q.type}</span>
                                  {q.sub_topic && <span className="bg-gray-800/50 px-2 py-0.5 rounded border border-gray-700/50">Sub: {q.sub_topic}</span>}
                                </p>
                              </td>
                              <td className="p-5">
                                <div className="flex flex-col gap-2 items-start">
                                  <span className="px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 text-[10px] font-bold rounded uppercase tracking-wider">{q.subject}</span>
                                  <span className="text-[11px] text-gray-400 font-medium bg-gray-800/50 px-2 py-0.5 rounded border border-gray-700/50">G{q.grade || 'N/A'} • {q.difficulty}</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================================= HISTORY TAB ================================= */}
        {activeTab === 'history' && (
          <div className="bg-gray-900/40 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl animate-fade-in">
            <div className="p-6 md:p-8 bg-gray-800/40 border-b border-gray-800 flex justify-between items-center backdrop-blur-md">
              <div>
                <h3 className="text-2xl font-bold text-white tracking-wide">Paper Database</h3>
                <p className="text-sm text-gray-400 mt-1">Review finalized papers or resume incomplete drafts.</p>
              </div>
              <button onClick={fetchHistory} className="text-sm text-green-500 hover:text-green-400 font-bold transition-colors flex items-center gap-2 bg-green-500/10 hover:bg-green-500/20 px-4 py-2.5 rounded-xl border border-green-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                Refresh
              </button>
            </div>

            <div className="overflow-x-auto w-full pb-10">
              <table className="w-full text-left min-w-[800px]">
                <thead>
                  <tr className="bg-gray-800/20 border-b border-gray-800">
                    <th className="p-6 text-xs font-extrabold text-gray-500 uppercase tracking-widest w-1/3">Title & Status</th>
                    <th className="p-6 text-xs font-extrabold text-gray-500 uppercase tracking-widest">Metadata</th>
                    <th className="p-6 text-xs font-extrabold text-gray-500 uppercase tracking-widest">Exam Date</th>
                    <th className="p-6 text-xs font-extrabold text-gray-500 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {loadingHistory ? (
                    <tr><td colSpan={4} className="p-16 text-center text-gray-500 text-base font-medium">Loading history...</td></tr>
                  ) : paperHistory.length === 0 ? (
                    <tr><td colSpan={4} className="p-16 text-center text-gray-500 text-base font-medium flex flex-col items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mb-4 opacity-50"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                      No saved papers found.
                    </td></tr>
                  ) : (
                    paperHistory.map((paper) => {
                      // Calculate filled vs total
                      const needed = Object.values(paper.subject_config || {}).reduce((sum: number, c: any) => sum + (Number(c.track1) || 0) + (paper.tracks_enabled ? (Number(c.track2) || 0) : 0), 0) as number;
                      let filled = 0;
                      if (paper.question_allocations) {
                        filled = Object.values(paper.question_allocations).reduce((sum: number, c: any) => sum + (c.track1?.length || 0) + (paper.tracks_enabled ? (c.track2?.length || 0) : 0), 0) as number;
                      } else {
                         filled = paper.question_ids?.length || 0;
                      }

                      return (
                      <tr key={paper.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="p-6">
                          <p className="text-base font-bold text-gray-200 group-hover:text-white transition-colors">{paper.title}</p>
                          <div className="flex gap-2 items-center flex-wrap mt-2">
                             {paper.status === 'Draft' || filled < needed ? (
                               <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2.5 py-1 rounded text-[10px] font-bold tracking-wide">DRAFT ({filled}/{needed})</span>
                             ) : (
                               <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2.5 py-1 rounded text-[10px] font-bold tracking-wide">FINALIZED</span>
                             )}
                            <span className="text-[11px] text-gray-400 font-medium bg-gray-800/80 px-2.5 py-1 rounded border border-gray-700/80">
                              {paper.duration} Mins
                            </span>
                            {((paper.student_downloads || paper.downloads || 0) > 0 || (paper.teacher_downloads || 0) > 0) && (
                              <span className="text-[10px] font-bold bg-gray-800/50 px-2 py-1 rounded border border-gray-700/50 flex items-center gap-1.5" title="Downloads">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                                <span className="text-purple-400">{paper.student_downloads || paper.downloads || 0} S</span>
                                <span className="text-gray-600">|</span>
                                <span className="text-green-400">{paper.teacher_downloads || 0} T</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="flex gap-2 flex-wrap">
                            {paper.exam_type && <span className="px-2.5 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold rounded uppercase tracking-wider">{paper.exam_type}</span>}
                            {paper.grade && paper.grade !== 'All' && <span className="px-2.5 py-1 bg-gray-800/50 text-gray-300 border border-gray-700/50 text-[10px] font-bold rounded">G{paper.grade}</span>}
                          </div>
                        </td>
                        <td className="p-6 text-sm text-gray-300 font-bold bg-gray-900/40 rounded-xl border border-gray-800/50 text-center">
                          {paper.exam_date ? new Date(paper.exam_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                        </td>
                        <td className="p-6 text-right">
                          <div className="flex justify-end gap-3 items-center">
                            {paper.status === 'Draft' || filled < needed ? (
                               <button onClick={() => handleResumeDraft(paper)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-900/20 whitespace-nowrap transform active:scale-95 flex items-center gap-2">
                                 Resume Draft <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                               </button>
                            ) : (
                               <>
                                <button onClick={() => handleViewPaperQuestions(paper)} className="p-2.5 text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-500/30 rounded-xl transition-all border border-emerald-500/20 transform active:scale-95" title="View Questions">
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                </button>
                                <button onClick={() => handlePrepareHistoryDownload(paper)} disabled={downloadingPDF} className="p-2.5 text-purple-400 hover:text-white bg-purple-500/10 hover:bg-purple-500/30 rounded-xl transition-all disabled:opacity-50 border border-purple-500/20 transform active:scale-95" title="Download Options">
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                                </button>
                               </>
                            )}
                            <button onClick={() => handleDeletePaper(paper.id)} className="p-2.5 text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500/30 rounded-xl transition-all border border-red-500/20 transform active:scale-95" title="Delete Record">
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* --- FULL REVIEW & FINALIZE MODAL --- */}
      {reviewModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity" onClick={() => setReviewModalOpen(false)}/>
          <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col bg-gray-900 border border-gray-700 rounded-3xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-gray-800 bg-gray-800/40 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-bold text-white tracking-wide">Final Exam Preview: {examName}</h3>
                <p className="text-sm text-gray-400 mt-1">Review all {fullDraftQuestions.length} questions before locking the final exam.</p>
              </div>
              <button onClick={() => setReviewModalOpen(false)} className="p-2.5 rounded-xl border border-gray-700/50 bg-gray-800/60 hover:bg-gray-700 hover:text-white text-gray-400 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar bg-gray-900/30 relative">
              {loadingFullDraft ? (
                <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                   <div className="w-10 h-10 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                   <p className="text-gray-400 font-bold tracking-widest uppercase">Assembling Paper...</p>
                </div>
              ) : (
               Object.keys(subjectConfig).map(subj => {
                 const qs = fullDraftQuestions.filter(q => q.subject === subj);
                 if (qs.length === 0) return null;
                 return (
                   <div key={subj} className="mb-10 bg-gray-800/20 p-6 rounded-2xl border border-gray-700/30 shadow-inner">
                     <h4 className="text-xl font-bold text-green-400 mb-6 flex items-center gap-3">
                       <div className="h-6 w-1.5 bg-green-500 rounded-full"></div> {subj} Section <span className="text-sm font-medium text-gray-500 bg-gray-800 px-3 py-1 rounded-lg border border-gray-700">{qs.length} Qs</span>
                     </h4>
                     <div className="space-y-4">
                       {qs.map((q, i) => (
                         <div key={q.id} className="p-5 bg-gray-800/60 rounded-xl border border-gray-700/50 flex gap-4 hover:border-gray-600 transition-colors">
                           <span className="text-gray-500 font-mono font-bold mt-0.5 w-6 text-right select-none">{i + 1}.</span>
                           <div className="flex-1">
                             <p className="text-[15px] text-gray-200 font-medium leading-relaxed">{q.question}</p>
                             <div className="flex gap-2.5 mt-3">
                               {(q as any)._trackContext && <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 font-bold uppercase tracking-wider">{(q as any)._trackContext}</span>}
                               <span className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${q.difficulty === 'Easy' ? 'bg-green-500/10 text-green-400 border-green-500/20' : q.difficulty === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : q.difficulty === 'Hard' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-gray-700/30 text-gray-400 border-gray-600/50'}`}>{q.difficulty}</span>
                               {q.topic && <span className="text-[10px] bg-gray-900 px-2 py-0.5 rounded border border-gray-700 text-gray-400 font-mono truncate max-w-[200px]">{q.topic}</span>}
                             </div>
                           </div>
                         </div>
                       ))}
                     </div>
                   </div>
                 );
               })
              )}
            </div>

            <div className="p-6 border-t border-gray-800 bg-gray-800/60 flex justify-between items-center">
              <p className="text-sm font-bold text-gray-400">Please review carefully before locking. This action cannot be easily undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setReviewModalOpen(false)} className="px-6 py-3 rounded-xl font-bold text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700">Cancel & Edit</button>
                <button onClick={handleFinalizePaper} disabled={saving} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 transform active:scale-95 flex items-center gap-2">
                  {saving ? 'Locking...' : 'Lock & Publish Exam'} <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- DOWNLOAD SELECTION MODAL --- */}
      {downloadModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={() => setDownloadModalOpen(false)}/>
          <div className="relative w-full max-w-lg flex flex-col bg-gray-900 border border-gray-700 rounded-3xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-800/30">
              <h3 className="text-xl font-bold text-white">Select Paper Format</h3>
              <button onClick={() => setDownloadModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-400 mb-2">Choose which version to generate for <span className="font-bold text-white">{downloadData?.title}</span>.</p>
              
              <div onClick={() => setDownloadType('student')} className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 ${downloadType === 'student' ? 'border-purple-500 bg-purple-500/10' : 'border-gray-700 bg-gray-800/40 hover:border-gray-500'}`}>
                <div className={`p-3 rounded-xl flex-shrink-0 ${downloadType === 'student' ? 'bg-purple-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                </div>
                <div>
                  <h4 className={`text-base font-bold ${downloadType === 'student' ? 'text-purple-400' : 'text-gray-200'}`}>Student Copy (Test Paper)</h4>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">Clean format containing only the questions and multiple-choice options. Ideal for distributing to students during an exam.</p>
                </div>
              </div>

              <div onClick={() => setDownloadType('teacher')} className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 ${downloadType === 'teacher' ? 'border-green-500 bg-green-500/10' : 'border-gray-700 bg-gray-800/40 hover:border-gray-500'}`}>
                <div className={`p-3 rounded-xl flex-shrink-0 ${downloadType === 'teacher' ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" /></svg>
                </div>
                <div>
                  <h4 className={`text-base font-bold ${downloadType === 'teacher' ? 'text-green-400' : 'text-gray-200'}`}>Teacher Copy (Answer Key)</h4>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">Includes everything in the student copy, plus Question ID, correct answer, difficulty level, and topic metadata.</p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-800 bg-gray-800/30 flex justify-end gap-3">
              <button onClick={() => setDownloadModalOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">Cancel</button>
              <button onClick={proceedToFormatSelection} className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-lg transform active:scale-95 flex items-center gap-2 ${downloadType === 'student' ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/20' : 'bg-green-600 hover:bg-green-500 shadow-green-900/20'}`}>
                Continue <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- FORMAT SELECTION MODAL --- */}
      {formatModalOpen && (
        <div className="fixed inset-0 z-[71] flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={() => setFormatModalOpen(false)}/>
          <div className="relative w-full max-w-lg flex flex-col bg-gray-900 border border-gray-700 rounded-3xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-800/30">
              <h3 className="text-xl font-bold text-white">Download Format</h3>
              <button onClick={() => setFormatModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-400 mb-2">Choose your preferred file format to download.</p>
              <div onClick={() => setSelectedFormat('pdf')} className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 ${selectedFormat === 'pdf' ? 'border-red-500 bg-red-500/10' : 'border-gray-700 bg-gray-800/40 hover:border-gray-500'}`}>
                <div className={`p-3 rounded-xl flex-shrink-0 ${selectedFormat === 'pdf' ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                </div>
                <div>
                  <h4 className={`text-base font-bold ${selectedFormat === 'pdf' ? 'text-red-400' : 'text-gray-200'}`}>PDF Format</h4>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">Universal format. Best for printing and sharing. Preserves formatting across all devices.</p>
                </div>
              </div>
              <div onClick={() => setSelectedFormat('docx')} className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 ${selectedFormat === 'docx' ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 bg-gray-800/40 hover:border-gray-500'}`}>
                <div className={`p-3 rounded-xl flex-shrink-0 ${selectedFormat === 'docx' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.148.42-.24.63-.114.288-.257.565-.406.827m7.36-92a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z" /></svg>
                </div>
                <div>
                  <h4 className={`text-base font-bold ${selectedFormat === 'docx' ? 'text-blue-400' : 'text-gray-200'}`}>DOCX Format</h4>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">Microsoft Word format. Fully editable. Perfect for further customization and annotations.</p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-800 bg-gray-800/30 flex justify-end gap-3">
              <button onClick={() => setFormatModalOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">Cancel</button>
              <button onClick={executeDownload} className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-lg transform active:scale-95 flex items-center gap-2 ${selectedFormat === 'pdf' ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                Download {selectedFormat.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- VIEW QUESTIONS MODAL (History) --- */}
      {historyQuestionsOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={closeHistoryQuestions}/>
          <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-gray-900/90 border border-gray-700/60 rounded-3xl shadow-2xl overflow-hidden animate-scale-in backdrop-blur-xl">
            <div className="p-5 md:p-6 border-b border-gray-800 bg-gray-800/40 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl md:text-2xl font-extrabold text-white tracking-wide">{historyActivePaper?.title || 'Paper Preview'}</h3>
                <div className="flex gap-3 items-center mt-2 text-sm">
                  <span className="text-gray-400 font-medium">{historyQuestions.length} Questions</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-600"></span><span className="text-gray-400 font-medium">{historyActivePaper?.duration || 0} Mins</span>
                </div>
              </div>
              <button onClick={closeHistoryQuestions} className="p-2.5 rounded-xl border border-gray-700/50 bg-gray-800/60 hover:bg-gray-700 hover:text-white text-gray-400 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 md:p-6 custom-scrollbar">
              {historyQuestionsError && <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm font-medium text-red-400">{historyQuestionsError}</div>}
              {loadingHistoryQuestions ? (
                <div className="space-y-4 animate-pulse">
                  {[1, 2, 3].map(n => (
                    <div key={n} className="rounded-2xl border border-gray-800 bg-gray-800/30 p-5 md:p-6">
                      <div className="flex justify-between items-start gap-4 mb-4">
                        <div className="w-full"><div className="h-4 w-full bg-gray-700/50 rounded mb-2" /><div className="h-4 w-3/4 bg-gray-700/50 rounded" /></div>
                        <div className="h-6 w-16 bg-gray-700/50 rounded flex-shrink-0" />
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
                          <span className="text-green-500 font-bold mr-2 select-none">Q{idx + 1}.</span>{q.question}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <span className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${q.difficulty === 'Easy' ? 'bg-green-500/10 text-green-400 border-green-500/20' : q.difficulty === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : q.difficulty === 'Hard' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-gray-700/30 text-gray-400 border-gray-600/50'}`}>{q.difficulty || 'N/A'}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-gray-900/50 border border-gray-700 text-gray-400 font-mono">{q.type}</span>
                        </div>
                      </div>
                      {q.type === 'Multiple Choice' && Array.isArray(q.options) && q.options.length > 0 && (
                        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                          {q.options.map((opt: string, i: number) => (
                            <div key={`${q.id}-opt-${i}`} className="text-sm text-gray-300 bg-gray-900/50 border border-gray-700/50 rounded-xl px-4 py-3 flex items-start gap-3">
                              <span className="text-gray-500 font-bold font-mono bg-gray-800 w-6 h-6 flex items-center justify-center rounded-md flex-shrink-0">{String.fromCharCode(65 + i)}</span><span className="mt-0.5">{opt}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-5 pt-4 border-t border-gray-700/30 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-medium text-gray-500">
                        {q.subject && <div className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-gray-600"></span>Subj: <span className="text-gray-400">{q.subject}</span></div>}
                        {q.topic && <div className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-gray-600"></span>Topic: <span className="text-gray-400">{q.topic}</span></div>}
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
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}} />
    </div>
  );
};

export default QuestionPaperGenerator;