import api from '../services/api';
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { 
  Test, TestResult, Payment, Institute, AdminQuestionPaper, 
  AcademicClass, WeeklySchedule, Student, TestMark, MCQ 
} from '../types';
import {
  STUDENT_TESTS, ALL_RESULTS, STUDENT_PAYMENTS,
  ADMIN_QUESTION_PAPERS
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
  refreshClasses: () => Promise<void>;
  refreshStudents: () => Promise<void>;

  addTest: (test: Test) => Promise<void>;
  editTest: (test: Test) => Promise<void>;
  deleteTest: (testId: string) => Promise<void>;
  updateTestStatus: (testId: string, status: Test['status']) => void;
  addTestResult: (result: TestResult) => void;
  
  updatePaymentStatus: (paymentId: string, status: Payment['status']) => void;
  
  addInstitute: (inst: { name: string; email: string; password?: string; id?: string }) => Promise<void>;
  updateInstitute: (inst: Institute) => Promise<void>;
  deleteInstitute: (id: string) => Promise<void>;
  
  addAdminQuestionPaper: (paper: AdminQuestionPaper) => void;
  
  addClass: (cls: AcademicClass) => Promise<void>;
  updateClass: (cls: AcademicClass) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;

  addSchedule: (sch: WeeklySchedule) => void;
  deleteSchedule: (id: string) => void;

  createStudent: (std: { name: string; email: string; password: string; institute_id: string; class_id?: string | null; roll_no?: string | null }) => Promise<void>;
  updateStudent: (id: string, updates: { name?: string; email?: string; password?: string; class_id?: string | null; roll_no?: string | null }) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
  
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

  // classes/students start empty and load from Supabase (see refreshClasses/refreshStudents below).
  // Falls back to the legacy mock lists only if Supabase is unreachable, so existing demos still render.
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [schedules, setSchedules] = useState<WeeklySchedule[]>([
    { id: 'sc1', classId: 'c10', weekNumber: 1, subject: 'Physics', topic: 'Light Reflection and Refraction' },
    { id: 'sc2', classId: 'c9', weekNumber: 1, subject: 'Mathematics', topic: 'Number Systems' },
  ]);
  const [students, setStudents] = useState<Student[]>([]);
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

  const refreshClasses = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('classes').select('*').order('name');
      if (error) throw error;
      if (data) {
        setClasses(data.map((row: any) => ({
          id: row.id,
          institute_id: row.institute_id,
          name: row.name,
          subjects: row.subjects || [],
        })) as AcademicClass[]);
      }
    } catch (e) {
      console.warn('Failed to load classes from Supabase (has migration 001 been run yet?)');
    }
  };

  const refreshStudents = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, institute_id, class_id, roll_no, password, created_at')
        .eq('role', 'student');
      if (error) throw error;
      if (data) setStudents(data as Student[]);
    } catch (e) {
      console.warn('Failed to load students from Supabase (has migration 001 been run yet?)');
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

        await Promise.all([refreshInstitutes(), refreshClasses(), refreshStudents()]);
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



  // Only columns that exist on the live `tests` table — extra fields (batch, total_marks,
  // pdfFileName…) make PostgREST reject the whole insert.
  const toTestRow = (t: Test) => ({
    title: t.title,
    subject: t.subject ?? null,
    date: t.date || null,
    duration: t.duration ?? null,
    institute_id: t.institute_id,
    status: t.status ?? 'Upcoming',
    question_ids: t.question_ids ?? [],
  });

  const addTest = async (newTest: Test) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data, error } = await supabase.from('tests').insert([toTestRow(newTest)]).select().single();
    if (error) throw error;
    setTests(prev => [...prev, data as Test]);
  };

  const editTest = async (updatedTest: Test) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { title, subject, date, duration } = toTestRow(updatedTest);
    const { error } = await supabase.from('tests').update({ title, subject, date, duration }).eq('id', updatedTest.id);
    if (error) throw error;
    setTests(prev => prev.map(t => t.id === updatedTest.id ? { ...t, ...updatedTest } : t));
  };
  
  const deleteTest = async (testId: string) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { error } = await supabase.from('tests').delete().eq('id', testId);
    if (error) throw error;
    setTests(prev => prev.filter(t => t.id !== testId));
  };

  const updateTestStatus = (testId: string, status: Test['status']) => 
    setTests(prev => prev.map(t => t.id === testId ? { ...t, status } : t));

  const addTestResult = (res: TestResult) => setResults(prev => [...prev, res]);

  const addClass = async (cls: AcademicClass) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data, error } = await supabase
      .from('classes')
      .insert([{ institute_id: cls.institute_id, name: cls.name, subjects: cls.subjects }])
      .select()
      .single();
    if (error) throw error;
    setClasses(prev => [...prev, { id: data.id, institute_id: data.institute_id, name: data.name, subjects: data.subjects || [] }]);
  };

  const updateClass = async (cls: AcademicClass) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { error } = await supabase
      .from('classes')
      .update({ name: cls.name, subjects: cls.subjects })
      .eq('id', cls.id);
    if (error) throw error;
    setClasses(prev => prev.map(c => c.id === cls.id ? cls : c));
  };

  const deleteClass = async (id: string) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) throw error;
    setClasses(prev => prev.filter(c => c.id !== id));
  };

  const addSchedule = (sch: WeeklySchedule) => setSchedules(prev => [...prev, sch]);
  const deleteSchedule = (id: string) => setSchedules(prev => prev.filter(s => s.id !== id));

  const createStudent = async (std: { name: string; email: string; password: string; institute_id: string; class_id?: string | null; roll_no?: string | null }) => {
    const { data } = await api.post('/auth/create-student', std);
    setStudents(prev => [...prev, {
      id: data.user.id,
      name: std.name,
      email: std.email,
      institute_id: std.institute_id,
      class_id: std.class_id ?? null,
      roll_no: std.roll_no ?? null,
      password: std.password,
    }]);
  };

  const updateStudent = async (id: string, updates: { name?: string; email?: string; password?: string; class_id?: string | null; roll_no?: string | null }) => {
    await api.put(`/auth/update-student/${id}`, updates);
    setStudents(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteStudent = async (id: string) => {
    const previousStudents = [...students];
    setStudents(prev => prev.filter(s => s.id !== id));
    try {
      await api.delete(`/auth/delete-student/${id}`);
    } catch (e) {
      setStudents(previousStudents);
      throw e;
    }
  };

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
        refreshInstitutes, refreshClasses, refreshStudents,
        addTest, editTest, deleteTest, updateTestStatus, addTestResult,
        updatePaymentStatus,
        addInstitute, updateInstitute, deleteInstitute,
        addAdminQuestionPaper,
        addClass, updateClass, deleteClass,
        addSchedule, deleteSchedule,
        createStudent, updateStudent, deleteStudent,
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
