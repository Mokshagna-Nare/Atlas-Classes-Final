import React, { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, FlagIcon, PhotoIcon } from '../../../../components/icons';
import { useData } from '../../../../contexts/DataContext';
import { MCQ } from '../../../../types';
import { supabase } from '../../../../services/supabase';

// ✅ Adjust this import path to wherever you created BulkUploadDocx.tsx
// Example (if BulkUploadDocx is in the same folder): import BulkUploadDocx from './BulkUploadDocx';
import BulkUploadDocx from './bulkUpload/BulkUploadDocx';

interface MCQUploadProps {
  editingMcq?: MCQ | null;
  onFinished?: () => void;
}

const MCQUpload: React.FC<MCQUploadProps> = ({ editingMcq, onFinished }) => {
  const { addMCQ, updateMCQ } = useData();

  // ✅ NEW: Toggle state
  const [uploadMode, setUploadMode] = useState<'single' | 'bulk'>('single');

  // --- State Variables (Single upload form) ---
  const [grade, setGrade] = useState('11');
  const [subject, setSubject] = useState('Physics');
  const [topic, setTopic] = useState('');
  const [subTopic, setSubTopic] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [questionType, setQuestionType] = useState('Analytical');
  const [marks, setMarks] = useState('4');
  const [question, setQuestion] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [explanation, setExplanation] = useState('');
  const [questionCode, setQuestionCode] = useState('');

  // --- Options State (Text & Images) ---
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [optionImageFiles, setOptionImageFiles] = useState<(File | null)[]>([null, null, null, null]);
  const [optionImagePreviews, setOptionImagePreviews] = useState<(string | null)[]>([null, null, null, null]);

  // --- Question Image State ---
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // --- Flagging ---
  const [isFlagged, setIsFlagged] = useState(false);
  const [flagReason, setFlagReason] = useState('');

  // --- Load Data if Editing ---
  useEffect(() => {
    if (editingMcq) {
      // Force single mode when editing
      setUploadMode('single');

      setQuestion(editingMcq.question);
      setOptions(editingMcq.options || ['', '', '', '']);
      setCorrectAnswer(editingMcq.answer);
      setExplanation(editingMcq.explanation || '');

      setGrade(editingMcq.grade || '11');
      setSubject(editingMcq.subject);
      setTopic(editingMcq.topic || '');
      setSubTopic(editingMcq.sub_topic || '');
      setQuestionType(editingMcq.question_type || 'Analytical');
      setDifficulty(editingMcq.difficulty || 'Medium');
      setMarks(editingMcq.marks?.toString?.() ?? '4');
      setQuestionCode(editingMcq.question_code || '');
      setPreviewUrl(editingMcq.imageUrl || null);

      const existingOptImages = (editingMcq as any).option_images || new Array((editingMcq.options || []).length || 4).fill(null);
      setOptionImagePreviews(existingOptImages);
      setOptionImageFiles(new Array(existingOptImages.length).fill(null));

      setIsFlagged(editingMcq.isFlagged || false);
      setFlagReason(editingMcq.flagReason || '');
    }
  }, [editingMcq]);

  // --- Handlers for Options ---
  const handleAddOption = () => {
    setOptions([...options, '']);
    setOptionImageFiles([...optionImageFiles, null]);
    setOptionImagePreviews([...optionImagePreviews, null]);
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
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

  // --- Main Image Handler ---
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  // --- Helper: Upload File to Supabase ---
  const uploadFile = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('question-images')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('question-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  // --- Submit Logic (Single Upload only) ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!question) {
      alert("Please fill in the question text.");
      return;
    }

    try {
      let finalImageUrl = previewUrl;
      if (selectedImage) {
        finalImageUrl = await uploadFile(selectedImage);
      }

      const finalOptionImages = await Promise.all(
        options.map(async (_, idx) => {
          if (optionImageFiles[idx]) return await uploadFile(optionImageFiles[idx]!);
          return optionImagePreviews[idx] || null;
        })
      );

      const mcqData = {
        question,
        options,
        answer: correctAnswer,
        explanation,
        grade,
        subject,
        topic,
        sub_topic: subTopic,
        question_type: questionType,
        difficulty,
        marks: parseInt(marks) || 4,
        question_code:
          questionCode ||
          `${new Date().getFullYear()}${subject.substring(0, 3).toUpperCase()}${Math.floor(Math.random() * 1000)}`,
        imageUrl: finalImageUrl,
        option_images: finalOptionImages,
        type: 'Multiple Choice' as "Multiple Choice" | "Short Answer" | "True/False",
        isFlagged,
        flagReason: isFlagged ? flagReason : ''
      };

      if (editingMcq) {
        await updateMCQ(editingMcq.id!, {
          ...mcqData,
          updatedAt: new Date().toISOString()
        } as any);
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

      onFinished?.();
    } catch (error) {
      console.error("Error saving MCQ:", error);
      alert("Failed to save. Check console for details.");
    }
  };

  // ✅ BULK mode UI
  if (!editingMcq && uploadMode === 'bulk') {
    return (
      <div className="max-w-4xl mx-auto reveal-on-scroll text-white">
        <div className="flex flex-col space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-extrabold mb-2">MCQ Upload Panel</h2>
              <p className="text-gray-400 text-sm uppercase tracking-widest font-semibold">Bulk Upload (.docx)</p>
            </div>

            <div className="bg-gray-800 p-1 rounded-xl flex gap-1">
              <button
                type="button"
                onClick={() => setUploadMode('single')}
                className="px-4 py-2 text-sm font-bold rounded-lg text-gray-300 hover:text-white"
              >
                Single
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('bulk')}
                className="px-4 py-2 text-sm font-bold rounded-lg bg-green-600 text-white"
              >
                Bulk
              </button>
            </div>
          </div>

          <BulkUploadDocx onDone={onFinished} />
        </div>
      </div>
    );
  }

  // ✅ SINGLE mode UI (your existing form)
  return (
    <div className="max-w-4xl mx-auto reveal-on-scroll text-white">
      <div className="flex flex-col space-y-6">

        {/* Header + toggle (toggle only when not editing) */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold mb-2">{editingMcq ? 'Edit Question' : 'MCQ Upload Panel'}</h2>
            <p className="text-gray-400 text-sm uppercase tracking-widest font-semibold">
              {editingMcq ? 'Modify existing repository item' : 'New Online Quiz Item'}
            </p>
          </div>

          {!editingMcq && (
            <div className="bg-gray-800 p-1 rounded-xl flex gap-1">
              <button
                type="button"
                onClick={() => setUploadMode('single')}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition ${
                  uploadMode === 'single' ? 'bg-green-600 text-white' : 'text-gray-300 hover:text-white'
                }`}
              >
                Single
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('bulk')}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition ${
                  uploadMode === 'bulk' ? 'bg-green-600 text-white' : 'text-gray-300 hover:text-white'
                }`}
              >
                Bulk (.docx)
              </button>
            </div>
          )}
        </div>

        <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 shadow-2xl">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* --- Row 1: Grade, Subject, Topic --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Grade</label>
                <select value={grade} onChange={(e) => setGrade(e.target.value)} className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:border-green-500 outline-none">
                  <option value="11">Grade 11</option>
                  <option value="12">Grade 12</option>
                  <option value="Dropper">Dropper</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Subject</label>
                <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:border-green-500 outline-none">
                  <option value="Physics">Physics</option>
                  <option value="Chemistry">Chemistry</option>
                  <option value="Biology">Biology</option>
                  <option value="Mathematics">Mathematics</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Topic</label>
                <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Thermodynamics" className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:border-green-500 outline-none" />
              </div>
            </div>

            {/* --- Row 2: Sub-topic, Q-Type, Difficulty --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Sub-topic</label>
                <input type="text" value={subTopic} onChange={(e) => setSubTopic(e.target.value)} placeholder="e.g. Carnot Engine" className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:border-green-500 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Question Type</label>
                <select value={questionType} onChange={(e) => setQuestionType(e.target.value)} className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:border-green-500 outline-none">
                  <option value="Analytical">Analytical</option>
                  <option value="Theoretical">Theoretical</option>
                  <option value="Numerical">Numerical</option>
                  <option value="Assertion-Reason">Assertion-Reason</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Difficulty</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:border-green-500 outline-none">
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
            </div>

            {/* --- Row 3: Question ID & Marks --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Question ID/Code (Optional)</label>
                <input type="text" value={questionCode} onChange={(e) => setQuestionCode(e.target.value)} placeholder="e.g. 2025B11" className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:border-green-500 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Marks</label>
                <input type="number" value={marks} onChange={(e) => setMarks(e.target.value)} className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:border-green-500 outline-none" />
              </div>
            </div>

            {/* --- Question Text --- */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Question Text</label>
              <textarea rows={4} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Type the question here..." className="w-full px-4 py-4 bg-gray-800 border border-gray-700 rounded-2xl focus:border-green-500 outline-none resize-none" />
            </div>

            {/* --- Image Upload (Question) --- */}
            <div className="space-y-2 border border-dashed border-gray-700 p-4 rounded-xl">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1 block mb-2">Diagram / Image (Optional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700"
              />
              {previewUrl && (
                <div className="mt-4">
                  <p className="text-xs text-gray-500 mb-1">Preview:</p>
                  <img src={previewUrl} alt="Preview" className="h-32 rounded border border-gray-600 object-contain" />
                </div>
              )}
            </div>

            {/* --- Options (Text + Image) --- */}
            <div className="space-y-4">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1 block">Options</label>
              <div className="grid gap-4">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <span className="w-8 pt-3 text-xs font-bold text-green-500">{idx + 1}</span>

                    <textarea
                      rows={2}
                      value={opt}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      placeholder={`Option ${idx + 1} text...`}
                      className="flex-1 px-4 py-3 bg-gray-800 border border-gray-800 rounded-xl focus:border-green-500 outline-none resize-none"
                    />

                    <div className="relative shrink-0">
                      <input
                        type="file"
                        accept="image/*"
                        id={`opt-img-${idx}`}
                        className="hidden"
                        onChange={(e) => handleOptionImageSelect(idx, e)}
                      />
                      <label
                        htmlFor={`opt-img-${idx}`}
                        className={`h-20 w-20 flex flex-col items-center justify-center rounded-xl cursor-pointer transition border border-dashed ${
                          optionImagePreviews[idx]
                            ? 'bg-gray-900 border-green-500'
                            : 'bg-gray-800 border-gray-600 hover:border-gray-400 hover:bg-gray-700'
                        }`}
                        title={optionImagePreviews[idx] ? 'Change Image' : 'Add Image'}
                      >
                        {optionImagePreviews[idx] ? (
                          <img
                            src={optionImagePreviews[idx]!}
                            alt="Opt"
                            className="h-full w-full object-contain rounded-xl p-1"
                          />
                        ) : (
                          <>
                            <PhotoIcon className="h-6 w-6 text-gray-400 mb-1" />
                            <span className="text-[9px] text-gray-500 font-bold uppercase">Img</span>
                          </>
                        )}
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="p-2 pt-3 text-gray-600 hover:text-red-500 transition"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddOption}
                className="text-green-500 text-xs font-bold uppercase tracking-widest flex items-center gap-2 px-4 py-2 hover:bg-green-500/10 rounded-lg"
              >
                <PlusIcon className="h-4 w-4" /> Add Option
              </button>
            </div>

            {/* --- Correct Answer & Explanation --- */}
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Correct Answer (Text)</label>
                <input type="text" value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} placeholder="Exact text of correct option" className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:border-green-500 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Explanation</label>
                <input type="text" value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Brief solution..." className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:border-green-500 outline-none" />
              </div>
            </div>

            {/* --- Flagging --- */}
            <div className="pt-6 border-t border-gray-800 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={isFlagged} onChange={(e) => setIsFlagged(e.target.checked)} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:bg-red-600 transition-all relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                <span className="text-sm font-bold text-gray-300 group-hover:text-white flex items-center gap-2">
                  <FlagIcon className={`h-4 w-4 ${isFlagged ? 'text-red-500' : 'text-gray-600'}`} /> Flag for review
                </span>
              </label>
              {isFlagged && (
                <textarea
                  rows={2}
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  placeholder="Why is this flagged?"
                  className="w-full px-4 py-3 bg-red-900/10 border border-red-900/30 rounded-xl focus:border-red-500 text-white"
                />
              )}
            </div>

            {/* --- Buttons --- */}
            <div className="flex justify-end gap-4 pt-6 border-t border-gray-800">
              <button type="button" onClick={() => onFinished?.()} className="px-8 py-3 text-gray-400 font-bold uppercase tracking-widest text-sm hover:text-white transition">Cancel</button>
              <button type="submit" className={`px-10 py-4 font-bold uppercase tracking-widest text-sm rounded-xl transition-all shadow-lg active:scale-95 ${editingMcq ? 'bg-white text-black' : 'bg-green-600 text-white shadow-emerald-900/40 hover:bg-emerald-600'}`}>
                {editingMcq ? 'Update Question' : 'Save to Bank'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default MCQUpload;
