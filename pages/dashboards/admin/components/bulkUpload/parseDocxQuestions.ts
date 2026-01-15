import mammoth from "mammoth";
import type { MCQ } from "../../../../../types";

// What we insert into Supabase
export type MCQInsert = Required<Pick<MCQ, "id" | "createdAt" | "updatedAt">> &
  Omit<MCQ, "id" | "createdAt" | "updatedAt">;

type ParsedResult = { rows: MCQInsert[]; errors: string[] };

const cleanKey = (raw: string) =>
  raw
    .replace(/\u00a0/g, " ")          // non-breaking spaces
    .trim()
    .replace(/^#/, "")
    .replace(/\*$/, "")
    .trim()
    .toLowerCase();

const textOf = (el: Element | null) =>
  (el?.textContent ?? "").replace(/\u00a0/g, " ").trim();

export async function parseDocxOneTablePerQuestion(file: File): Promise<ParsedResult> {
  const arrayBuffer = await file.arrayBuffer();

  // In browser Mammoth uses { arrayBuffer } [web:274][web:279]
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

  const doc = new DOMParser().parseFromString(html, "text/html");
  const tables = Array.from(doc.querySelectorAll("table"));

  const nowIso = () => new Date().toISOString();

  const errors: string[] = [];
  const rows: MCQInsert[] = [];

  tables.forEach((table, tableIndex) => {
    const trList = Array.from(table.querySelectorAll("tr"));

    const options: string[] = [];
    let correctIndex: number | null = null;

    const item: Partial<MCQInsert> = {
      id: crypto.randomUUID(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      type: "Multiple Choice",
      isFlagged: false,
      flagReason: "",
    };

    trList.forEach((tr) => {
      const cells = Array.from(tr.querySelectorAll("td,th"));
      if (cells.length < 2) return;

      const keyRaw = textOf(cells[0]);
      const valRaw = textOf(cells[1]);

      const key = cleanKey(keyRaw);

      // Map your Word template keys -> DB fields
      if (key === "grade") item.grade = valRaw;
      else if (key === "subject") item.subject = valRaw;
      else if (key === "topic") item.topic = valRaw;
      else if (key === "sub-topic" || key === "sub topic" || key === "sub_topic") item.sub_topic = valRaw;
      else if (key === "question type" || key === "question_type") item.question_type = valRaw;
      else if (key === "question difficulty" || key === "difficulty") item.difficulty = valRaw;
      else if (key === "question") item.question = valRaw;
      else if (key === "explanation") item.explanation = valRaw;
      else if (key === "question id/code" || key === "question id" || key === "question_code") item.question_code = valRaw;
      else if (key === "marks") item.marks = Number.isFinite(parseInt(valRaw)) ? parseInt(valRaw) : 4;
      else if (key.startsWith("option")) {
        // Handles: "Option 1", "Option 2", etc.
        const match = key.match(/option\s*(\d+)/i);
        if (match) {
          const idx = parseInt(match[1], 10) - 1;
          options[idx] = valRaw;
        }
      } else if (key === "key" || key === "answer key" || key === "correct option") {
        // In your template Key is 1..4
        const parsed = parseInt(valRaw, 10);
        if (Number.isFinite(parsed)) correctIndex = parsed - 1;
      }
    });

    // Normalize options array (remove undefined holes)
    const normalizedOptions = options.map((o) => (o ?? "").trim());

    // Basic validation
    const missing: string[] = [];
    if (!item.subject) missing.push("Subject");
    if (!item.question) missing.push("Question");
    if (normalizedOptions.filter(Boolean).length < 2) missing.push("Options (min 2)");

    if (missing.length) {
      errors.push(`Table ${tableIndex + 1}: Missing ${missing.join(", ")}`);
      return;
    }

    // Compute answer text from Key
    if (correctIndex == null || !normalizedOptions[correctIndex]) {
      errors.push(`Table ${tableIndex + 1}: Invalid/missing Key (correct option number).`);
      return;
    }

    const answer = normalizedOptions[correctIndex];

    // If you have option_images column already, keep it aligned with options count
    const option_images = normalizedOptions.map(() => null);

    rows.push({
      ...(item as MCQInsert),
      options: normalizedOptions,
      answer,
      option_images,
    });
  });

  if (tables.length === 0) {
    errors.push("No tables found in the document. Ensure it is a .docx with one table per question.");
  }

  return { rows, errors };
}
