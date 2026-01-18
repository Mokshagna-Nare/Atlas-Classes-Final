
export interface User {
  id: string;
  name: string;
  role: 'institute' | 'student' | 'admin';
  institute_id?: string;
  batch?: 'COMPASS' | 'AXIS' | 'NEXUS';
}


export interface AcademicClass {
  id: string;
  name: string;
  subjects: string[];
}

export interface WeeklySchedule {
  id: string;
  classId: string;
  weekNumber: number;
  subject: string;
  topic: string;
}

// Added Course interface to resolve export error
export interface Course {
  id: number;
  title: string;
  description: string;
}

// Added FacultyMember interface to resolve export error
export interface FacultyMember {
  id: number;
  name: string;
  subject: string;
  subjects: string[];
  photoUrl: string;
  bio: string;
}

// Added Testimonial interface to resolve export error
export interface Testimonial {
  id: number;
  quote: string;
  author: string;
  title: string;
  rating: number;
}

// Added Student interface to resolve export error
export interface Student {
  id: string;
  name: string;
  institute_id: string;
}

export interface Institute {
  id: string;
  name: string;
  email: string;
}

export interface AdminQuestionPaper {
  id: string;
  subject: 'Physics' | 'Chemistry' | 'Botany' | 'Zoology';
  fileName: string;
  accessibleInstituteIds: string[];
  fileContent: string; // Base64 encoded file content
  mimeType: string;
}

// export interface MCQ extends Question {
//   subject: string;
//   topic: string;
//   difficulty: string;
//   marks: number;
//   isFlagged: boolean;
//   flagReason?: string;
//   createdAt: string;
//   updatedAt: string;
// }

export interface MCQ {
  id?: string;
  createdAt?: string;
  updatedAt?: string; // You likely added this earlier
  question: string;
  options: string[];
  
  // --- ADD THIS NEW LINE ---
  option_images?: (string | null)[]; 
  // -------------------------

  answer: string;
  explanation?: string;
  grade?: string;
  subject: string;
  topic?: string;
  sub_topic?: string;
  question_type?: string;
  difficulty?: string;
  marks?: number;
  question_code?: string;
  imageUrl?: string;
  type?: "Multiple Choice" | "Short Answer" | "True/False";
  isFlagged?: boolean;
  flagReason?: string;
}



export interface Question {
  id?: string;
  question: string;
  type: 'Multiple Choice' | 'Short Answer' | 'True/False';
  options?: string[];
  answer: string;
  explanation?: string;
  diagramDescription?: string;
  diagramSvg?: string;
}

// export interface Test {
//     id: string;
//     title: string;
//     date: string;
//     status: 'Upcoming' | 'Completed' | 'Assigned';
//     institute_id: string;
//     subject: string;
//     pdfFileName?: string;
//     question_ids?: string[];
//     duration?: number;
// }

// adjust the file/path where your types are defined
export type Test = {
  id?: string;                 // DB will generate this
  title: string;
  duration: number;
  institute_id: string | null; // institute id from dropdown
  question_ids: string[];      // array of MCQ ids
  total_marks: number;
  date: string;                // 'YYYY-MM-DD'
  status?: 'scheduled' | 'completed' | 'cancelled' | 'Upcoming'; // optional, frontend only
  subject?: string; // <-- add this line
  batch: 'COMPASS' | 'AXIS' | 'NEXUS';
  pdfFileName?: string; // optional, name of the uploaded PDF file
  questions?: Question[];
};



// Backend-aligned Attempt structures
export interface TestAttempt {
    id: string;
    testId: string;
    studentId: string;
    startedAt: string;
    completedAt?: string;
    status: 'in_progress' | 'completed' | 'expired';
    score: number;
    maxScore: number;
    rank?: number;
    answers?: AttemptAnswer[];
}

export interface AttemptAnswer {
    questionIndex: number;
    selectedOption: string;
    isCorrect: boolean;
}

export interface TestResult {
testId: string;
    studentId: string;
    score: number;
    maxScore: number;
    rank: number;
    totalStudents: number;
    grade: 'A+' | 'A' | 'B' | 'C' | 'D';
    correctCount: number;
    wrongCount: number;
    unattemptedCount: number;
    subjectBreakdown: {
      [subject: string]: {
        score: number;
        maxScore: number;
      }
    };
    studentAnswers?: Record<string, string>;
}

export interface Payment {
    id: string;
    date: string;
    amount: number;
    status: 'Paid' | 'Due';
}



