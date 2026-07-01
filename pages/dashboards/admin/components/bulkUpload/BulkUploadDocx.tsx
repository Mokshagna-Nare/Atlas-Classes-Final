import React, { useState } from "react";
import { supabase } from "../../../../../services/supabase";
import { parseDocxOneTablePerQuestion, MCQInsert } from "./parseDocxQuestions";
import {
  getQuestionPrefix,
  getNextSequenceNumber,
  checkDuplicate,
} from "../MCQUpload";
import {
  hasText,
  hasQuestionContent,
  validOptionCount,
  getQuestionImages,
  getOptionImages,
  McqImageList,
} from "../../../../../utils/mcqContent";
import { MathText, stripMathMarkers } from "../../../../../utils/renderMath";

type Props = { onDone?: () => void };

const THEME_COLOR = "#29A34A";

// ── Supabase image uploader ───────────────────────────────────────────────────
const uploadImageToSupabase = async (base64Data: string): Promise<string | null> => {
  if (!base64Data || !base64Data.startsWith("data:image")) return null;
  try {
    const res = await fetch(base64Data);
    const blob = await res.blob();
    const fileExt = blob.type.split("/")[1] || "png";
    const fileName = `bulk_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const { error } = await supabase.storage.from("question-images").upload(fileName, blob);
    if (error) throw error;
    const { data } = supabase.storage.from("question-images").getPublicUrl(fileName);
    return data.publicUrl;
  } catch (error) {
    console.error("Image upload failed:", error);
    return null;
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const normalizeOptionImages = (q: MCQInsert): (string | null)[] => {
  const source = Array.isArray(q.option_images) ? q.option_images : [];
  const normalized = source.map((img) =>
    typeof img === "string" ? img : img == null ? null : String(img)
  );
  while (normalized.length < 4) normalized.push(null);
  return normalized.slice(0, 4);
};

const normalizeOptions = (q: MCQInsert): string[] => {
  const source = Array.isArray(q.options) ? q.options : [];
  const normalized = source.map((opt) =>
    typeof opt === "string" ? opt : opt == null ? "" : String(opt)
  );
  while (normalized.length < 4) normalized.push("");
  return normalized.slice(0, 4);
};

const hasUnresolvedMath = (q: MCQInsert): boolean => {
  const meta = q.parser_meta;
  if (!meta) return false;
  return Boolean(
    meta.unresolved_question_object ||
    (Array.isArray(meta.unresolved_option_objects) && meta.unresolved_option_objects.some(Boolean))
  );
};

const isValidQuestion = (q: MCQInsert): boolean => {
  if (hasQuestionContent(q as any) && validOptionCount(q as any) >= 2) return true;
  const options = normalizeOptions(q);
  const fallbackOptionCount = [0, 1, 2, 3].filter((i) => {
    const hasNormal = hasText(options[i]) || getOptionImages(q, i).length > 0;
    const unresolved = Boolean(q.parser_meta?.unresolved_option_objects?.[i]);
    const omml = Boolean(q.parser_meta?.option_has_omml?.[i]);
    return hasNormal || unresolved || omml;
  }).length;
  const hasQuestionFallback =
    hasQuestionContent(q as any) ||
    Boolean(q.parser_meta?.unresolved_question_object) ||
    Boolean(q.parser_meta?.has_omml);
  return hasQuestionFallback && fallbackOptionCount >= 2;
};

// ── Edit Modal ────────────────────────────────────────────────────────────────
const EditQuestionModal: React.FC<{
  question: MCQInsert;
  index: number;
  onSave: (updated: MCQInsert) => void;
  onClose: () => void;
}> = ({ question, index, onSave, onClose }) => {
  const [q, setQ] = useState<MCQInsert>({ ...question });
  const options = normalizeOptions(q);

  const setOption = (i: number, val: string) => {
    const newOpts = [...options];
    newOpts[i] = val;
    setQ({ ...q, options: newOpts });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">Edit Question #{index + 1}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Preview of how it will render */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Live Preview</p>
            <p className="text-gray-200">
              <MathText text={q.question || ""} />
            </p>
          </div>

          {/* Question text - raw editable with markers visible */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Question <span className="text-gray-600 normal-case font-normal">(edit raw text — [SUP]/[SUB]/[FRAC] markers control formatting)</span>
            </label>
            <textarea
              rows={4}
              value={q.question || ""}
              onChange={(e) => setQ({ ...q, question: e.target.value })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white outline-none focus:border-green-500 resize-none font-mono text-sm"
            />
          </div>

          {/* Options */}
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                Option {i + 1} {q.answer_index === i ? "✓ Correct" : ""}
              </label>
              <div className="mb-1 px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-sm text-gray-300">
                <MathText text={options[i]} />
              </div>
              <input
                type="text"
                value={options[i]}
                onChange={(e) => setOption(i, e.target.value)}
                className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white outline-none focus:border-green-500 font-mono text-sm ${
                  q.answer_index === i ? "border-green-600" : "border-gray-700"
                }`}
              />
            </div>
          ))}

          {/* Correct answer */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Correct Answer</label>
            <select
              value={q.answer_index ?? ""}
              onChange={(e) => {
                const idx = e.target.value === "" ? undefined : Number(e.target.value);
                setQ({ ...q, answer_index: idx, answer: idx !== undefined ? normalizeOptions(q)[idx] || "" : "" });
              }}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white outline-none focus:border-green-500"
            >
              <option value="">Select correct option</option>
              {[0, 1, 2, 3].map((i) => (
                <option key={i} value={i}>
                  Option {i + 1}{options[i] ? ` — ${stripMathMarkers(options[i]).slice(0, 50)}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Explanation */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Explanation</label>
            <input
              type="text"
              value={q.explanation || ""}
              onChange={(e) => setQ({ ...q, explanation: e.target.value })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white outline-none focus:border-green-500"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-900 border-t border-gray-800 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2 border border-gray-700 text-gray-400 hover:text-white rounded-xl transition-colors">
            Cancel
          </button>
          <button
            onClick={() => { onSave(q); onClose(); }}
            className="px-6 py-2 text-white font-bold rounded-xl transition-colors"
            style={{ backgroundColor: THEME_COLOR }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const BulkUploadDocx: React.FC<Props> = ({ onDone }) => {
  const [questions, setQuestions] = useState<MCQInsert[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadedIds, setUploadedIds] = useState<string[]>([]);
  const [undoLoading, setUndoLoading] = useState(false);

  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateList, setDuplicateList] = useState<{ index: number; q: string }[]>([]);

  const [editingQuestion, setEditingQuestion] = useState<{ q: MCQInsert; idx: number } | null>(null);

  const handleParse = async (f: File) => {
    setLoading(true);
    setErrors([]);
    setUploadSuccess(false);
    setUploadedIds([]);
    setQuestions([]);
    setStatusMessage("Parsing document...");

    try {
      const res = await parseDocxOneTablePerQuestion(f);
      const parseErrors = Array.isArray(res?.errors) ? res.errors : [];
      const rows = Array.isArray(res?.rows) ? res.rows : [];

      if (parseErrors.length > 0) setErrors(parseErrors);

      if (rows.length > 0) {
        const validQuestions = rows.filter((q) => isValidQuestion(q));
        const invalidCount = rows.length - validQuestions.length;

        const unresolvedWarnings = validQuestions
          .filter((q) => hasUnresolvedMath(q))
          .map((_, idx) => `Question ${idx + 1}: Math/object content could not be extracted. Verify preview before upload.`);

        if (invalidCount > 0) {
          setErrors((prev) => [
            ...prev,
            `${invalidCount} question(s) skipped — insufficient content.`,
          ]);
        }
        if (unresolvedWarnings.length > 0) {
          setErrors((prev) => [...prev, ...unresolvedWarnings]);
        }
        if (validQuestions.length > 0) {
          setQuestions(validQuestions);
        } else if (parseErrors.length === 0) {
          setErrors(["No valid questions found in the document."]);
        }
      } else if (parseErrors.length === 0) {
        setErrors(["No valid questions found in the document."]);
      }
    } catch (e: any) {
      setErrors([e?.message ?? "Failed to parse document"]);
    } finally {
      setLoading(false);
      setStatusMessage("");
    }
  };

  const handlePreUploadCheck = async () => {
    setLoading(true);
    setStatusMessage("Checking for duplicate questions...");
    const dups: { index: number; q: string }[] = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const questionImages = getQuestionImages(q);
      const duplicateLabel = hasText(q.question)
        ? stripMathMarkers(q.question)
        : questionImages.length > 0 ? "Image-based question"
        : "Math/object-based question";
      // Strip markers before duplicate-check against DB (DB also stores markers, so compare raw)
      const isDup = await checkDuplicate(q.question || "", normalizeOptions(q));
      if (isDup) dups.push({ index: i, q: duplicateLabel });
    }

    setLoading(false);
    if (dups.length > 0) {
      setDuplicateList(dups);
      setDuplicateModalOpen(true);
    } else {
      handleUpload(false);
    }
  };

  const handleUpload = async (skipDuplicates: boolean) => {
    if (!questions.length) return;
    setLoading(true);
    setErrors([]);
    setStatusMessage("Preparing upload...");

    try {
      const finalQuestions = skipDuplicates
        ? questions.filter((_, i) => !duplicateList.find((d) => d.index === i))
        : questions;

      if (finalQuestions.length === 0) {
        setErrors(["No questions left to upload after skipping duplicates."]);
        setLoading(false);
        return;
      }

      const prefixTrackers: Record<string, number> = {};
      const uniquePrefixes = new Set<string>();
      for (const q of finalQuestions) {
        const rawCode = q.question_code?.trim().toLowerCase();
        if (!rawCode || rawCode === "no code") {
          uniquePrefixes.add(getQuestionPrefix(q.subject || "X", q.grade || "11"));
        }
      }

      if (uniquePrefixes.size > 0) {
        const results = await Promise.all(
          Array.from(uniquePrefixes).map(async (prefix) => ({
            prefix,
            num: await getNextSequenceNumber(prefix),
          }))
        );
        results.forEach(({ prefix, num }) => { prefixTrackers[prefix] = num; });
      }

      const imagesToUpload: string[] = [];
      finalQuestions.forEach((q) => {
        getQuestionImages(q).forEach((img) => { if (img?.startsWith("data:image")) imagesToUpload.push(img); });
        for (let i = 0; i < 4; i++) {
          getOptionImages(q, i).forEach((img) => { if (img?.startsWith("data:image")) imagesToUpload.push(img); });
        }
      });

      const uploadedImageUrls = new Map<string, string>();
      if (imagesToUpload.length > 0) {
        const unique = Array.from(new Set(imagesToUpload));
        const results = await Promise.all(
          unique.map(async (img) => ({ img, url: await uploadImageToSupabase(img) }))
        );
        results.forEach(({ img, url }) => { if (url) uploadedImageUrls.set(img, url); });
      }

      const processedQuestions: MCQInsert[] = [];

      for (let i = 0; i < finalQuestions.length; i++) {
        const q = finalQuestions[i];
        setStatusMessage(`Processing question ${i + 1}/${finalQuestions.length}...`);

        const normalizedOptions = normalizeOptions(q);
        const currentOptImages = normalizeOptionImages(q);
        const currentInlineImages = Array.isArray(q.inline_images) ? q.inline_images : [];
        const currentOptionInlineImages = Array.isArray(q.option_inline_images)
          ? q.option_inline_images.map((entry) =>
              Array.isArray(entry) ? entry.map((img) => typeof img === "string" ? img : String(img)).filter(Boolean) : []
            )
          : [[], [], [], []];
        while (currentOptionInlineImages.length < 4) currentOptionInlineImages.push([]);

        const resolveImg = (img: string | null | undefined) =>
          img && img.startsWith("data:image") ? uploadedImageUrls.get(img) || img : img;

        const rawCode = q.question_code?.trim().toLowerCase();
        let finalCode = q.question_code;
        if (!rawCode || rawCode === "no code") {
          const prefix = getQuestionPrefix(q.subject || "X", q.grade || "11");
          prefixTrackers[prefix] = (prefixTrackers[prefix] || 0) + 1;
          finalCode = `${prefix}${prefixTrackers[prefix].toString().padStart(2, "0")}`;
        }

        let finalAnswer = q.answer || "";
        if (!finalAnswer && q.answer_index !== undefined && q.answer_index !== null && normalizedOptions[q.answer_index]) {
          finalAnswer = normalizedOptions[q.answer_index];
        }

        processedQuestions.push({
          ...q,
          question_code: finalCode,
          imageUrl: resolveImg(q.imageUrl) ?? undefined,
          inline_images: currentInlineImages.map((img) => resolveImg(img) || img),
          options: normalizedOptions,
          option_images: currentOptImages.map((img) => resolveImg(img) ?? null),
          option_inline_images: currentOptionInlineImages.slice(0, 4).map((group) =>
            group.map((img) => resolveImg(img) || img)
          ),
          answer: finalAnswer,
          answer_index: q.answer_index ?? undefined,
        });
      }

      setStatusMessage("Saving to database...");
      const { error } = await supabase.from("mcqs").insert(processedQuestions);
      if (error) throw error;

      const insertedIds = processedQuestions.map((q) => q.id).filter(Boolean) as string[];
      setUploadedIds(insertedIds);
      setUploadSuccess(true);
      setQuestions([]);
    } catch (e: any) {
      console.error(e);
      setErrors([e?.message ?? "Bulk insert failed"]);
    } finally {
      setLoading(false);
      setStatusMessage("");
    }
  };

  const handleUndo = async () => {
    if (!uploadedIds.length) return;
    setUndoLoading(true);
    try {
      const { error } = await supabase.from("mcqs").delete().in("id", uploadedIds);
      if (error) throw error;
      setUploadedIds([]);
      setUploadSuccess(false);
      setErrors([]);
      setQuestions([]);
    } catch (e: any) {
      setErrors([e?.message ?? "Undo failed"]);
    } finally {
      setUndoLoading(false);
    }
  };

  const handleReset = () => {
    setQuestions([]);
    setErrors([]);
    setUploadSuccess(false);
    setUploadedIds([]);
  };

  const removeQuestion = (indexToRemove: number) => {
    setQuestions((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const updateQuestion = (idx: number, updated: MCQInsert) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? updated : q)));
  };

  return (
    <div className="p-8 flex flex-col h-[700px] text-white relative">

      {/* ── Edit Modal ──────────────────────────────────────────────────── */}
      {editingQuestion && (
        <EditQuestionModal
          question={editingQuestion.q}
          index={editingQuestion.idx}
          onSave={(updated) => updateQuestion(editingQuestion.idx, updated)}
          onClose={() => setEditingQuestion(null)}
        />
      )}

      {/* ── Duplicate Modal ──────────────────────────────────────────────── */}
      {duplicateModalOpen && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 p-6 rounded-3xl backdrop-blur-md animate-in zoom-in-95 duration-200">
          <div className="w-full max-w-2xl flex flex-col border border-orange-500/30 rounded-2xl p-6 bg-gray-900 shadow-2xl">
            <h3 className="text-2xl font-bold text-orange-500 mb-2">⚠️ {duplicateList.length} Duplicates Detected</h3>
            <p className="text-gray-300 mb-4 text-sm">The following questions already exist in your database:</p>
            <div className="flex-1 overflow-y-auto bg-gray-800 rounded-xl p-4 mb-6 space-y-3 custom-scrollbar border border-gray-700 max-h-64">
              {duplicateList.map((d, i) => (
                <div key={i} className="text-sm text-gray-300 bg-gray-900 p-3 rounded-lg border border-gray-700">
                  <span className="font-bold text-orange-400 mr-2">Question #{d.index + 1}:</span>
                  <span className="opacity-90">{d.q}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 shrink-0 pt-4 border-t border-gray-800">
              <button onClick={() => setDuplicateModalOpen(false)} className="px-5 py-3 text-gray-400 hover:text-white border border-gray-700 hover:bg-gray-800 rounded-xl transition-colors">Cancel Upload</button>
              <button onClick={() => { setDuplicateModalOpen(false); handleUpload(true); }} className="px-5 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors">Skip Duplicates & Upload Rest</button>
              <button onClick={() => { setDuplicateModalOpen(false); handleUpload(false); }} className="px-5 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-lg transition-all">Upload All Anyway</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Errors ──────────────────────────────────────────────────────── */}
      {errors.length > 0 && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 overflow-y-auto max-h-32 animate-in fade-in">
          <p className="font-bold text-red-400 mb-2 flex items-center gap-2">⚠️ Errors Detected</p>
          <ul className="list-disc list-inside text-sm text-red-300 space-y-1">
            {errors.map((er, i) => <li key={i}>{er}</li>)}
          </ul>
        </div>
      )}

      {/* ── Upload Success ───────────────────────────────────────────────── */}
      {uploadSuccess ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4 animate-in zoom-in-95 duration-500">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center border shadow-lg"
            style={{ backgroundColor: `${THEME_COLOR}20`, borderColor: `${THEME_COLOR}50`, color: THEME_COLOR }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h4 className="text-2xl font-bold" style={{ color: THEME_COLOR }}>Upload Successful!</h4>
          <p className="text-gray-400">Your questions have been added to the bank.</p>

          {uploadedIds.length > 0 && (
            <button
              onClick={handleUndo}
              disabled={undoLoading}
              className="px-6 py-3 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors font-bold flex items-center gap-2 disabled:opacity-50"
            >
              {undoLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  Undoing...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7v6h6" /><path d="M3 13C5 7 10 3 16 3a9 9 0 0 1 9 9" />
                  </svg>
                  Undo Upload ({uploadedIds.length} questions)
                </>
              )}
            </button>
          )}

          <div className="flex gap-4 mt-2">
            <button onClick={() => { handleReset(); if (onDone) onDone(); }} className="px-8 py-3 rounded-xl border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 transition-colors font-medium">Return</button>
            <button onClick={handleReset} className="px-8 py-3 rounded-xl text-white font-bold shadow-lg hover:opacity-90 transition-opacity" style={{ backgroundColor: THEME_COLOR }}>Upload Another File</button>
          </div>
        </div>
      ) : (
        <>
          {/* ── File Drop Zone ─────────────────────────────────────────── */}
          {questions.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-700/60 rounded-2xl bg-gray-800/20 hover:bg-gray-800/50 transition-all duration-300 relative group cursor-pointer overflow-hidden">
              {loading && (
                <div className="absolute inset-0 bg-gray-900/90 backdrop-blur-sm flex flex-col items-center justify-center z-10 gap-3 animate-in fade-in">
                  <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: THEME_COLOR }} />
                  <p className="text-white font-bold tracking-wider uppercase text-sm animate-pulse">{statusMessage || "Processing..."}</p>
                </div>
              )}
              <input type="file" accept=".docx" id="docx-upload" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleParse(f); }} className="hidden" />
              <label htmlFor="docx-upload" className="flex flex-col items-center gap-4 p-10 w-full h-full justify-center cursor-pointer">
                <div className="p-5 bg-gray-800/80 rounded-full shadow-xl transition-transform duration-300 group-hover:scale-110">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={THEME_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div className="text-center space-y-2">
                  <p className="text-xl font-bold text-gray-200">Click to upload .docx</p>
                  <p className="text-sm text-gray-500 font-medium">Supports tables containing text, images & math equations</p>
                </div>
              </label>
            </div>
          )}

          {/* ── Question Preview List ──────────────────────────────────── */}
          {questions.length > 0 && (
            <div className="flex-1 flex flex-col overflow-hidden relative animate-in fade-in duration-500">
              {loading && (
                <div className="absolute inset-0 bg-gray-900/90 backdrop-blur-sm flex flex-col items-center justify-center z-20 gap-3 rounded-xl">
                  <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: THEME_COLOR }} />
                  <p className="text-white font-bold uppercase tracking-widest text-sm">{statusMessage || "Uploading..."}</p>
                </div>
              )}

              <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar pb-4">
                {questions.map((q, idx) => {
                  const questionImages = getQuestionImages(q);
                  const options = normalizeOptions(q);

                  return (
                    <div key={idx} className="bg-gray-800/80 border border-gray-700/50 rounded-2xl p-5 hover:border-gray-600 transition-colors">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">

                          {/* ── Tags row ──────────────────────────────── */}
                          <div className="flex gap-2 mb-3 flex-wrap">
                            <span className="text-xs font-mono text-gray-400 bg-gray-900 px-2.5 py-1 rounded-md">#{idx + 1}</span>
                            {q.grade && (
                              <span className="text-xs font-semibold text-gray-300 bg-gray-700/60 px-2.5 py-1 rounded-md border border-gray-600/40">
                                Grade {q.grade}
                              </span>
                            )}
                            {q.subject && (
                              <span className="text-xs font-semibold text-blue-400 bg-blue-900/20 px-2.5 py-1 rounded-md border border-blue-900/30">
                                {q.subject}
                              </span>
                            )}
                            {q.topic && (
                              <span className="text-xs font-semibold text-cyan-400 bg-cyan-900/20 px-2.5 py-1 rounded-md border border-cyan-900/30">
                                {q.topic}
                              </span>
                            )}
                            {q.sub_topic && (
                              <span className="text-xs font-semibold text-teal-400 bg-teal-900/20 px-2.5 py-1 rounded-md border border-teal-900/30">
                                {q.sub_topic}
                              </span>
                            )}
                            {q.skill_type && (
                              <span className="text-xs font-semibold text-violet-400 bg-violet-900/20 px-2.5 py-1 rounded-md border border-violet-900/30">
                                {q.skill_type}
                              </span>
                            )}
                            {q.question_type && (
                              <span className="text-xs font-semibold text-purple-400 bg-purple-900/20 px-2.5 py-1 rounded-md border border-purple-900/30">
                                {q.question_type}
                              </span>
                            )}
                            {q.difficulty && (
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${
                                q.difficulty === "Easy" ? "text-green-400 bg-green-900/20 border-green-900/30" :
                                q.difficulty === "Hard" ? "text-red-400 bg-red-900/20 border-red-900/30" :
                                "text-yellow-400 bg-yellow-900/20 border-yellow-900/30"
                              }`}>
                                {q.difficulty}
                              </span>
                            )}
                            {hasUnresolvedMath(q) && (
                              <span className="text-xs font-semibold text-yellow-300 bg-yellow-900/20 px-2.5 py-1 rounded-md border border-yellow-700/30">
                                ⚠ Math Unresolved
                              </span>
                            )}
                            {hasText((q as any).source) && (
                              <span className="text-xs font-semibold text-emerald-400 bg-emerald-900/20 px-2.5 py-1 rounded-md border border-emerald-900/30">
                                Source: {(q as any).source}
                              </span>
                            )}
                          </div>

                          {/* ── Question text ──────────────────────────── */}
                          <div className="mb-4">
                            {hasText(q.question) ? (
                              <p className="text-gray-200 font-medium leading-relaxed">
                                <MathText text={q.question} />
                              </p>
                            ) : q.parser_meta?.unresolved_question_object ? (
                              <p className="text-yellow-300 text-sm italic">⚠ Question math could not be extracted. Review carefully.</p>
                            ) : null}
                            {questionImages.length > 0 && (
                              <McqImageList images={questionImages} alt="Question" className="flex flex-wrap gap-2 mt-2" />
                            )}
                          </div>

                          {/* ── Options ───────────────────────────────── */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {options.map((opt, i) => {
                              const isCorrect = q.answer_index !== undefined && q.answer_index !== null
                                ? i === q.answer_index
                                : opt === q.answer;
                              const optionImages = getOptionImages(q, i);
                              const unresolved = q.parser_meta?.unresolved_option_objects?.[i];
                              const hasAny = hasText(opt) || optionImages.length > 0 || unresolved;
                              if (!hasAny) return null;

                              return (
                                <div
                                  key={i}
                                  className={`text-sm px-4 py-3 rounded-xl border flex flex-col gap-2 transition-colors ${
                                    isCorrect
                                      ? "bg-green-900/20 border-green-600/40 text-green-300"
                                      : "bg-gray-900/50 border-gray-700/80 text-gray-400"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 min-w-0">
                                      <span className="text-xs opacity-50 font-mono shrink-0 pt-0.5">{i + 1}.</span>
                                      <span className="break-words min-w-0">
                                        {hasText(opt) ? (
                                          <MathText text={opt} />
                                        ) : unresolved ? (
                                          <span className="italic text-xs text-yellow-300">(Math option — could not extract)</span>
                                        ) : (
                                          <span className="italic text-xs opacity-70">(Image option)</span>
                                        )}
                                      </span>
                                    </div>
                                    {isCorrect && (
                                      <span style={{ color: THEME_COLOR }} className="shrink-0 font-bold mt-0.5">✔</span>
                                    )}
                                  </div>
                                  {optionImages.length > 0 && (
                                    <McqImageList images={optionImages} alt={`Option ${i + 1}`} className="flex flex-wrap gap-2" />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                        </div>

                        {/* ── Action buttons ────────────────────────── */}
                        <div className="flex flex-col gap-2 shrink-0">
                          <button
                            onClick={() => setEditingQuestion({ q, idx })}
                            className="p-2.5 text-gray-500 hover:text-blue-400 hover:bg-blue-900/20 rounded-xl transition-all"
                            title="Edit this question"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => removeQuestion(idx)}
                            className="p-2.5 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-xl transition-all"
                            title="Remove this question"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Bottom bar ──────────────────────────────────────────── */}
              <div className="pt-5 border-t border-gray-800 flex justify-between items-center mt-2 shrink-0">
                <span className="text-sm text-gray-500 font-medium">{questions.length} question{questions.length !== 1 ? "s" : ""} ready</span>
                <div className="flex gap-4">
                  <button onClick={handleReset} className="px-6 py-3 rounded-xl border border-gray-700 text-gray-400 font-medium hover:text-white hover:bg-gray-800 transition-colors" disabled={loading}>
                    Cancel
                  </button>
                  <button
                    onClick={handlePreUploadCheck}
                    className="px-8 py-3 rounded-xl text-white font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-2 shadow-lg transition-transform active:scale-95"
                    style={{ backgroundColor: THEME_COLOR, boxShadow: `0 4px 14px 0 ${THEME_COLOR}40` }}
                    disabled={loading}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                    {loading ? "Processing..." : "Confirm & Upload"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BulkUploadDocx;