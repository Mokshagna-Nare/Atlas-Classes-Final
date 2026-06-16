import React, { useState, useEffect, useRef } from 'react';
import { PlusIcon, TrashIcon, FlagIcon, PhotoIcon } from '../../../../components/icons';
import { useData } from '../../../../contexts/DataContext';
import { MCQ } from '../../../../types';
import { supabase } from '../../../../services/supabase';
import BulkUploadDocx from './bulkUpload/BulkUploadDocx';
import { getCorrectOptionIndex } from '../../../../utils/mcqAnswer';


// --- HELPER 1: Generate the Category Prefix (e.g. 26P10-) ---
export const getQuestionPrefix = (subject: string, grade: string) => {
  const yearStr = new Date().getFullYear().toString().slice(-2);
  const subjChar = subject ? subject.charAt(0).toUpperCase() : 'X';
  const gCode = grade || '11';
  return `${yearStr}${subjChar}${gCode}-`;
};

// --- HELPER 2: Query DB for next Sequence Number ---
export const getNextSequenceNumber = async (prefix: string) => {
  const { data, error } = await supabase
    .from('mcqs')
    .select('question_code')
    .ilike('question_code', `${prefix}%`);

  if (error) {
    console.error("Error fetching sequence:", error);
    return 0;
  }

  let maxSuffix = 0;
  if (data && data.length > 0) {
    for (const item of data) {
      const code = item.question_code || '';
      const suffixStr = code.slice(prefix.length);
      const suffixNum = parseInt(suffixStr, 10);
      if (!isNaN(suffixNum) && suffixNum > maxSuffix) {
        maxSuffix = suffixNum;
      }
    }
  }
  return maxSuffix;
};

// --- HELPER 3: Duplicate Check ---
export const checkDuplicate = async (questionText: string, optionsArr: string[]) => {
  if (questionText && questionText.trim().length > 0) {
    const { data } = await supabase
      .from('mcqs')
      .select('id, question, options')
      .ilike('question', questionText.trim())
      .limit(1);
    if (data && data.length > 0) return data[0];
  }

  const validOptions = optionsArr.filter(o => o && o.trim().length > 0);
  if (validOptions.length >= 2) {
    const { data } = await supabase
      .from('mcqs')
      .select('id, question, options')
      .contains('options', [validOptions[0], validOptions[1]])
      .limit(1);
    if (data && data.length > 0) return data[0];
  }
  return null;
};

