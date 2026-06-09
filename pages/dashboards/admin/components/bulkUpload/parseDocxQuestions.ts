import type { MCQ } from "../../../../../types";
import { replacePlaceholdersWithImages } from "../../../../../utils/imagePlaceholder";

export type MCQInsert = Required<Pick<MCQ, "id" | "createdAt" | "updatedAt">> &
  Omit<MCQ, "id" | "createdAt" | "updatedAt">;

type ParsedResult = {
  rows: MCQInsert[];
  errors: string[];
};

const DOCX_PARSE_API =
  import.meta.env.VITE_DOCX_PARSE_API || "http://localhost:5001/parse-docx";

export { replacePlaceholdersWithImages };

export async function parseDocxOneTablePerQuestion(file: File): Promise<ParsedResult> {
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
      } catch {
        // ignore json parse errors
      }

      throw new Error(message);
    }

    const data = await response.json();
    const nowIso = () => new Date().toISOString();

    const rows: MCQInsert[] = (Array.isArray(data.rows) ? data.rows : []).map((row: any) => {
      const options = Array.isArray(row.options) ? row.options : ["", "", "", ""];
      const answer_index = row.answer_index !== undefined && row.answer_index !== null ? row.answer_index : undefined;
      
      // Ensure answer is populated: use parser's answer if available, otherwise resolve from answer_index
      let answer = row.answer || "";
      if (!answer && answer_index !== undefined && options[answer_index]) {
        answer = options[answer_index];
      }

      return {
        id: crypto.randomUUID(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
        type: "Multiple Choice",
        isFlagged: false,
        flagReason: "",

        grade: row.grade || "",
        subject: row.subject || "",
        topic: row.topic || "",
        sub_topic: row.sub_topic || "",
        question_type: row.question_type || "",
        difficulty: row.difficulty || "Medium",
        marks: Number.isFinite(Number(row.marks)) ? Number(row.marks) : 4,
        question: row.question || "",
        inline_images: Array.isArray(row.inline_images) ? row.inline_images : [],
        answer,
        answer_index,
        explanation: row.explanation || "",
        question_code: row.question_code || "",

        imageUrl: row.imageUrl || undefined,
        options,
        option_images: Array.isArray(row.option_images)
          ? row.option_images
          : [null, null, null, null],
        option_inline_images: Array.isArray(row.option_inline_images)
          ? row.option_inline_images
          : [[], [], [], []],
      };
    });

    return {
      rows,
      errors: Array.isArray(data.errors) ? data.errors : [],
    };
  } catch (error: any) {
    console.error("Remote DOCX parser error:", error);

    return {
      rows: [],
      errors: [error?.message || "Failed to parse document"],
    };
  }
}