
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { 
  Test, TestResult, Payment, Institute, AdminQuestionPaper, 
  AcademicClass, WeeklySchedule, Student, TestMark, MCQ 
} from '../types';
import { 
  STUDENT_TESTS, ALL_RESULTS, STUDENT_PAYMENTS, INSTITUTES_DATA, 
  ADMIN_QUESTION_PAPERS, INSTITUTE_STUDENTS 
} from '../constants';
import { createClient } from '@supabase/supabase-js';

// Setup Supabase (Using standard config from environment or defaults)
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api';

interface DataContextType {
  tests: Test[];
  results: TestResult[];
  payments: Payment[];
  institutes: Institute[];
  adminQuestionPapers: AdminQuestionPaper[];
  mcqBank: MCQ[];
  
  classes: AcademicClass[];
  schedules: WeeklySchedule[];
  students: Student[];
  marks: TestMark[];

  // Operations
  addTest: (test: Test) => Promise<void>;
  editTest: (test: Test) => void;
  deleteTest: (testId: string) => Promise<void>;
  updateTestStatus: (testId: string, status: Test['status']) => void;
  addTestResult: (result: TestResult) => void;
  
  updatePaymentStatus: (paymentId: string, status: Payment['status']) => void;
  
  addInstitute: (inst: { name: string; email: string; password?: string; id?: string }) => Promise<void>;
  updateInstitute: (inst: Institute) => Promise<void>;
  deleteInstitute: (id: string) => Promise<void>;
  
  addAdminQuestionPaper: (paper: AdminQuestionPaper) => void;
  
  addClass: (cls: AcademicClass) => void;
  updateClass: (cls: AcademicClass) => void;
  deleteClass: (id: string) => void;
  
  addSchedule: (sch: WeeklySchedule) => void;
  deleteSchedule: (id: string) => void;
  
  addStudent: (std: Student) => void;
  updateStudent: (std: Student) => void;
  deleteStudent: (id: string) => void;
  bulkAddStudents: (stds: Student[]) => void;
  
  addMark: (mark: TestMark) => void;
  bulkAddMarks: (marks: TestMark[]) => void;

  addMCQ: (mcq: MCQ) => Promise<void>;
  updateMCQ: (id: string, updates: Partial<MCQ>) => Promise<void>;
  deleteMCQ: (id: string) => Promise<void>;
  flagMCQ: (id: string, reason?: string) => Promise<void>;
  unflagMCQ: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // --- Core States ---
  const [tests, setTests] = useState<Test[]>(STUDENT_TESTS);
  const [results, setResults] = useState<TestResult[]>(ALL_RESULTS);
  const [payments, setPayments] = useState<Payment[]>(STUDENT_PAYMENTS);
  const [institutes, setInstitutes] = useState<Institute[]>(() => {
    const saved = localStorage.getItem('atlas-institutes');
    return saved ? JSON.parse(saved) : INSTITUTES_DATA;
  });
  const [adminQuestionPapers, setAdminQuestionPapers] = useState<AdminQuestionPaper[]>(ADMIN_QUESTION_PAPERS);
  const [mcqBank, setMcqBank] = useState<MCQ[]>([]);

  // --- Academic Entity States ---
  const [classes, setClasses] = useState<AcademicClass[]>([
    { id: 'c6', name: 'Class 6', subjects: ['Mathematics', 'Science', 'Social'] },
    { id: 'c7', name: 'Class 7', subjects: ['Mathematics', 'Science', 'Social'] },
    { id: 'c8', name: 'Class 8', subjects: ['Physics', 'Chemistry', 'Biology', 'Mathematics'] },
    { id: 'c9', name: 'Class 9', subjects: ['Physics', 'Chemistry', 'Biology', 'Mathematics'] },
    { id: 'c10', name: 'Class 10', subjects: ['Physics', 'Chemistry', 'Biology', 'Mathematics'] },
  ]);
  const [schedules, setSchedules] = useState<WeeklySchedule[]>([
    { id: 'sc1', classId: 'c10', weekNumber: 1, subject: 'Physics', topic: 'Light Reflection and Refraction' },
    { id: 'sc2', classId: 'c9', weekNumber: 1, subject: 'Mathematics', topic: 'Number Systems' },
  ]);
  const [students, setStudents] = useState<Student[]>(INSTITUTE_STUDENTS);
  const [marks, setMarks] = useState<TestMark[]>([]);

  // Sync state to local storage for persistent prototype experience
  useEffect(() => {
    localStorage.setItem('atlas-institutes', JSON.stringify(institutes));
  }, [institutes]);

