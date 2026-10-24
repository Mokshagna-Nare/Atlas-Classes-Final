// Shapes exchanged with the Questions generator service (qpg-service).

export interface ProviderInfo {
  name: string;
  configured: boolean;
  default_model: string;
  model_listing: boolean;
}

export interface QGConfig {
  providers: ProviderInfo[];
  subjects: string[];
  default_subject: string;
  exam_modes: string[];
  default_exam_mode: string;
  question_types: string[];
  difficulty_mixes: string[];
  bloom_levels: string[];
  plain_difficulties: string[];
  figure_size_presets: string[];
  default_figure_size_preset: string;
  figure_label_modes: string[];
  default_figure_label_mode: string;
  extraction_methods: { label: string; value: 'ocr' | 'ai' }[];
  max_pdf_pages: number;
  max_total_questions: number;
  min_request_delay: number;
  numerical_option_text: string;
  field_labels: string[];
  ocr_available: boolean;
}

export interface FigureJSON {
  image: string; // data URL
  mime: string;
  width_pt?: number;
  height_pt?: number;
  size_kb?: number;
}

export interface Question {
  question_type: string; // "MCQ" | "Numerical"
  question: string;
  options: string[];
  key: string;
  difficulty?: string;
  bloom_level?: string;
  explanation?: string;
  review_flags?: string[];
  figure?: FigureJSON | null;
  figure_id?: string;
  [extra: string]: unknown;
}

export interface PageResult {
  page_number?: number;
  label?: string;
  subtopic: string;
  questions: Question[];
}

export interface RunResult {
  mode: 'generate' | 'extract';
  pages: PageResult[];
  grade: string;
  subject: string;
  topic: string;
  source_name: string;
  notices: string[];
}

export const countQuestions = (pages: PageResult[]) =>
  pages.reduce((total, page) => total + page.questions.length, 0);
