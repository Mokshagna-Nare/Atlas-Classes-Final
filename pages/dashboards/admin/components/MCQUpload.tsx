import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../../../../contexts/DataContext';
import { MCQ } from '../../../../types';
import { supabase } from '../../../../services/supabase';
import BulkUploadDocx from './bulkUpload/BulkUploadDocx';
import { getCorrectOptionIndex } from '../../../../utils/mcqAnswer';
import { RichMathText, hasMathMarkers } from '../../../../utils/renderMath';
import SelectMenu from '../../../../components/ui/SelectMenu';
import SourcePicker from '../../../../components/ui/SourcePicker';
import { refreshQuestionSources } from '../../../../hooks/useQuestionSources';
import {
  Svg, ICONS, Card, Field, inputCls, textareaCls, primaryBtn, secondaryBtn, Toggle, Segmented, PageHeader, AdminModal,
} from '../../../../components/ui/admin';


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

const GRADE_OPTIONS = ['6', '7', '8', '9', '10', '11', '12'].map(g => ({ value: g, label: `Grade ${g}` }));
const SUBJECT_OPTIONS = ['Physics', 'Chemistry', 'Biology', 'Mathematics'].map(s => ({ value: s, label: s }));
const SKILL_OPTIONS = ['Understanding', 'Knowledge Based', 'Application', 'Analytical'].map(s => ({ value: s, label: s }));
const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard'].map(d => ({ value: d, label: d }));
const LETTERS = 'ABCDEFGHIJ';

