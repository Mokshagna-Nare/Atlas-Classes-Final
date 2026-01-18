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

// Helper: Extract text AND image source from an element
const extractContent = (el: Element | null) => {
  if (!el) return { text: "", imageSrc: null };

  // 1. Try to find an image tag created by mammoth
  const img = el.querySelector("img");
  const imageSrc = img ? img.getAttribute("src") : null; // This will be "data:image/png;base64,..."

  // 2. Get text content (removing the img tag to clean it up, optional but cleaner)
  // We clone to not modify the original DOM if that matters, though here it's transient
  const clone = el.cloneNode(true) as Element;
  const cloneImg = clone.querySelector("img");
  if (cloneImg) cloneImg.remove();
  
  const text = (clone.textContent ?? "").replace(/\u00a0/g, " ").trim();

  return { text, imageSrc };
};

export async function parseDocxOneTablePerQuestion(file: File): Promise<ParsedResult> {
  const arrayBuffer = await file.arrayBuffer();

  // Convert to HTML using mammoth. 
  // Mammoth automatically converts images to base64 data URIs by default.
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

  const doc = new DOMParser().parseFromString(html, "text/html");
  const tables = Array.from(doc.querySelectorAll("table"));

  const nowIso = () => new Date().toISOString();

  const errors: string[] = [];
  const rows: MCQInsert[] = [];

  tables.forEach((table, tableIndex) => {
    const trList = Array.from(table.querySelectorAll("tr"));

    const options: string[] = [];
    const optionImages: (string | null)[] = []; // Store option images
    let correctIndex: number | null = null;

    const item: Partial<MCQInsert> = {
      id: crypto.randomUUID(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      type: "Multiple Choice",
      isFlagged: false,
      flagReason: "",
      imageUrl: null, // Default null
    };

    trList.forEach((tr) => {
      const cells = Array.from(tr.querySelectorAll("td,th"));
      if (cells.length < 2) return;

      // Column 1 is the Key (Text only)
      const keyRaw = (cells[0].textContent ?? "").trim();
      const key = cleanKey(keyRaw);

      // Column 2 is Value (Text + Potential Image)
      const { text: valRaw, imageSrc } = extractContent(cells[1]);

      // Map your Word template keys -> DB fields
      if (key === "grade") item.grade = valRaw;
      else if (key === "subject") item.subject = valRaw;
      else if (key === "topic") item.topic = valRaw;
      else if (key === "sub-topic" || key === "sub topic" || key === "sub_topic") item.sub_topic = valRaw;
      else if (key === "question type" || key === "question_type") item.question_type = valRaw;
      else if (key === "question difficulty" || key === "difficulty") item.difficulty = valRaw;
      
      else if (key === "question") {
        item.question = valRaw;
        if (imageSrc) item.imageUrl = imageSrc; // Capture question image
      }
      
      else if (key === "explanation") item.explanation = valRaw;
      else if (key === "question id/code" || key === "question id" || key === "question_code") item.question_code = valRaw;
      else if (key === "marks") item.marks = Number.isFinite(parseInt(valRaw)) ? parseInt(valRaw) : 4;
      
      else if (key.startsWith("option")) {
        // Handles: "Option 1", "Option 2", etc.
        const match = key.match(/option\s*(\d+)/i);
        if (match) {
          const idx = parseInt(match[1], 10) - 1;
          options[idx] = valRaw;
          optionImages[idx] = imageSrc || null; // Capture option image
        }
      } 
      
      else if (key === "key" || key === "answer key" || key === "correct option") {
        // In your template Key is 1..4
        const parsed = parseInt(valRaw, 10);
        if (Number.isFinite(parsed)) correctIndex = parsed - 1;
      }
    });

    // Normalize options array (fill holes)
    // We explicitly ensure there are 4 entries to match standard MCQs usually
    const normalizedOptions: string[] = [];
    const normalizedOptionImages: (string | null)[] = [];

    // Assuming max 4 options usually, but dynamic is fine too. 
    // Let's stick to the size of the found options or default to 4 empty ones
    const maxOptLength = Math.max(options.length, 4);
    
    for(let i=0; i<maxOptLength; i++) {
        normalizedOptions[i] = (options[i] ?? "").trim();
        normalizedOptionImages[i] = optionImages[i] ?? null;
    }

    // Basic validation
    const missing: string[] = [];
    if (!item.subject) missing.push("Subject");
    
    // Question text OR image must exist
    if (!item.question && !item.imageUrl) missing.push("Question Content");
    
    if (normalizedOptions.filter(Boolean).length < 2 && normalizedOptionImages.filter(Boolean).length < 2) {
         missing.push("Options (min 2 text or images)");
    }

    if (missing.length) {
      errors.push(`Table ${tableIndex + 1}: Missing ${missing.join(", ")}`);
      return;
    }

    // Compute answer text from Key
    if (correctIndex == null || correctIndex < 0 || correctIndex >= normalizedOptions.length) {
      errors.push(`Table ${tableIndex + 1}: Invalid/missing Key (correct option number).`);
      return;
    }

    const answer = normalizedOptions[correctIndex];

    rows.push({
      ...(item as MCQInsert),
      options: normalizedOptions,
      answer,
      option_images: normalizedOptionImages, // Pass the extracted images array
    });
  });

  if (tables.length === 0) {
    errors.push("No tables found in the document. Ensure it is a .docx with one table per question.");
  }

  return { rows, errors };
}
