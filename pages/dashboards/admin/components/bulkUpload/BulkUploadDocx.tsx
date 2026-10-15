import React, { useMemo, useState } from "react";
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
import { RichMathText, stripMathMarkers, hasMathMarkers } from "../../../../../utils/renderMath";
import SelectMenu from "../../../../../components/ui/SelectMenu";
import SourcePicker from "../../../../../components/ui/SourcePicker";
import { cleanSource, refreshQuestionSources } from "../../../../../hooks/useQuestionSources";
import {
  Svg, ICONS, Card, Field, inputCls, textareaCls, primaryBtn, secondaryBtn, dangerBtn, IconButton, Chip, AdminModal,
  SUBJECT_TONE, DIFFICULTY_TONE,
} from "../../../../../components/ui/admin";

type Props = { onDone?: () => void };

const LETTERS = "ABCD";
const GRADE_OPTIONS = ["6", "7", "8", "9", "10", "11", "12"].map(g => ({ value: g, label: `Grade ${g}` }));
const SUBJECT_OPTIONS = ["Physics", "Chemistry", "Biology", "Mathematics"].map(s => ({ value: s, label: s }));
const DIFFICULTY_OPTIONS = ["Easy", "Medium", "Hard"].map(d => ({ value: d, label: d }));
const SKILL_OPTIONS = [
  { value: "", label: "Not set" },
  ...["Understanding", "Knowledge Based", "Application", "Analytical"].map(s => ({ value: s, label: s })),
];

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

/** Index of the correct option, from answer_index or by matching the answer text. */
const correctIndexOf = (q: MCQInsert): number | null => {
  if (q.answer_index !== undefined && q.answer_index !== null) return q.answer_index;
  const options = normalizeOptions(q);
  const i = options.findIndex(o => hasText(o) && o === q.answer);
  return i >= 0 ? i : null;
};

/** What a reviewer should look at before uploading this question. */
const issuesOf = (q: MCQInsert): string[] => {
  const issues: string[] = [];
  if (correctIndexOf(q) === null) issues.push("No correct answer");
  if (hasUnresolvedMath(q)) issues.push("Formula not extracted");
  if (!hasText(q.subject)) issues.push("No subject");
  if (!hasText(q.topic)) issues.push("No topic");
  return issues;
};

const needsPreview = (text: string) => hasMathMarkers(text) || text.includes("√") || /<\/?[a-z][\s\S]*?>/i.test(text);

