import type { MCQ } from "../../../../../types";
import { replacePlaceholdersWithImages } from "../../../../../utils/imagePlaceholder";

export type MCQInsert = Required<Pick<MCQ, "id" | "createdAt" | "updatedAt">> &
  Omit<MCQ, "id" | "createdAt" | "updatedAt">;

type ParsedResult = {
  rows: MCQInsert[];
  errors: string[];
};

const DOCX_PARSE_API = import.meta.env.VITE_DOCX_PARSE_API || "http://localhost:5001/parse-docx";

export { replacePlaceholdersWithImages };

const ensureFourStrings = (value: any): string[] => {
  const source = Array.isArray(value) ? value : [];
  const normalized = source.map((item) =>
    typeof item === "string" ? item : item == null ? "" : String(item)
  );
  while (normalized.length < 4) normalized.push("");
  return normalized.slice(0, 4);
};

const ensureFourNullableStrings = (value: any): (string | null)[] => {
  const source = Array.isArray(value) ? value : [];
  const normalized = source.map((item) => {
    if (typeof item === "string") return item;
    if (item == null) return null;
    return String(item);
  });
  while (normalized.length < 4) normalized.push(null);
  return normalized.slice(0, 4);
};

const ensureFourImageLists = (value: any): string[][] => {
  const source = Array.isArray(value) ? value : [];
  const normalized = source.map((item) => {
    if (!Array.isArray(item)) return [];
    return item
      .map((img) => (typeof img === "string" ? img : img == null ? "" : String(img)))
      .filter((img) => img.trim().length > 0);
  });
  while (normalized.length < 4) normalized.push([]);
  return normalized.slice(0, 4);
};

const ensureBooleanArray4 = (value: any): boolean[] => {
  const source = Array.isArray(value) ? value : [];
  const normalized = source.map((item) => Boolean(item));
  while (normalized.length < 4) normalized.push(false);
  return normalized.slice(0, 4);
};

const normalizeString = (value: any, fallback = ""): string => {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  return String(value);
};

const normalizeSkillType = (
  value: any
): "Understanding" | "Knowledge Based" | "Application" | "Analytical" | undefined => {
  const valid = ["Understanding", "Knowledge Based", "Application", "Analytical"];
  const str = normalizeString(value, "").trim();
  return valid.includes(str)
    ? (str as "Understanding" | "Knowledge Based" | "Application" | "Analytical")
    : undefined;
};

const normalizeAnswerIndex = (value: any): number | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  if (!Number.isInteger(num)) return undefined;
  if (num < 0 || num > 3) return undefined;
  return num;
};

export async function parseDocxOneTablePerQuestion(
  file: File
): Promise<ParsedResult> {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch(DOCX_PARSE_API, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      let message = `Parser service failed (${response.status})`;
      try {
        const err = await response.json();
        if (err?.detail) message = err.detail;
      } catch {}
      throw new Error(message);
    }

    const data = await response.json();
    const nowIso = () => new Date().toISOString();

    const rows: MCQInsert[] = (
      Array.isArray(data.rows) ? data.rows : []
    ).map((row: any) => {
      const options = ensureFourStrings(row.options);
      const answer_index = normalizeAnswerIndex(row.answer_index);
      let answer = normalizeString(row.answer, "").trim();
      if (!answer && answer_index !== undefined && options[answer_index]) {
        answer = options[answer_index];
      }

      const parser_meta = row?.parser_meta
        ? {
            unresolved_question_object: Boolean(
              row.parser_meta.unresolved_question_object
            ),
            unresolved_option_objects: ensureBooleanArray4(
              row.parser_meta.unresolved_option_objects
            ),
            unresolved_math_objects: Number.isFinite(
              Number(row.parser_meta.unresolved_math_objects)
            )
              ? Number(row.parser_meta.unresolved_math_objects)
              : 0,
            has_omml: Boolean(row.parser_meta.has_omml),
            option_has_omml: ensureBooleanArray4(
              row.parser_meta.option_has_omml
            ),
            warnings: Array.isArray(row.parser_meta.warnings)
              ? row.parser_meta.warnings.map((w: any) => String(w))
              : [],
          }
        : undefined;

      return {
        id: crypto.randomUUID(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
        type: "Multiple Choice",
        isFlagged: false,
        flagReason: "",

        grade: normalizeString(row.grade, ""),
        subject: normalizeString(row.subject, ""),
        topic: normalizeString(row.topic, ""),
        sub_topic: normalizeString(row.sub_topic, ""),
        skill_type: normalizeSkillType(row.skill_type),   // ← NEW
        question_type: normalizeString(row.question_type, ""),
        difficulty: normalizeString(row.difficulty, "Medium") || "Medium",
        marks: Number.isFinite(Number(row.marks)) ? Number(row.marks) : 4,
        question: normalizeString(row.question, ""),
        inline_images: Array.isArray(row.inline_images) ? row.inline_images : [],
        answer,
        answer_index,
        explanation: normalizeString(row.explanation, ""),
        question_code: normalizeString(row.question_code, ""),
        source: normalizeString(row.source, ""),
        remarks: normalizeString(row.remarks, ""),
        imageUrl:
          typeof row.imageUrl === "string" && row.imageUrl.trim().length > 0
            ? row.imageUrl
            : undefined,
        options,
        option_images: ensureFourNullableStrings(row.option_images),
        option_inline_images: ensureFourImageLists(row.option_inline_images),
        parser_meta,
      };
    });

    return {
      rows,
      errors: Array.isArray(data.errors) ? data.errors : [],
    };
  } catch (error: any) {
    return {
      rows: [],
      errors: [error?.message || "Failed to parse document"],
    };
  }
}