  // Initial Sync from Supabase if available
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: testsData } = await supabase.from('tests').select('*');
        if (testsData) setTests(testsData as Test[]);

        const { data: mcqData } = await supabase.from('mcqs').select('*');
        if (mcqData) setMcqBank(mcqData as MCQ[]);

        const { data: instData } = await supabase.from('institutes_with_users').select('*');
        if (instData) setInstitutes(instData as Institute[]);
      } catch (e) {
        console.warn("Supabase connection failed or tables missing, using local state defaults.");
      }
    };
    fetchData();
  }, []);

  // --- Institute Management ---
  const addInstitute = async (inst: { name: string; email: string; password?: string; id?: string }) => {
    const newId = inst.id?.trim() || `INST-${Date.now()}`;
    const newInst: Institute = {
      id: newId,
      name: inst.name,
      email: inst.email,
      password: inst.password || 'password'
    };

    try {
      // Mocking the backend call provided in user's prompt
      const response = await fetch(`${API_BASE_URL}/institutes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'admin-static-token'
        },
        body: JSON.stringify(newInst)
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to sync with server');
      }
      
      const serverData = await response.json();
      setInstitutes(prev => [...prev, { ...serverData.institute, email: inst.email }]);
    } catch (e) {
      console.warn("Backend unavailable, adding to local state only.");
      setInstitutes(prev => [...prev, newInst]);
    }
  };

  const updateInstitute = async (updated: Institute) => {
    try {
      const response = await fetch(`${API_BASE_URL}/institutes/${updated.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'admin-static-token' },
        body: JSON.stringify(updated)
      });
      if (!response.ok) throw new Error("Update failed");
      
      setInstitutes(prev => prev.map(inst => inst.id === updated.id ? updated : inst));
    } catch (e) {
      setInstitutes(prev => prev.map(inst => inst.id === updated.id ? updated : inst));
    }
  };

  const deleteInstitute = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/institutes/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'admin-static-token' }
      });
      if (!response.ok) throw new Error("Delete failed");
      
      setInstitutes(prev => prev.filter(inst => inst.id !== id));
    } catch (e) {
      setInstitutes(prev => prev.filter(inst => inst.id !== id));
    }
  };

  // --- Test Management ---
  const addTest = async (newTest: Test) => {
    try {
      const { data, error } = await supabase.from('tests').insert([newTest]).select();
      if (error) throw error;
      if (data) setTests(prev => [...prev, data[0] as Test]);
    } catch (e) {
      setTests(prev => [...prev, newTest]);
    }
  };

  const editTest = (updatedTest: Test) => setTests(prev => prev.map(t => t.id === updatedTest.id ? updatedTest : t));
  
  const deleteTest = async (testId: string) => {
    try {
      const { error } = await supabase.from('tests').delete().eq('id', testId);
      if (error) throw error;
      setTests(prev => prev.filter(t => t.id !== testId));
    } catch (e) {
      setTests(prev => prev.filter(t => t.id !== testId));
    }
  };

  const updateTestStatus = (testId: string, status: Test['status']) => setTests(prev => prev.map(t => t.id === testId ? {...t, status} : t));
  const addTestResult = (res: TestResult) => setResults(prev => [...prev, res]);

  // --- Academic Entities ---
  const addClass = (cls: AcademicClass) => setClasses(prev => [...prev, cls]);
  const updateClass = (cls: AcademicClass) => setClasses(prev => prev.map(c => c.id === cls.id ? cls : c));
  const deleteClass = (id: string) => setClasses(prev => prev.filter(c => c.id !== id));

  const addSchedule = (sch: WeeklySchedule) => setSchedules(prev => [...prev, sch]);
  const deleteSchedule = (id: string) => setSchedules(prev => prev.filter(s => s.id !== id));

  const addStudent = (std: Student) => setStudents(prev => [...prev, std]);
  const updateStudent = (std: Student) => setStudents(prev => prev.map(s => s.id === std.id ? std : s));
  const deleteStudent = (id: string) => setStudents(prev => prev.filter(s => s.id !== id));
  const bulkAddStudents = (stds: Student[]) => setStudents(prev => [...prev, ...stds]);

  const addMark = (mark: TestMark) => setMarks(prev => [...prev, mark]);
  const bulkAddMarks = (newMarks: TestMark[]) => setMarks(prev => [...prev, ...newMarks]);

  // --- Document Sharing ---
  const addAdminQuestionPaper = (paper: AdminQuestionPaper) => setAdminQuestionPapers(prev => [...prev, paper]);

  // --- MCQ Bank ---
  const addMCQ = async (mcq: MCQ) => {
    try {
      const { data, error } = await supabase.from('mcqs').insert([mcq]).select();
      if (error) throw error;
      if (data) setMcqBank(prev => [...prev, data[0] as MCQ]);
    } catch (e) {
      setMcqBank(prev => [...prev, mcq]);
    }
  };

  const updateMCQ = async (id: string, updates: Partial<MCQ>) => {
    try {
      const { data, error } = await supabase.from('mcqs').update(updates).eq('id', id).select();
      if (error) throw error;
      if (data) setMcqBank(prev => prev.map(m => m.id === id ? (data[0] as MCQ) : m));
    } catch (e) {
      setMcqBank(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    }
  };

  const deleteMCQ = async (id: string) => {
    try {
      await supabase.from('mcqs').delete().eq('id', id);
      setMcqBank(prev => prev.filter(m => m.id !== id));
    } catch (e) {
      setMcqBank(prev => prev.filter(m => m.id !== id));
    }
  };

  const flagMCQ = async (id: string, reason?: string) => {
    await updateMCQ(id, { isFlagged: true, flagReason: reason });
  };

  const unflagMCQ = async (id: string) => {
    await updateMCQ(id, { isFlagged: false, flagReason: '' });
  };

  const updatePaymentStatus = (id: string, status: Payment['status']) => setPayments(prev => prev.map(p => p.id === id ? { ...p, status } : p));

  return (
    <DataContext.Provider value={{ 
        tests, results, payments, institutes, adminQuestionPapers, mcqBank,
        classes, schedules, students, marks,
        addTest, editTest, deleteTest, updateTestStatus, addTestResult,
        updatePaymentStatus,
        addInstitute, updateInstitute, deleteInstitute,
        addAdminQuestionPaper,
        addClass, updateClass, deleteClass,
        addSchedule, deleteSchedule,
        addStudent, updateStudent, deleteStudent, bulkAddStudents,
        addMark, bulkAddMarks,
        addMCQ, updateMCQ, deleteMCQ, flagMCQ, unflagMCQ
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within a DataProvider');
  return context;
};