type Notice = { tone: 'error' | 'success'; text: string } | null;

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

  // ── Duplicate modal / status ─────────────────────────────────────────────
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

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
    setRemarks('');
    setPreviewUrl(null);
    setSelectedImage(null);
    setOptionImagePreviews([null, null, null, null]);
    setOptionImageFiles([null, null, null, null]);
    setIsFlagged(false);
    setFlagReason('');
    if (questionImageInputRef.current) questionImageInputRef.current.value = '';
    optionImageInputRefs.current.forEach((input) => { if (input) input.value = ''; });
    // Grade, subject, topic, sub-topic, skill, difficulty and source stay, so a run of similar questions is quick to enter.
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
    if (correctAnswerIndex === index) setCorrectAnswer(value);
  };

  const markCorrect = (index: number) => {
    setCorrectAnswerIndex(index);
    setCorrectAnswer(options[index] || '');
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

  const clearOptionImage = (index: number) => {
    setOptionImageFiles(optionImageFiles.map((f, i) => (i === index ? null : f)));
    setOptionImagePreviews(optionImagePreviews.map((p, i) => (i === index ? null : p)));
    const input = optionImageInputRefs.current[index];
    if (input) input.value = '';
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const clearQuestionImage = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    if (questionImageInputRef.current) questionImageInputRef.current.value = '';
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
  const fail = (text: string) => setNotice({ tone: 'error', text });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);

    if (!question && !selectedImage && !previewUrl) return fail('Add the question text or an image.');
    if (!grade.trim()) return fail('Choose the grade.');
    if (!subject.trim()) return fail('Choose the subject.');
    if (!topic.trim()) return fail('Enter the topic.');
    if (!subTopic.trim()) return fail('Enter the sub-topic.');
    if (!skillType.trim()) return fail('Choose the skill type.');
    if (!difficulty.trim()) return fail('Choose the difficulty.');

    const hasAtLeastTwoValidOptions = options.filter((opt, idx) => {
      const hasText = opt?.trim().length > 0;
      const hasImage = optionImageFiles[idx] !== null || optionImagePreviews[idx] !== null;
      return hasText || hasImage;
    }).length >= 2;

    if (!hasAtLeastTwoValidOptions) return fail('Add at least two options.');
    if (correctAnswerIndex === null) return fail('Mark the correct option (click its letter).');

    const hasText = options[correctAnswerIndex]?.trim().length > 0;
    const hasImage = optionImageFiles[correctAnswerIndex] !== null || optionImagePreviews[correctAnswerIndex] !== null;
    if (!hasText && !hasImage) return fail(`Option ${LETTERS[correctAnswerIndex]} is marked correct but is empty.`);

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
    setSaving(true);
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
        source: source.trim() || null,
        remarks: remarks || null,
        type: 'Multiple Choice' as "Multiple Choice",
        isFlagged,
        flagReason: isFlagged ? flagReason : '',
      };

      if (editingMcq) {
        await updateMCQ(editingMcq.id!, { ...mcqData, updatedAt: new Date().toISOString() } as any);
      } else {
        await addMCQ({
          ...mcqData,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any);
      }
      refreshQuestionSources();

      if (editingMcq) {
        resetForm();
        onFinished?.();
      } else {
        resetForm();
        setNotice({ tone: 'success', text: `Saved as ${finalQuestionCode}. The form is ready for the next question.` });
      }
    } catch (error) {
      console.error("Error saving MCQ:", error);
      fail("Couldn't save the question. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const showPreview = hasMathMarkers(question) || /<\/?[a-z][\s\S]*?>/i.test(question);

  return (
    <div className="mx-auto max-w-5xl space-y-6 text-white">
      {/* ── Duplicate dialog ─────────────────────────────────────────────── */}
      {duplicateModalOpen && (
        <AdminModal
          title="This question may already exist"
          subtitle="A question with the same text or options is in the bank."
          icon={ICONS.warning}
          tone="amber"
          width="max-w-lg"
          onClose={() => setDuplicateModalOpen(false)}
          footer={
            <>
              <button type="button" onClick={() => setDuplicateModalOpen(false)} className={`${secondaryBtn} px-5 py-2.5 text-sm`}>Go back</button>
              <button type="button" onClick={() => { setDuplicateModalOpen(false); executeSubmit(); }} className={`${primaryBtn} px-5 py-2.5 text-sm`}>Save anyway</button>
            </>
          }
        >
          <div className="rounded-xl bg-black/30 p-4 text-sm text-gray-300 ring-1 ring-inset ring-white/10 max-h-40 overflow-y-auto">
            {duplicateWarning?.question ? <RichMathText text={duplicateWarning.question} /> : <span className="italic text-gray-500">Image-based question</span>}
          </div>
        </AdminModal>
      )}

      <PageHeader
        eyebrow={editingMcq ? 'Question Bank' : 'Content'}
        title={editingMcq ? 'Edit question' : uploadMode === 'bulk' ? 'Bulk upload' : 'Add a question'}
        subtitle={
          editingMcq
            ? `Changes apply everywhere this question is used${editingMcq.question_code ? ` · ${editingMcq.question_code}` : ''}.`
            : uploadMode === 'bulk' ? 'Import a .docx of question tables, review and edit each one, then add them to the bank.' : 'One question at a time, with live preview of formulas.'
        }
        aside={!editingMcq && (
          <Segmented<'single' | 'bulk'> value={uploadMode} onChange={setUploadMode} options={[{ value: 'single', label: 'Single' }, { value: 'bulk', label: 'Bulk (.docx)' }]} />
        )}
      />

      {uploadMode === 'bulk' && !editingMcq ? (
        <div key="bulk" className="animate-rise-in">
          <BulkUploadDocx onDone={() => { setUploadMode('single'); if (onFinished) onFinished(); }} />
        </div>
      ) : (
        <form key="single" className="space-y-6 animate-rise-in" onSubmit={handleSubmit}>
          {/* ── 1. Classification ───────────────────────────────────── */}
          <Card step={1} title="Classification" subtitle="Where this question sits in the bank." raised>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <Field label="Grade" required>
                <SelectMenu title="Grade" value={grade} onChange={setGrade} options={GRADE_OPTIONS} placeholder="Choose grade" />
              </Field>
              <Field label="Subject" required>
                <SelectMenu title="Subject" value={subject} onChange={setSubject} options={SUBJECT_OPTIONS} placeholder="Choose subject" />
              </Field>
              <Field label="Difficulty" required>
                <SelectMenu title="Difficulty" value={difficulty} onChange={setDifficulty} options={DIFFICULTY_OPTIONS} placeholder="Choose difficulty" />
              </Field>
              <Field label="Topic" required>
                <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Thermodynamics" className={inputCls} />
              </Field>
              <Field label="Sub-topic" required>
                <input type="text" value={subTopic} onChange={(e) => setSubTopic(e.target.value)} placeholder="e.g. Carnot engine" className={inputCls} />
              </Field>
              <Field label="Skill type" required>
                <SelectMenu title="Skill type" value={skillType} onChange={(v) => setSkillType(v as any)} options={SKILL_OPTIONS} placeholder="Choose skill" />
              </Field>
              <Field label="Question type" optional>
                <input type="text" value={questionType} onChange={(e) => setQuestionType(e.target.value)} placeholder="e.g. MCQ, Assertion–Reason" className={inputCls} />
              </Field>
              <Field label="Question code" hint={<span className="normal-case tracking-normal font-medium text-gray-600">auto if blank</span>}>
                <input type="text" value={questionCode} onChange={(e) => setQuestionCode(e.target.value)} placeholder={`${getQuestionPrefix(subject, grade)}01`} className={`${inputCls} font-mono`} />
              </Field>
              <Field label="Source" optional>
                <SourcePicker value={source} onChange={setSource} />
              </Field>
            </div>
          </Card>

          {/* ── 2. Question ─────────────────────────────────────────── */}
          <Card step={2} title="Question" subtitle="Formulas use [FRAC]a[SEP]b[/FRAC], [SUP]2[/SUP], [SUB]n[/SUB] and √(…).">
            <div className="space-y-5">
              <Field label="Question text" required>
                <textarea rows={4} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Type the question here…" className={textareaCls} />
              </Field>
              {showPreview && (
                <div className="rounded-xl bg-emerald-400/[0.04] p-4 ring-1 ring-inset ring-emerald-400/15 animate-fade-in">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400/80">Preview</p>
                  <RichMathText as="div" text={question} className="text-[15px] text-gray-100" />
                </div>
              )}

              <Field label="Diagram / image" optional>
                <input ref={questionImageInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" id="question-image" />
                {previewUrl ? (
                  <div className="flex items-start gap-4 rounded-xl bg-black/25 p-3 ring-1 ring-inset ring-white/10">
                    <div className="rounded-lg bg-white/[0.03] p-2"><SafeImage src={previewUrl} alt="Question diagram" className="h-32 w-auto rounded object-contain" /></div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="question-image" className={`${secondaryBtn} cursor-pointer px-4 py-2 text-xs`}>Replace</label>
                      <button type="button" onClick={clearQuestionImage} className={`${secondaryBtn} px-4 py-2 text-xs`}>Remove</button>
                    </div>
                  </div>
                ) : (
                  <label htmlFor="question-image" className="group flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-white/15 bg-black/15 px-5 py-5 transition hover:border-emerald-400/40 hover:bg-emerald-400/[0.03]">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.04] text-gray-400 ring-1 ring-inset ring-white/10 transition group-hover:text-emerald-300 group-hover:ring-emerald-400/30"><Svg d={ICONS.photo} className="h-5 w-5" /></span>
                    <span>
                      <span className="block text-sm font-semibold text-gray-200">Add a diagram</span>
                      <span className="block text-xs text-gray-500">PNG or JPG, shown above the options</span>
                    </span>
                  </label>
                )}
              </Field>
            </div>
          </Card>

          {/* ── 3. Options ──────────────────────────────────────────── */}
          <Card
            step={3}
            title="Options"
            subtitle="Click an option's letter to mark it correct."
            aside={correctAnswerIndex !== null && <span className="rounded-lg bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-300 ring-1 ring-inset ring-emerald-400/30">Answer: {LETTERS[correctAnswerIndex]}</span>}
          >
            <div className="space-y-3">
              {options.map((opt, idx) => {
                const isCorrect = correctAnswerIndex === idx;
                return (
                  <div
                    key={idx}
                    className={`group flex items-start gap-3 rounded-2xl p-3 ring-1 ring-inset transition-all duration-300 ${
                      isCorrect ? 'bg-emerald-400/[0.06] ring-emerald-400/40 shadow-[0_10px_30px_-18px_rgba(16,185,129,0.8)]' : 'bg-black/15 ring-white/[0.07] hover:ring-white/15'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => markCorrect(idx)}
                      title={isCorrect ? 'Correct answer' : 'Mark as correct'}
                      aria-pressed={isCorrect}
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black transition-all active:scale-95 ${
                        isCorrect ? 'bg-emerald-400 text-gray-950 shadow-[0_6px_20px_-6px_rgba(16,185,129,0.9)]' : 'bg-white/[0.05] text-gray-400 ring-1 ring-inset ring-white/10 hover:text-white hover:ring-emerald-400/40'
                      }`}
                    >
                      {isCorrect ? <Svg d={ICONS.check} className="h-5 w-5" /> : LETTERS[idx]}
                    </button>
                    <div className="min-w-0 flex-1 space-y-2">
                      <textarea
                        rows={2}
                        value={opt}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        placeholder={`Option ${LETTERS[idx]}`}
                        className={`${textareaCls} min-h-[44px]`}
                      />
                      {(hasMathMarkers(opt) || opt.includes('√')) && (
                        <div className="rounded-lg bg-black/20 px-3 py-1.5 text-sm text-gray-200"><RichMathText text={opt} /></div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-center gap-2">
                      <input
                        ref={(el) => { optionImageInputRefs.current[idx] = el; }}
                        type="file"
                        accept="image/*"
                        id={`opt-img-${idx}`}
                        className="hidden"
                        onChange={(e) => handleOptionImageSelect(idx, e)}
                      />
                      <label
                        htmlFor={`opt-img-${idx}`}
                        title={optionImagePreviews[idx] ? 'Replace image' : 'Add image'}
                        className={`relative flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-xl transition-all ${
                          optionImagePreviews[idx] ? 'bg-white/[0.03] ring-1 ring-emerald-400/40' : 'border border-dashed border-white/15 text-gray-500 hover:border-emerald-400/40 hover:text-emerald-300'
                        }`}
                      >
                        {optionImagePreviews[idx] ? <SafeImage src={optionImagePreviews[idx]!} alt={`Option ${LETTERS[idx]}`} className="h-full w-full object-contain p-1" /> : <Svg d={ICONS.photo} className="h-5 w-5" />}
                      </label>
                      {optionImagePreviews[idx] && (
                        <button type="button" onClick={() => clearOptionImage(idx)} className="text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-rose-300">Clear</button>
                      )}
                    </div>
                    <button type="button" onClick={() => handleRemoveOption(idx)} title="Remove option" aria-label={`Remove option ${LETTERS[idx]}`} className="mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-600 opacity-60 transition hover:bg-rose-500/10 hover:text-rose-300 group-hover:opacity-100">
                      <Svg d={ICONS.trash} />
                    </button>
                  </div>
                );
              })}
              <button type="button" onClick={handleAddOption} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-widest text-emerald-300 transition hover:bg-emerald-400/10">
                <Svg d={ICONS.plus} /> Add option
              </button>
            </div>
          </Card>

          {/* ── 4. Explanation & notes ──────────────────────────────── */}
          <Card step={4} title="Explanation & notes">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label="Explanation" optional className="md:col-span-2">
                <textarea rows={3} value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Brief worked solution…" className={textareaCls} />
              </Field>
              <Field label="Remarks" optional className="md:col-span-2">
                <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Internal notes (not shown to students)" className={inputCls} />
              </Field>
              <div className="md:col-span-2 space-y-3 border-t border-white/[0.06] pt-5">
                <Toggle checked={isFlagged} onChange={setIsFlagged} tone="rose" label={<span className="inline-flex items-center gap-2"><Svg d={ICONS.flag} className={`h-4 w-4 ${isFlagged ? 'text-rose-400' : 'text-gray-500'}`} /> Flag for review</span>} />
                {isFlagged && (
                  <textarea rows={2} value={flagReason} onChange={(e) => setFlagReason(e.target.value)} placeholder="What needs checking?" className={`${textareaCls} animate-fade-in ring-rose-400/30 focus:ring-rose-400/60`} />
                )}
              </div>
            </div>
          </Card>

          {/* ── Actions ─────────────────────────────────────────────── */}
          <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl bg-[#0b1118]/90 p-4 ring-1 ring-inset ring-white/10 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1" aria-live="polite">
              {notice ? (
                <p className={`flex items-start gap-2 text-sm font-semibold animate-fade-in ${notice.tone === 'error' ? 'text-rose-300' : 'text-emerald-300'}`}>
                  <Svg d={notice.tone === 'error' ? ICONS.warning : ICONS.check} className="mt-0.5 h-4 w-4 shrink-0" />
                  {notice.text}
                </p>
              ) : (
                <p className="text-sm text-gray-500">
                  {subject} · Grade {grade}{topic ? ` · ${topic}` : ''}{source ? ` · ${source}` : ''}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              {(editingMcq || onFinished) && (
                <button type="button" onClick={() => onFinished?.()} className={`${secondaryBtn} px-5 py-3 text-sm`}>Cancel</button>
              )}
              <button type="submit" disabled={saving} className={`${primaryBtn} px-7 py-3 text-sm`}>
                {saving ? <><span className="h-4 w-4 rounded-full border-2 border-gray-950/30 border-t-gray-950 animate-spin" /> Saving…</> : editingMcq ? 'Save changes' : 'Add to bank'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

export default MCQUpload;
