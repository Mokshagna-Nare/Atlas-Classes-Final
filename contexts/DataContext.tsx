import api from '../services/api';
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { 
  Test, TestResult, Payment, Institute, AdminQuestionPaper, 
  AcademicClass, WeeklySchedule, Student, TestMark, MCQ 
} from '../types';
import { 
  STUDENT_TESTS, ALL_RESULTS, STUDENT_PAYMENTS, 
  ADMIN_QUESTION_PAPERS, INSTITUTE_STUDENTS 
} from '../constants';
import { createClient } from '@supabase/supabase-js';

// Safely setup Supabase to prevent crashes if env variables are missing
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// The interface includes ALL your existing functions PLUS refreshInstitutes
interface DataContextType {
  tests: Test[];
  results: TestResult[];
  payments: Payment[];
  institutes: Institute[];
  adminQuestionPapers: AdminQuestionPaper[];
  mcqBank: MCQ[];
  // Optional, only if you want a full refresh function
  
  classes: AcademicClass[];
  schedules: WeeklySchedule[];
  students: Student[];
  marks: TestMark[];

  refreshInstitutes: () => Promise<void>;

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
  const [tests, setTests] = useState<Test[]>(STUDENT_TESTS);
  const [results, setResults] = useState<TestResult[]>(ALL_RESULTS);
  const [payments, setPayments] = useState<Payment[]>(STUDENT_PAYMENTS);

  // Institutes starts empty, gets loaded directly from Supabase via refreshInstitutes
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [adminQuestionPapers, setAdminQuestionPapers] = useState<AdminQuestionPaper[]>(ADMIN_QUESTION_PAPERS);
  const [mcqBank, setMcqBank] = useState<MCQ[]>([]);

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

   const refreshInstitutes = async () => {
  if (!supabase) return;
  try {
    // 1. ADD logo_url TO THE SELECT QUERY
    const { data: instData, error } = await supabase
      .from('users')
      .select('id, name, email, logo_url') // <--- Added logo_url here
      .eq('role', 'institute');
      
    if (error) {
      console.error('Supabase fetch error:', error);
      throw error;
    }
    
    if (instData) {
      // 2. MAP THE logo_url TO THE FRONTEND STATE
      const mapped = instData.map((row: any) => ({
        id: row.id,
        name: row.name || 'Unknown Institute',
        email: row.email ?? '',
        logo_url: row.logo_url || undefined // <--- Pass the logo to the state
      })) as Institute[];
      
      console.log("Loaded institutes with logos:", mapped); 
      setInstitutes(mapped);
    }
  } catch (e) {
    console.warn('Failed to load institutes from Supabase');
  }
};



  useEffect(() => {
    const fetchData = async () => {
      if (!supabase) return;
      try {
        const { data: testsData } = await supabase.from('tests').select('*');
        if (testsData) setTests(testsData as Test[]);

        const { data: mcqData } = await supabase.from('mcqs').select('*');
        if (mcqData) setMcqBank(mcqData as MCQ[]);

        await refreshInstitutes();
      } catch (e) {
        console.warn('Supabase connection failed, using local defaults.');
      }
    };
    fetchData();
  }, []);

  const addInstitute = async (inst: { name: string; email: string; password?: string; id?: string }) => {
    const newId = inst.id?.trim() || `INST-${Date.now()}`;
    const newInst: Institute = {
      id: newId,
      name: inst.name,
      email: inst.email,
      password: inst.password || 'password'
    };
    setInstitutes(prev => [...prev, newInst]);
  };

  const updateInstitute = async (updated: Institute) => {
    setInstitutes(prev => prev.map(inst => inst.id === updated.id ? updated : inst));
  };

  const deleteInstitute = async (id: string) => {
    // 1. Save the current list in case the API call fails
    const previousInstitutes = [...institutes];
    
    // 2. Remove it from the UI immediately
    setInstitutes(prev => prev.filter(inst => inst.id !== id));

    try {
      // 3. Make the API call to the backend. 
      // Note: Make sure api.ts is configured to point to http://localhost:5001/api
      await api.delete(`/auth/delete-institute/${id}`);
      console.log(`Institute ${id} deleted successfully from backend.`);
      
    } catch (e: any) {
      console.error('Delete institute failed:', e.response?.data || e.message);
      // 4. If it fails, put the institute back on the screen
      setInstitutes(previousInstitutes);
      throw e; 
    }
  };



  const addTest = async (newTest: Test) => {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('tests').insert([newTest]).select();
        if (error) throw error;
        if (data) return setTests(prev => [...prev, data[0] as Test]);
      } catch (e) { console.warn(e); }
    }
    setTests(prev => [...prev, newTest]);
  };

  const editTest = (updatedTest: Test) => 
    setTests(prev => prev.map(t => t.id === updatedTest.id ? updatedTest : t));
  
  const deleteTest = async (testId: string) => {
    if (supabase) {
      try { await supabase.from('tests').delete().eq('id', testId); } catch (e) { console.warn(e); }
    }
    setTests(prev => prev.filter(t => t.id !== testId));
  };

  const updateTestStatus = (testId: string, status: Test['status']) => 
    setTests(prev => prev.map(t => t.id === testId ? { ...t, status } : t));

  const addTestResult = (res: TestResult) => setResults(prev => [...prev, res]);

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

  const addAdminQuestionPaper = (paper: AdminQuestionPaper) => setAdminQuestionPapers(prev => [...prev, paper]);

  const addMCQ = async (mcq: MCQ) => {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('mcqs').insert([mcq]).select();
        if (error) throw error;
        if (data) return setMcqBank(prev => [...prev, data[0] as MCQ]);
      } catch (e) { console.warn(e); }
    }
    setMcqBank(prev => [...prev, mcq]);
  };

  const updateMCQ = async (id: string, updates: Partial<MCQ>) => {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('mcqs').update(updates).eq('id', id).select();
        if (error) throw error;
        if (data) return setMcqBank(prev => prev.map(m => m.id === id ? (data[0] as MCQ) : m));
      } catch (e) { console.warn(e); }
    }
    setMcqBank(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const deleteMCQ = async (id: string) => {
    if (supabase) {
      try { await supabase.from('mcqs').delete().eq('id', id); } catch (e) { console.warn(e); }
    }
    setMcqBank(prev => prev.filter(m => m.id !== id));
  };

  const flagMCQ = async (id: string, reason?: string) => {
    await updateMCQ(id, { isFlagged: true, flagReason: reason });
  };

  const unflagMCQ = async (id: string) => {
    await updateMCQ(id, { isFlagged: false, flagReason: '' });
  };

  const updatePaymentStatus = (id: string, status: Payment['status']) => 
    setPayments(prev => prev.map(p => p.id === id ? { ...p, status } : p));

  return (
    <DataContext.Provider value={{ 
        tests, results, payments, institutes, adminQuestionPapers, mcqBank,
        classes, schedules, students, marks, 
        refreshInstitutes,
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
