import mammoth from "mammoth";
import type { MCQ } from "../../../../../types";

// What we insert into Supabase
export type MCQInsert = Required<Pick<MCQ, "id" | "createdAt" | "updatedAt">> &
  Omit<MCQ, "id" | "createdAt" | "updatedAt">;

type ParsedResult = { rows: MCQInsert[]; errors: string[] };

const cleanKey = (raw: string) =>
  raw
    .replace(/\u00a0/g, " ")          
    .trim()
    .replace(/^#/, "")
    .replace(/\*$/, "")
    .trim()
    .toLowerCase();

// Helper: Extract text AND image source from an element
const extractContent = (el: Element | null) => {
  if (!el) return { text: "", imageSrc: null };

  const img = el.querySelector("img");
  const imageSrc = img ? img.getAttribute("src") : null; 

  const clone = el.cloneNode(true) as Element;
  const cloneImg = clone.querySelector("img");
  if (cloneImg) cloneImg.remove();
  
  const text = (clone.textContent ?? "").replace(/\u00a0/g, " ").trim();

  return { text, imageSrc };
};

export async function parseDocxOneTablePerQuestion(file: File): Promise<ParsedResult> {
  const arrayBuffer = await file.arrayBuffer();

  // --- OPTION 2: CUSTOM IMAGE INTERCEPTOR ---
  // We intercept Mammoth's image extraction to convert MathType WMFs to PNGs
  const mammothOptions = {
    convertImage: mammoth.images.imgElement(async (image) => {
      const contentType = image.contentType;
      const base64Data = await image.read("base64");
      
      // Default: Pass through the raw base64 data
      let finalSrc = `data:${contentType};base64,${base64Data}`;

      // Check if it is a proprietary MathType/Windows format
      if (contentType === "image/wmf" || contentType === "image/x-wmf" || contentType === "image/emf") {
        try {
          // Dynamically import the WMF library so the app doesn't crash if it's missing
          // @ts-ignore - The 'wmf' package does not have TypeScript declarations
          const wmf = await import("wmf").catch(() => null);
          
          if (wmf) {
            // Read the raw binary buffer of the image
            const rawBuffer = await image.read();
            const data = new Uint8Array(rawBuffer);
            
            // Create a hidden HTML5 canvas in the browser
            const canvas = document.createElement("canvas");
            
            // Draw the WMF binary data onto the canvas
            wmf.draw_canvas(data, canvas);
            
            // Convert the canvas drawing into a clean, web-safe PNG
            finalSrc = canvas.toDataURL("image/png");
            console.log("Successfully converted MathType WMF to PNG.");
          }
        } catch (error) {
          // If conversion fails, it gracefully falls back to the raw WMF data.
          // Your SafeImage component in MCQUpload will catch this and display a clean placeholder.
          console.warn("WMF conversion failed, safely falling back to original format.", error);
        }
      }

      return { src: finalSrc };
    })
  };

  // Convert to HTML using mammoth with our custom image interceptor
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer }, mammothOptions);

  const doc = new DOMParser().parseFromString(html, "text/html");
  const tables = Array.from(doc.querySelectorAll("table"));
  const nowIso = () => new Date().toISOString();
  const errors: string[] = [];
  const rows: MCQInsert[] = [];

  tables.forEach((table, tableIndex) => {
    const trList = Array.from(table.querySelectorAll("tr"));
    const options: string[] = [];
    const optionImages: (string | null)[] = []; 
    let correctIndex: number | null = null;

    const item: Partial<MCQInsert> = {
      id: crypto.randomUUID(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      type: "Multiple Choice",
      isFlagged: false,
      flagReason: "",
      imageUrl: undefined, 
    };

    trList.forEach((tr) => {
      const cells = Array.from(tr.querySelectorAll("td,th"));
      if (cells.length < 2) return;

      const keyRaw = (cells[0].textContent ?? "").trim();
      const key = cleanKey(keyRaw);

      const { text: valRaw, imageSrc } = extractContent(cells[1]);

      // Map Word template keys to DB fields
      if (key === "grade") item.grade = valRaw;
      else if (key === "subject") item.subject = valRaw;
      else if (key === "topic") item.topic = valRaw;
      else if (key === "sub-topic" || key === "sub topic" || key === "sub_topic") item.sub_topic = valRaw;
      
      // UPDATED: Now maps to the new Question Skill Type
      else if (key === "question skill type" || key === "question type" || key === "skill type") item.question_type = valRaw;
      
      else if (key === "question difficulty" || key === "difficulty") item.difficulty = valRaw;
      else if (key === "question") {
        item.question = valRaw;
        if (imageSrc) item.imageUrl = imageSrc; 
      }
      else if (key === "explanation") item.explanation = valRaw;
      else if (key === "question id/code" || key === "question id" || key === "question_code") item.question_code = valRaw;
      else if (key === "marks") item.marks = Number.isFinite(parseInt(valRaw)) ? parseInt(valRaw) : 4;
      else if (key.startsWith("option")) {
        const match = key.match(/option\s*(\d+)/i);
        if (match) {
          const idx = parseInt(match[1], 10) - 1;
          options[idx] = valRaw;
          optionImages[idx] = imageSrc || null; 
        }
      } 
      else if (key === "key" || key === "answer key" || key === "correct option") {
        const parsed = parseInt(valRaw, 10);
        if (Number.isFinite(parsed)) correctIndex = parsed - 1;
      }
    });

    const normalizedOptions: string[] = [];
    const normalizedOptionImages: (string | null)[] = [];
    const maxOptLength = Math.max(options.length, 4);
    
    for(let i = 0; i < maxOptLength; i++) {
        normalizedOptions[i] = (options[i] ?? "").trim();
        normalizedOptionImages[i] = optionImages[i] ?? null;
    }

    const missing: string[] = [];
    if (!item.subject) missing.push("Subject");
    if (!item.question && !item.imageUrl) missing.push("Question Content");
    if (normalizedOptions.filter(Boolean).length < 2 && normalizedOptionImages.filter(Boolean).length < 2) {
         missing.push("Options (min 2 text or images)");
    }

    if (missing.length) {
      errors.push(`Table ${tableIndex + 1}: Missing ${missing.join(", ")}`);
      return;
    }

    if (correctIndex == null || correctIndex < 0 || correctIndex >= normalizedOptions.length) {
      errors.push(`Table ${tableIndex + 1}: Invalid/missing Key (correct option number).`);
      return;
    }

    const answer = normalizedOptions[correctIndex];

    rows.push({
      ...(item as MCQInsert),
      options: normalizedOptions,
      answer,
      option_images: normalizedOptionImages, 
    });
  });

  if (tables.length === 0) {
    errors.push("No tables found in the document. Ensure it is a .docx with one table per question.");
  }

  return { rows, errors };
}