// --- HELPER 4: Safe Image Renderer ---
export const SafeImage = ({ src, alt, className }: { src: string; alt: string; className?: string }) => {
  if (!src) return null;

  const lowerSrc = src.toLowerCase();
  const lowerAlt = (alt || '').toLowerCase();

  const isUnsupported =
    lowerSrc.includes('image/wmf') ||
    lowerSrc.includes('image/x-wmf') ||
    lowerSrc.includes('image/emf') ||
    lowerSrc.includes('octet-stream');

  const isLikelyFormula =
    isUnsupported ||
    lowerSrc.includes('.wmf') ||
    lowerSrc.includes('.emf') ||
    lowerSrc.includes('mathtype') ||
    lowerSrc.includes('equation') ||
    lowerSrc.includes('formula') ||
    lowerAlt.includes('formula') ||
    lowerAlt.includes('math') ||
    lowerAlt.includes('equation');

  if (isUnsupported) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gray-800 border border-gray-700 text-gray-400 rounded-lg ${className}`}
        title="MathType Formula (Will process on backend)"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1 opacity-50">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
          <path d="M9 10h6" /><path d="M12 7v6" />
        </svg>
        <span className="text-[9px] font-bold uppercase tracking-wider">Formula</span>
      </div>
    );
  }

  if (isLikelyFormula) {
    return (
      <div className="inline-block bg-white rounded-md p-1 shadow-sm" title={alt || 'Formula'}>
        <img src={src} alt={alt} className={className} style={{ backgroundColor: 'transparent' }} />
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} />;
};

interface MCQUploadProps {
  editingMcq?: MCQ | null;
  onFinished?: () => void;
}

const MCQUpload: React.FC<MCQUploadProps> = ({ editingMcq, onFinished }) => {
  const { addMCQ, updateMCQ } = useData();

  const [uploadMode, setUploadMode] = useState<'single' | 'bulk'>('single');

  // ── Core fields ──────────────────────────────────────────────────────────
  const [grade, setGrade] = useState('11');
  const [subject, setSubject] = useState('Physics');
  const [topic, setTopic] = useState('');
  const [subTopic, setSubTopic] = useState('');
  const [skillType, setSkillType] = useState<'Understanding' | 'Knowledge Based' | 'Application' | 'Analytical'>('Understanding');
  const [questionType, setQuestionType] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [question, setQuestion] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [correctAnswerIndex, setCorrectAnswerIndex] = useState<number | null>(null);
  const [explanation, setExplanation] = useState('');
  const [questionCode, setQuestionCode] = useState('');
  const [source, setSource] = useState('');
  const [remarks, setRemarks] = useState('');

  // ── Options ──────────────────────────────────────────────────────────────
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [optionImageFiles, setOptionImageFiles] = useState<(File | null)[]>([null, null, null, null]);
  const [optionImagePreviews, setOptionImagePreviews] = useState<(string | null)[]>([null, null, null, null]);

  // ── Question image ───────────────────────────────────────────────────────
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // ── Flags ────────────────────────────────────────────────────────────────
  const [isFlagged, setIsFlagged] = useState(false);
  const [flagReason, setFlagReason] = useState('');

  // ── Duplicate modal ──────────────────────────────────────────────────────
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);

  const questionImageInputRef = useRef<HTMLInputElement | null>(null);
  const optionImageInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Cleanup blob URLs ────────────────────────────────────────────────────
  const clearLocalPreviewUrls = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    optionImagePreviews.forEach((url) => {
      if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
  };

  const resetForm = () => {
    clearLocalPreviewUrls();
    setQuestion('');
    setOptions(['', '', '', '']);
    setCorrectAnswer('');
    setCorrectAnswerIndex(null);
    setExplanation('');
    setQuestionCode('');
    setSource('');
    setRemarks('');
    setPreviewUrl(null);
    setSelectedImage(null);
    setOptionImagePreviews([null, null, null, null]);
    setOptionImageFiles([null, null, null, null]);
    setIsFlagged(false);
    setFlagReason('');
    if (questionImageInputRef.current) questionImageInputRef.current.value = '';
    optionImageInputRefs.current.forEach((input) => { if (input) input.value = ''; });
  };

  // ── Populate form when editing ───────────────────────────────────────────
  useEffect(() => {
    if (editingMcq) {
      setUploadMode('single');
      setQuestion(editingMcq.question);
      setOptions(editingMcq.options || ['', '', '', '']);
      setCorrectAnswer(editingMcq.answer);
      setCorrectAnswerIndex(getCorrectOptionIndex(editingMcq));
      setExplanation(editingMcq.explanation || '');
      setGrade(editingMcq.grade || '11');
      setSubject(editingMcq.subject);
      setTopic(editingMcq.topic || '');
      setSubTopic(editingMcq.sub_topic || '');
      setSkillType((editingMcq.skill_type as any) || 'Understanding');
      setQuestionType(editingMcq.question_type || '');
      setDifficulty(editingMcq.difficulty || 'Medium');
      setQuestionCode(editingMcq.question_code || '');
      setSource((editingMcq as any).source || '');
      setRemarks((editingMcq as any).remarks || '');
      setPreviewUrl(editingMcq.imageUrl || null);

      const rawMcq = editingMcq as any;
      const rawOptionImages = rawMcq.option_images || rawMcq.optionImages || rawMcq.option_image || [null, null, null, null];
      const validOptionImages = Array.isArray(rawOptionImages) ? rawOptionImages : [null, null, null, null];
      setOptionImagePreviews(validOptionImages);
      setOptionImageFiles(new Array(validOptionImages.length).fill(null));
      setIsFlagged(editingMcq.isFlagged || false);
      setFlagReason(editingMcq.flagReason || '');
    }
  }, [editingMcq]);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
      optionImagePreviews.forEach((url) => {
        if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
      });
    };
  }, [previewUrl, optionImagePreviews]);

  // ── Option handlers ──────────────────────────────────────────────────────
  const handleAddOption = () => {
    setOptions([...options, '']);
    setOptionImageFiles([...optionImageFiles, null]);
    setOptionImagePreviews([...optionImagePreviews, null]);
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
    if (correctAnswerIndex !== null) {
      if (correctAnswerIndex === index) {
        setCorrectAnswerIndex(null);
        setCorrectAnswer('');
      } else if (correctAnswerIndex > index) {
        setCorrectAnswerIndex(correctAnswerIndex - 1);
      }
    }
    setOptionImageFiles(optionImageFiles.filter((_, i) => i !== index));
    setOptionImagePreviews(optionImagePreviews.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleOptionImageSelect = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const newFiles = [...optionImageFiles];
      newFiles[index] = file;
      setOptionImageFiles(newFiles);
      const newPreviews = [...optionImagePreviews];
      newPreviews[index] = URL.createObjectURL(file);
      setOptionImagePreviews(newPreviews);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const uploadFile = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('question-images').upload(fileName, file);
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from('question-images').getPublicUrl(fileName);
    return data.publicUrl;
  };

  // ── Validation & submit ──────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!question && !selectedImage) {
      alert("Please provide text or an image for the question.");
      return;
    }
    if (!grade.trim()) { alert("Please select the grade."); return; }
    if (!subject.trim()) { alert("Please select the subject."); return; }
    if (!topic.trim()) { alert("Please enter the topic."); return; }
    if (!subTopic.trim()) { alert("Please enter the sub-topic."); return; }
    if (!skillType.trim()) { alert("Please select the skill type."); return; }
    if (!difficulty.trim()) { alert("Please select the difficulty."); return; }

    const hasAtLeastTwoValidOptions = options.filter((opt, idx) => {
      const hasText = opt?.trim().length > 0;
      const hasImage = optionImageFiles[idx] !== null || optionImagePreviews[idx] !== null;
      return hasText || hasImage;
    }).length >= 2;

    if (!hasAtLeastTwoValidOptions) {
      alert("Please provide at least two valid options.");
      return;
    }
    if (correctAnswerIndex === null) {
      alert("Please select the correct option.");
      return;
    }

    const hasText = options[correctAnswerIndex]?.trim().length > 0;
    const hasImage = optionImageFiles[correctAnswerIndex] !== null || optionImagePreviews[correctAnswerIndex] !== null;
    if (!hasText && !hasImage) {
      alert(`Option ${correctAnswerIndex + 1} is selected as correct but is empty.`);
      return;
    }

    if (!editingMcq) {
      const dup = await checkDuplicate(question, options);
      if (dup) {
        setDuplicateWarning(dup);
        setDuplicateModalOpen(true);
        return;
      }
    }

    await executeSubmit();
  };

  const executeSubmit = async () => {
    try {
      let finalImageUrl = previewUrl;
      if (selectedImage) finalImageUrl = await uploadFile(selectedImage);

      const finalOptionImages = await Promise.all(
        options.map(async (_, idx) => {
          if (optionImageFiles[idx]) return await uploadFile(optionImageFiles[idx]!);
          return optionImagePreviews[idx] || null;
        })
      );

      let finalQuestionCode = questionCode;
      if (!finalQuestionCode) {
        const prefix = getQuestionPrefix(subject, grade);
        const currentMax = await getNextSequenceNumber(prefix);
        finalQuestionCode = `${prefix}${(currentMax + 1).toString().padStart(2, '0')}`;
      }

      const resolvedCorrectAnswer =
        correctAnswerIndex !== null ? (options[correctAnswerIndex] || '') : correctAnswer;

      const mcqData = {
        question,
        options,
        answer: resolvedCorrectAnswer,
        answer_index: correctAnswerIndex,
        explanation,
        grade,
        subject,
        topic,
        sub_topic: subTopic,
        skill_type: skillType,
        question_type: questionType || null,
        difficulty,
        question_code: finalQuestionCode,
        imageUrl: finalImageUrl,
        option_images: finalOptionImages,
        source: source || null,
        remarks: remarks || null,
        type: 'Multiple Choice' as "Multiple Choice",
        isFlagged,
        flagReason: isFlagged ? flagReason : '',
      };

      if (editingMcq) {
        await updateMCQ(editingMcq.id!, { ...mcqData, updatedAt: new Date().toISOString() } as any);
        alert("Updated successfully!");
      } else {
        await addMCQ({
          ...mcqData,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any);
        alert("Added to bank successfully!");
      }

      resetForm();
      onFinished?.();
    } catch (error) {
      console.error("Error saving MCQ:", error);
      alert("Failed to save. Check console for details.");
    }
  };

  // ── Shared input styles ──────────────────────────────────────────────────
  const inputCls = "w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:border-green-500 outline-none transition-colors text-white";
  const labelCls = "text-xs font-bold text-gray-500 uppercase tracking-wider ml-1";

  return (
    <div className="max-w-4xl mx-auto reveal-on-scroll text-white relative">

      {/* ── Duplicate Modal ─────────────────────────────────────────────── */}
      {duplicateModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-gray-900 border border-red-500/50 rounded-2xl p-6 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-red-500 mb-2 flex items-center gap-2">⚠️ Potential Duplicate Found</h3>
            <p className="text-gray-300 text-sm mb-4">A question with similar text or options already exists. Are you sure you want to add this?</p>
            <div className="bg-gray-800 p-4 rounded-xl text-sm text-gray-400 mb-6 italic border border-gray-700 max-h-32 overflow-y-auto">
              "{duplicateWarning?.question || 'Image-based question'}"
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setDuplicateModalOpen(false)} className="px-5 py-2 text-gray-300 hover:text-white border border-gray-700 rounded-xl transition">Cancel</button>
              <button type="button" onClick={() => { setDuplicateModalOpen(false); executeSubmit(); }} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition">Add Anyway</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-extrabold mb-2">
            {editingMcq ? 'Edit Question' : (uploadMode === 'bulk' ? 'Bulk Upload Panel' : 'MCQ Upload Panel')}
          </h2>
          <p className="text-gray-400 text-sm uppercase tracking-widest font-semibold">
            {editingMcq ? 'Modify existing repository item' : (uploadMode === 'bulk' ? 'Upload via .docx' : 'New Online Quiz Item')}
          </p>
        </div>
        {!editingMcq && (
          <div className="bg-gray-800 p-1 rounded-xl flex gap-1 shadow-inner">
            <button type="button" onClick={() => setUploadMode('single')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-300 ${uploadMode === 'single' ? 'bg-green-600 text-white shadow-md' : 'text-gray-300 hover:text-white hover:bg-gray-700'}`}>Single</button>
            <button type="button" onClick={() => setUploadMode('bulk')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-300 ${uploadMode === 'bulk' ? 'bg-green-600 text-white shadow-md' : 'text-gray-300 hover:text-white hover:bg-gray-700'}`}>Bulk (.docx)</button>
          </div>
        )}
      </div>

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gray-900/60 backdrop-blur-xl border border-gray-800 shadow-2xl">
        {uploadMode === 'bulk' && !editingMcq ? (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <BulkUploadDocx onDone={() => { setUploadMode('single'); if (onFinished) onFinished(); }} />
          </div>
        ) : (
          <div className="animate-in fade-in zoom-in-95 duration-300 p-8">
            <form className="space-y-6" onSubmit={handleSubmit}>

              {/* ── Row 1: Grade | Subject | Topic ──────────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className={labelCls}>Grade</label>
                  <select value={grade} onChange={(e) => setGrade(e.target.value)} className={inputCls}>
                    <option value="6">Grade 6</option>
                    <option value="7">Grade 7</option>
                    <option value="8">Grade 8</option>
                    <option value="9">Grade 9</option>
                    <option value="10">Grade 10</option>
                    <option value="11">Grade 11</option>
                    <option value="12">Grade 12</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className={labelCls}>Subject</label>
                  <select value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls}>
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Biology">Biology</option>
                    <option value="Mathematics">Mathematics</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className={labelCls}>Topic</label>
                  <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Thermodynamics" className={inputCls} />
                </div>
              </div>

              {/* ── Row 2: Sub-topic | Skill Type | Difficulty ──────────── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className={labelCls}>Sub-topic</label>
                  <input type="text" value={subTopic} onChange={(e) => setSubTopic(e.target.value)} placeholder="e.g. Carnot Engine" className={inputCls} />
                </div>
                <div className="space-y-2">
                  <label className={labelCls}>Skill Type</label>
                  <select value={skillType} onChange={(e) => setSkillType(e.target.value as any)} className={inputCls}>
                    <option value="Understanding">Understanding</option>
                    <option value="Knowledge Based">Knowledge Based</option>
                    <option value="Application">Application</option>
                    <option value="Analytical">Analytical</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className={labelCls}>Difficulty</label>
                  <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={inputCls}>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              {/* ── Row 3: Question Type | Question ID ──────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className={labelCls}>Question Type <span className="text-gray-600 normal-case font-normal">(Optional)</span></label>
                  <input
                    type="text"
                    value={questionType}
                    onChange={(e) => setQuestionType(e.target.value)}
                    placeholder="e.g. MCQ, Fill in the blanks......"
                    className={inputCls}
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelCls}>Question ID / Code <span className="text-gray-600 normal-case font-normal">(Optional)</span></label>
                  <input type="text" value={questionCode} onChange={(e) => setQuestionCode(e.target.value)} placeholder="e.g. 26P10-01 (Auto-generated if blank)" className={inputCls} />
                </div>
              </div>

              {/* ── Question Text ────────────────────────────────────────── */}
              <div className="space-y-2">
                <label className={labelCls}>Question Text</label>
                <textarea rows={4} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Type the question here..." className={`${inputCls} resize-none`} />
              </div>

              {/* ── Diagram / Image ──────────────────────────────────────── */}
              <div className="space-y-2 border border-dashed border-gray-700 p-5 rounded-2xl bg-gray-800/30">
                <label className={`${labelCls} block mb-2`}>Diagram / Image <span className="text-gray-600 normal-case font-normal">(Optional)</span></label>
                <input
                  ref={questionImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700 transition-colors cursor-pointer"
                />
                {previewUrl && (
                  <div className="mt-4 bg-gray-900 p-2 rounded-xl inline-block border border-gray-700">
                    <p className="text-xs text-gray-500 mb-2 font-semibold">Preview:</p>
                    <SafeImage src={previewUrl} alt="Preview" className="h-32 w-auto rounded object-contain" />
                  </div>
                )}
              </div>

              {/* ── Options ──────────────────────────────────────────────── */}
              <div className="space-y-4">
                <label className={`${labelCls} block`}>Options</label>
                <div className="grid gap-4">
                  {options.map((opt, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <span className="w-8 pt-3 text-xs font-bold text-green-500">{idx + 1}</span>
                      <textarea
                        rows={2}
                        value={opt}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        placeholder={`Option ${idx + 1} text...`}
                        className="flex-1 px-4 py-3 bg-gray-800 border border-gray-800 rounded-xl focus:border-green-500 outline-none resize-none transition-colors text-white"
                      />
                      <div className="relative shrink-0">
                        <input
                          ref={(el) => { optionImageInputRefs.current[idx] = el; }}
                          type="file"
                          accept="image/*"
                          id={`opt-img-${idx}`}
                          className="hidden"
                          onChange={(e) => handleOptionImageSelect(idx, e)}
                        />
                        <label htmlFor={`opt-img-${idx}`} className={`h-20 w-20 flex flex-col items-center justify-center rounded-xl cursor-pointer transition-all border border-dashed ${optionImagePreviews[idx] ? 'bg-gray-900 border-green-500' : 'bg-gray-800 border-gray-600 hover:border-gray-400 hover:bg-gray-700'}`}>
                          {optionImagePreviews[idx] ? (
                            <SafeImage src={optionImagePreviews[idx]!} alt="Opt" className="h-full w-full object-contain rounded-xl p-1" />
                          ) : (
                            <>
                              <PhotoIcon className="h-6 w-6 text-gray-400 mb-1" />
                              <span className="text-[9px] text-gray-500 font-bold uppercase">Img</span>
                            </>
                          )}
                        </label>
                      </div>
                      <button type="button" onClick={() => handleRemoveOption(idx)} className="p-2 pt-3 text-gray-600 hover:text-red-500 transition-colors">
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={handleAddOption} className="text-green-500 text-xs font-bold uppercase tracking-widest flex items-center gap-2 px-4 py-2 hover:bg-green-500/10 rounded-lg transition-colors w-max">
                  <PlusIcon className="h-4 w-4" /> Add Option
                </button>
              </div>

              {/* ── Correct Answer | Explanation ─────────────────────────── */}
              <div className="grid md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-2">
                  <label className={labelCls}>Correct Answer</label>
                  <select
                    value={correctAnswerIndex ?? ''}
                    onChange={(e) => {
                      const idx = e.target.value === '' ? null : Number(e.target.value);
                      setCorrectAnswerIndex(idx);
                      setCorrectAnswer(idx !== null ? (options[idx] || '') : '');
                    }}
                    className={inputCls}
                  >
                    <option value="">Select correct option</option>
                    {options.map((opt, idx) => (
                      <option key={idx} value={idx}>
                        {`Option ${idx + 1}${opt?.trim() ? ` — ${opt.slice(0, 60)}` : optionImagePreviews[idx] ? ' — [Image option]' : ''}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className={labelCls}>Explanation <span className="text-gray-600 normal-case font-normal">(Optional)</span></label>
                  <input type="text" value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Brief solution..." className={inputCls} />
                </div>
              </div>

              {/* ── Source | Remarks ─────────────────────────────────────── */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className={labelCls}>Source <span className="text-gray-600 normal-case font-normal">(Optional)</span></label>
                  <input
                    type="text"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="e.g. MTG, Web..."
                    className={inputCls}
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelCls}>Remarks <span className="text-gray-600 normal-case font-normal">(Optional)</span></label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Any internal notes..."
                    className={inputCls}
                  />
                </div>
              </div>

              {/* ── Flag for review ──────────────────────────────────────── */}
              <div className="pt-6 border-t border-gray-800 space-y-4">
                <label className="flex items-center gap-3 cursor-pointer group w-max">
                  <input type="checkbox" checked={isFlagged} onChange={(e) => setIsFlagged(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:bg-red-600 transition-all relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full shadow-inner"></div>
                  <span className="text-sm font-bold text-gray-300 group-hover:text-white flex items-center gap-2 transition-colors">
                    <FlagIcon className={`h-4 w-4 ${isFlagged ? 'text-red-500' : 'text-gray-600'}`} /> Flag for review
                  </span>
                </label>
                {isFlagged && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <textarea rows={2} value={flagReason} onChange={(e) => setFlagReason(e.target.value)} placeholder="Why is this flagged?" className={`${inputCls} border-red-900/30 focus:border-red-500 bg-red-900/10`} />
                  </div>
                )}
              </div>

              {/* ── Submit ───────────────────────────────────────────────── */}
              <div className="flex justify-end gap-4 pt-6 border-t border-gray-800">
                <button type="button" onClick={() => onFinished?.()} className="px-8 py-3 text-gray-400 font-bold uppercase tracking-widest text-sm hover:text-white hover:bg-gray-800 rounded-xl transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-10 py-4 font-bold uppercase tracking-widest text-sm rounded-xl transition-all shadow-lg active:scale-95 ${editingMcq ? 'bg-white text-black hover:bg-gray-200' : 'bg-green-600 text-white shadow-emerald-900/40 hover:bg-emerald-600'}`}
                >
                  {editingMcq ? 'Update Question' : 'Save to Bank'}
                </button>
              </div>

            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default MCQUpload;