// ── Full question editor ─────────────────────────────────────────────────────
const EditQuestionModal: React.FC<{
  question: MCQInsert;
  index: number;
  total: number;
  onSave: (updated: MCQInsert, next: boolean) => void;
  onClose: () => void;
}> = ({ question, index, total, onSave, onClose }) => {
  const [q, setQ] = useState<MCQInsert>({ ...question, options: normalizeOptions(question) });
  const options = normalizeOptions(q);
  const correct = correctIndexOf(q);
  const set = <K extends keyof MCQInsert>(key: K, value: MCQInsert[K]) => setQ(prev => ({ ...prev, [key]: value }));

  const setOption = (i: number, val: string) => {
    const next = [...options];
    next[i] = val;
    setQ(prev => ({ ...prev, options: next, ...(correct === i ? { answer: val } : {}) }));
  };
  const markCorrect = (i: number) => setQ(prev => ({ ...prev, answer_index: i, answer: normalizeOptions(prev)[i] || "" }));

  const save = (next: boolean) => {
    const idx = correctIndexOf(q);
    onSave({ ...q, source: cleanSource(q.source), answer: idx !== null ? options[idx] : q.answer }, next);
  };

  const questionImages = getQuestionImages(q);

  return (
    <AdminModal
      title={`Edit question ${index + 1} of ${total}`}
      subtitle="Changes stay in this upload until you click Upload to bank."
      icon={ICONS.edit}
      width="max-w-4xl"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={`${secondaryBtn} px-5 py-2.5 text-sm`}>Cancel</button>
          {index < total - 1 ? (
            <>
              <button type="button" onClick={() => save(false)} className={`${secondaryBtn} px-5 py-2.5 text-sm`}>Save</button>
              <button type="button" onClick={() => save(true)} className={`${primaryBtn} px-5 py-2.5 text-sm`}>Save & next <Svg d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></button>
            </>
          ) : (
            <button type="button" onClick={() => save(false)} className={`${primaryBtn} px-5 py-2.5 text-sm`}>Save changes</button>
          )}
        </>
      }
    >
      <div className="space-y-6">
        {/* Classification */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Grade"><SelectMenu title="Grade" value={String(q.grade || "")} onChange={v => set("grade", v)} options={GRADE_OPTIONS} placeholder="Choose grade" /></Field>
          <Field label="Subject"><SelectMenu title="Subject" value={q.subject || ""} onChange={v => set("subject", v)} options={SUBJECT_OPTIONS} placeholder="Choose subject" /></Field>
          <Field label="Difficulty"><SelectMenu title="Difficulty" value={q.difficulty || ""} onChange={v => set("difficulty", v)} options={DIFFICULTY_OPTIONS} placeholder="Choose difficulty" /></Field>
          <Field label="Topic"><input className={inputCls} value={q.topic || ""} onChange={e => set("topic", e.target.value)} placeholder="e.g. Trigonometric functions" /></Field>
          <Field label="Sub-topic"><input className={inputCls} value={q.sub_topic || ""} onChange={e => set("sub_topic", e.target.value)} placeholder="e.g. Domain and range" /></Field>
          <Field label="Skill type"><SelectMenu title="Skill type" value={q.skill_type || ""} onChange={v => set("skill_type", (v || undefined) as any)} options={SKILL_OPTIONS} placeholder="Not set" /></Field>
          <Field label="Question type" optional><input className={inputCls} value={q.question_type || ""} onChange={e => set("question_type", e.target.value)} placeholder="e.g. MCQ" /></Field>
          <Field label="Question code" optional><input className={`${inputCls} font-mono`} value={q.question_code || ""} onChange={e => set("question_code", e.target.value)} placeholder="Auto if blank" /></Field>
          <Field label="Source" optional><SourcePicker value={q.source || ""} onChange={v => set("source", v)} /></Field>
        </section>

        {/* Question */}
        <section className="space-y-3 border-t border-white/[0.06] pt-5">
          <Field label="Question" hint={<span className="normal-case tracking-normal font-medium text-gray-600">[FRAC]a[SEP]b[/FRAC] · [SUP]2[/SUP] · [SUB]n[/SUB] · √(…)</span>}>
            <textarea rows={4} value={q.question || ""} onChange={e => set("question", e.target.value)} className={`${textareaCls} font-mono text-[13px]`} />
          </Field>
          {(needsPreview(q.question || "") || questionImages.length > 0) && (
            <div className="rounded-xl bg-emerald-400/[0.04] p-4 ring-1 ring-inset ring-emerald-400/15">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400/80">Preview</p>
              {hasText(q.question) && <RichMathText as="div" text={q.question || ""} className="text-[15px] text-gray-100" />}
              {questionImages.length > 0 && <McqImageList images={questionImages} alt="Question" className="mt-2 flex flex-wrap gap-2" />}
            </div>
          )}
        </section>

        {/* Options */}
        <section className="space-y-3 border-t border-white/[0.06] pt-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">Options <span className="normal-case tracking-normal font-medium text-gray-600">— click a letter to mark the correct one</span></p>
          {options.map((opt, i) => {
            const isCorrect = correct === i;
            const images = getOptionImages(q, i);
            return (
              <div key={i} className={`flex items-start gap-3 rounded-2xl p-3 ring-1 ring-inset transition-all duration-300 ${isCorrect ? "bg-emerald-400/[0.06] ring-emerald-400/40" : "bg-black/15 ring-white/[0.07]"}`}>
                <button
                  type="button"
                  onClick={() => markCorrect(i)}
                  aria-pressed={isCorrect}
                  title={isCorrect ? "Correct answer" : "Mark as correct"}
                  className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black transition-all active:scale-95 ${isCorrect ? "bg-emerald-400 text-gray-950 shadow-[0_6px_20px_-6px_rgba(16,185,129,0.9)]" : "bg-white/[0.05] text-gray-400 ring-1 ring-inset ring-white/10 hover:text-white hover:ring-emerald-400/40"}`}
                >
                  {isCorrect ? <Svg d={ICONS.check} className="h-5 w-5" /> : LETTERS[i]}
                </button>
                <div className="min-w-0 flex-1 space-y-2">
                  <input value={opt} onChange={e => setOption(i, e.target.value)} placeholder={`Option ${LETTERS[i]}`} className={`${inputCls} font-mono text-[13px]`} />
                  {(needsPreview(opt) || images.length > 0) && (
                    <div className="rounded-lg bg-black/20 px-3 py-1.5 text-sm text-gray-200">
                      {hasText(opt) && <RichMathText text={opt} />}
                      {images.length > 0 && <McqImageList images={images} alt={`Option ${LETTERS[i]}`} className="mt-1 flex flex-wrap gap-2" />}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {/* Notes */}
        <section className="grid grid-cols-1 gap-4 border-t border-white/[0.06] pt-5">
          <Field label="Explanation" optional><textarea rows={3} value={q.explanation || ""} onChange={e => set("explanation", e.target.value)} className={textareaCls} placeholder="Worked solution…" /></Field>
          <Field label="Remarks" optional><input value={(q as any).remarks || ""} onChange={e => setQ(prev => ({ ...prev, remarks: e.target.value } as MCQInsert))} className={inputCls} placeholder="Internal notes" /></Field>
        </section>
      </div>
    </AdminModal>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const BulkUploadDocx: React.FC<Props> = ({ onDone }) => {
  const [questions, setQuestions] = useState<MCQInsert[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadedIds, setUploadedIds] = useState<string[]>([]);
  const [undoLoading, setUndoLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateList, setDuplicateList] = useState<{ index: number; q: string }[]>([]);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [bulkSource, setBulkSource] = useState("");
  const [onlyIssues, setOnlyIssues] = useState(false);

  const issueCount = useMemo(() => questions.filter(q => issuesOf(q).length > 0).length, [questions]);
  const visible = useMemo(
    () => questions.map((q, idx) => ({ q, idx })).filter(({ q }) => !onlyIssues || issuesOf(q).length > 0),
    [questions, onlyIssues]
  );

  const handleParse = async (f: File) => {
    if (!f.name.toLowerCase().endsWith(".docx")) {
      setErrors(["Please choose a Word document (.docx)."]);
      return;
    }
    setLoading(true);
    setErrors([]);
    setUploadSuccess(false);
    setUploadedIds([]);
    setQuestions([]);
    setFileName(f.name);
    setStatusMessage("Reading your document…");

    try {
      const res = await parseDocxOneTablePerQuestion(f);
      const parseErrors = Array.isArray(res?.errors) ? res.errors : [];
      const rows = Array.isArray(res?.rows) ? res.rows : [];

      if (parseErrors.length > 0) setErrors(parseErrors);

      if (rows.length > 0) {
        const validQuestions = rows.filter((q) => isValidQuestion(q));
        const invalidCount = rows.length - validQuestions.length;

        if (invalidCount > 0) {
          setErrors((prev) => [...prev, `${invalidCount} table${invalidCount === 1 ? "" : "s"} skipped — not enough content for a question.`]);
        }
        if (validQuestions.length > 0) {
          setQuestions(validQuestions.map(q => ({ ...q, source: cleanSource(q.source) })));
        } else if (parseErrors.length === 0) {
          setErrors(["No questions were found in this document."]);
        }
      } else if (parseErrors.length === 0) {
        setErrors(["No questions were found in this document."]);
      }
    } catch (e: any) {
      setErrors([e?.message ?? "Failed to read the document."]);
    } finally {
      setLoading(false);
      setStatusMessage("");
    }
  };

  const handlePreUploadCheck = async () => {
    setLoading(true);
    setStatusMessage("Checking for duplicates…");
    const dups: { index: number; q: string }[] = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const questionImages = getQuestionImages(q);
      const duplicateLabel = hasText(q.question)
        ? stripMathMarkers(q.question)
        : questionImages.length > 0 ? "Image-based question"
        : "Math/object-based question";
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
    setStatusMessage("Preparing upload…");

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
        setStatusMessage(`Uploading ${imagesToUpload.length} image${imagesToUpload.length === 1 ? "" : "s"}…`);
        const unique = Array.from(new Set(imagesToUpload));
        const results = await Promise.all(
          unique.map(async (img) => ({ img, url: await uploadImageToSupabase(img) }))
        );
        results.forEach(({ img, url }) => { if (url) uploadedImageUrls.set(img, url); });
      }

      const processedQuestions: MCQInsert[] = [];

      for (let i = 0; i < finalQuestions.length; i++) {
        const q = finalQuestions[i];
        setStatusMessage(`Processing question ${i + 1} of ${finalQuestions.length}…`);

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
          source: cleanSource(q.source) || (null as any),
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

      setStatusMessage("Saving to the question bank…");
      const { error } = await supabase.from("mcqs").insert(processedQuestions);
      if (error) throw error;

      const insertedIds = processedQuestions.map((q) => q.id).filter(Boolean) as string[];
      setUploadedIds(insertedIds);
      setUploadSuccess(true);
      setQuestions([]);
      refreshQuestionSources();
    } catch (e: any) {
      console.error(e);
      setErrors([e?.message ?? "Upload failed."]);
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
      refreshQuestionSources();
    } catch (e: any) {
      setErrors([e?.message ?? "Undo failed."]);
    } finally {
      setUndoLoading(false);
    }
  };

  const handleReset = () => {
    setQuestions([]);
    setErrors([]);
    setUploadSuccess(false);
    setUploadedIds([]);
    setFileName("");
    setOnlyIssues(false);
  };

  const removeQuestion = (indexToRemove: number) => {
    setQuestions((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const updateQuestion = (idx: number, updated: MCQInsert) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? updated : q)));
  };

  const applySourceToAll = () => {
    const name = cleanSource(bulkSource);
    setQuestions(prev => prev.map(q => ({ ...q, source: name })));
  };

  const busyOverlay = loading && (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-2xl bg-[#0b1118]/85 backdrop-blur-sm animate-fade-in">
      <span className="h-11 w-11 rounded-full border-4 border-emerald-400/20 border-t-emerald-400 animate-spin" />
      <p className="text-sm font-semibold text-gray-200">{statusMessage || "Working…"}</p>
    </div>
  );

  // ── Success ────────────────────────────────────────────────────────────────
  if (uploadSuccess) {
    return (
      <Card icon={ICONS.check} title="Upload complete" subtitle={fileName}>
        <div className="flex flex-col items-center py-8 text-center animate-success-pop">
          <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-400/10 ring-1 ring-inset ring-emerald-400/40 shadow-[0_0_60px_-10px_rgba(16,185,129,0.7)]">
            <Svg d={ICONS.check} className="h-10 w-10 text-emerald-300" />
          </span>
          <h4 className="mt-5 text-2xl font-black tracking-tight">{uploadedIds.length} question{uploadedIds.length === 1 ? "" : "s"} added</h4>
          <p className="mt-1 text-sm text-gray-400">They're in the Question Bank now.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            {uploadedIds.length > 0 && (
              <button onClick={handleUndo} disabled={undoLoading} className={`${dangerBtn} px-5 py-3 text-sm`}>
                {undoLoading ? <><span className="h-4 w-4 rounded-full border-2 border-rose-300/30 border-t-rose-300 animate-spin" /> Undoing…</> : <><Svg d={ICONS.undo} /> Undo upload</>}
              </button>
            )}
            <button onClick={() => { handleReset(); onDone?.(); }} className={`${secondaryBtn} px-5 py-3 text-sm`}>Done</button>
            <button onClick={handleReset} className={`${primaryBtn} px-6 py-3 text-sm`}><Svg d={ICONS.upload} /> Upload another file</button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {editingIndex !== null && questions[editingIndex] && (
        <EditQuestionModal
          key={editingIndex}
          question={questions[editingIndex]}
          index={editingIndex}
          total={questions.length}
          onSave={(updated, next) => {
            updateQuestion(editingIndex, updated);
            setEditingIndex(next && editingIndex < questions.length - 1 ? editingIndex + 1 : null);
          }}
          onClose={() => setEditingIndex(null)}
        />
      )}

      {duplicateModalOpen && (
        <AdminModal
          title={`${duplicateList.length} question${duplicateList.length === 1 ? " is" : "s are"} already in the bank`}
          subtitle="Choose whether to skip them or upload everything."
          icon={ICONS.warning}
          tone="amber"
          onClose={() => setDuplicateModalOpen(false)}
          footer={
            <>
              <button onClick={() => setDuplicateModalOpen(false)} className={`${secondaryBtn} px-5 py-2.5 text-sm`}>Cancel</button>
              <button onClick={() => { setDuplicateModalOpen(false); handleUpload(false); }} className={`${secondaryBtn} px-5 py-2.5 text-sm`}>Upload all anyway</button>
              <button onClick={() => { setDuplicateModalOpen(false); handleUpload(true); }} className={`${primaryBtn} px-5 py-2.5 text-sm`}>Skip duplicates</button>
            </>
          }
        >
          <ul className="space-y-2">
            {duplicateList.map((d) => (
              <li key={d.index} className="flex gap-3 rounded-xl bg-black/25 p-3 text-sm ring-1 ring-inset ring-white/[0.07]">
                <span className="shrink-0 font-bold text-amber-300">#{d.index + 1}</span>
                <span className="line-clamp-2 text-gray-300">{d.q}</span>
              </li>
            ))}
          </ul>
        </AdminModal>
      )}

      {errors.length > 0 && (
        <div className="rounded-2xl bg-rose-500/[0.07] p-4 ring-1 ring-inset ring-rose-400/25 animate-fade-in">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-bold text-rose-300"><Svg d={ICONS.warning} /> Please check</p>
            <button type="button" onClick={() => setErrors([])} aria-label="Dismiss" className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-300/70 hover:bg-rose-500/10 hover:text-rose-200"><Svg d={ICONS.close} className="h-3.5 w-3.5" /></button>
          </div>
          <ul className="list-disc space-y-1 pl-6 text-sm text-rose-200/80">
            {errors.map((er, i) => <li key={i}>{er}</li>)}
          </ul>
        </div>
      )}

      {questions.length === 0 ? (
        /* ── Drop zone ─────────────────────────────────────────────────── */
        <Card step={1} title="Choose a document" subtitle="One table per question: grade, subject, topic, question, options, answer, source…">
          <div className="relative">
            {busyOverlay}
            <input type="file" accept=".docx" id="docx-upload" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleParse(f); e.target.value = ""; }} />
            <label
              htmlFor="docx-upload"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleParse(f); }}
              className={`group flex min-h-[300px] cursor-pointer flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all duration-300 ${
                dragOver ? "border-emerald-400/70 bg-emerald-400/[0.06] scale-[1.01]" : "border-white/10 bg-black/15 hover:border-emerald-400/40 hover:bg-emerald-400/[0.03]"
              }`}
            >
              <span className={`flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-b from-emerald-400/20 to-emerald-500/5 text-emerald-300 ring-1 ring-inset ring-emerald-400/30 shadow-[0_20px_50px_-20px_rgba(16,185,129,0.8)] transition-transform duration-500 ${dragOver ? "scale-110 -translate-y-1" : "group-hover:-translate-y-1"}`}>
                <Svg d={ICONS.upload} className="h-9 w-9" />
              </span>
              <span>
                <span className="block text-lg font-bold text-white">{dragOver ? "Drop it here" : "Drop a .docx here, or click to browse"}</span>
                <span className="mt-1 block text-sm text-gray-500">Text, images and Word/MathType equations are supported. You'll review every question before anything is saved.</span>
              </span>
            </label>
          </div>
        </Card>
      ) : (
        <>
          {/* ── Review toolbar ──────────────────────────────────────────── */}
          <Card
            step={2}
            title="Review & edit"
            subtitle={fileName}
            raised
            aside={
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="emerald">{questions.length} question{questions.length === 1 ? "" : "s"}</Chip>
                {issueCount > 0 ? (
                  <button type="button" onClick={() => setOnlyIssues(v => !v)} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset transition ${onlyIssues ? "bg-amber-400/20 text-amber-200 ring-amber-400/50" : "bg-amber-400/10 text-amber-300 ring-amber-400/25 hover:bg-amber-400/15"}`}>
                    <Svg d={ICONS.warning} className="h-3.5 w-3.5" /> {issueCount} need{issueCount === 1 ? "s" : ""} attention {onlyIssues ? "· show all" : ""}
                  </button>
                ) : (
                  <Chip tone="emerald"><Svg d={ICONS.check} className="h-3.5 w-3.5" /> All look complete</Chip>
                )}
              </div>
            }
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <Field label="Source for every question" className="flex-1">
                <SourcePicker value={bulkSource} onChange={setBulkSource} placeholder="Choose or add a source to apply to all" />
              </Field>
              <button type="button" onClick={applySourceToAll} disabled={!cleanSource(bulkSource)} className={`${secondaryBtn} h-11 px-5 text-sm`}>
                Apply to all {questions.length}
              </button>
            </div>
            <p className="mt-3 text-xs text-gray-500">Click <span className="font-semibold text-gray-300">Edit</span> on any question to fix its text, options, answer or details. Nothing is saved until you upload.</p>
          </Card>

          {/* ── Questions ───────────────────────────────────────────────── */}
          <div className="relative space-y-4">
            {busyOverlay}
            {visible.map(({ q, idx }, n) => {
              const questionImages = getQuestionImages(q);
              const options = normalizeOptions(q);
              const correct = correctIndexOf(q);
              const issues = issuesOf(q);
              const subjectKey = (q.subject || "").toLowerCase();
              const difficultyKey = (q.difficulty || "").toLowerCase();

              return (
                <article
                  key={q.id || idx}
                  style={{ animationDelay: `${Math.min(n, 12) * 40}ms` }}
                  className={`group relative rounded-2xl bg-gradient-to-b from-gray-900/80 to-gray-900/50 p-5 ring-1 ring-inset transition-all duration-300 animate-rise-in hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-28px_rgba(0,0,0,0.9)] ${
                    issues.length ? "ring-amber-400/25 hover:ring-amber-400/40" : "ring-white/[0.07] hover:ring-white/15"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-xs font-black text-gray-400 ring-1 ring-inset ring-white/10">{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap gap-1.5">
                        {q.grade && <Chip>Grade {q.grade}</Chip>}
                        {q.subject && <Chip tone={SUBJECT_TONE[subjectKey] ?? "gray"}>{q.subject}</Chip>}
                        {q.topic && <Chip tone="cyan" title={q.topic}>{q.topic}</Chip>}
                        {q.sub_topic && <Chip tone="teal" title={q.sub_topic}>{q.sub_topic}</Chip>}
                        {q.difficulty && <Chip tone={DIFFICULTY_TONE[difficultyKey] ?? "gray"}>{q.difficulty}</Chip>}
                        {q.skill_type && <Chip tone="violet">{q.skill_type}</Chip>}
                        {hasText(q.source) && <Chip tone="emerald"><Svg d={ICONS.book} className="h-3 w-3" /> {q.source}</Chip>}
                        {issues.map(issue => <Chip key={issue} tone="amber"><Svg d={ICONS.warning} className="h-3 w-3" /> {issue}</Chip>)}
                      </div>

                      <div className="mb-4">
                        {hasText(q.question) ? (
                          <RichMathText as="div" text={q.question} className="text-[15px] font-medium leading-relaxed text-gray-100" />
                        ) : q.parser_meta?.unresolved_question_object ? (
                          <p className="text-sm italic text-amber-300">The question's formula couldn't be extracted — open Edit to type it.</p>
                        ) : null}
                        {questionImages.length > 0 && <McqImageList images={questionImages} alt="Question" className="mt-2 flex flex-wrap gap-2" />}
                      </div>

                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {options.map((opt, i) => {
                          const isCorrect = correct === i;
                          const optionImages = getOptionImages(q, i);
                          const unresolved = q.parser_meta?.unresolved_option_objects?.[i];
                          if (!(hasText(opt) || optionImages.length > 0 || unresolved)) return null;
                          return (
                            <div key={i} className={`flex items-start gap-3 rounded-xl px-3.5 py-2.5 text-sm ring-1 ring-inset transition-colors ${isCorrect ? "bg-emerald-400/[0.07] text-emerald-100 ring-emerald-400/35" : "bg-black/20 text-gray-300 ring-white/[0.06]"}`}>
                              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${isCorrect ? "bg-emerald-400 text-gray-950" : "bg-white/[0.06] text-gray-500"}`}>
                                {isCorrect ? <Svg d={ICONS.check} className="h-3.5 w-3.5" /> : LETTERS[i]}
                              </span>
                              <div className="min-w-0 break-words">
                                {hasText(opt) ? <RichMathText text={opt} /> : unresolved ? <span className="text-xs italic text-amber-300">Formula not extracted</span> : null}
                                {optionImages.length > 0 && <McqImageList images={optionImages} alt={`Option ${LETTERS[i]}`} className="mt-1 flex flex-wrap gap-2" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-2">
                      <button type="button" onClick={() => setEditingIndex(idx)} className={`${secondaryBtn} h-9 px-3.5 text-xs`}>
                        <Svg d={ICONS.edit} className="h-3.5 w-3.5" /> Edit
                      </button>
                      <IconButton icon={ICONS.trash} label={`Remove question ${idx + 1}`} tone="danger" onClick={() => removeQuestion(idx)} />
                    </div>
                  </div>
                </article>
              );
            })}
            {visible.length === 0 && (
              <p className="rounded-2xl bg-black/20 py-10 text-center text-sm text-gray-500 ring-1 ring-inset ring-white/[0.06]">Nothing needs attention any more. <button onClick={() => setOnlyIssues(false)} className="font-semibold text-emerald-300 hover:text-emerald-200">Show all questions</button></p>
            )}
          </div>

          {/* ── Action bar ──────────────────────────────────────────────── */}
          <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl bg-[#0b1118]/90 p-4 ring-1 ring-inset ring-white/10 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-400">
              <span className="font-semibold text-white">{questions.length}</span> question{questions.length === 1 ? "" : "s"} ready
              {issueCount > 0 && <span className="text-amber-300"> · {issueCount} still need attention</span>}
            </p>
            <div className="flex gap-3">
              <button onClick={handleReset} disabled={loading} className={`${secondaryBtn} px-5 py-3 text-sm`}>Cancel</button>
              <button onClick={handlePreUploadCheck} disabled={loading} className={`${primaryBtn} px-7 py-3 text-sm`}>
                {loading ? <><span className="h-4 w-4 rounded-full border-2 border-gray-950/30 border-t-gray-950 animate-spin" /> Working…</> : <><Svg d={ICONS.upload} /> Upload to bank</>}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BulkUploadDocx;
