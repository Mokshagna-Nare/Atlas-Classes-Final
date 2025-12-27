
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Test, TestResult, Payment, Institute, AdminQuestionPaper, MCQ } from '../types';
import { ALL_RESULTS, STUDENT_PAYMENTS, INSTITUTES_DATA, ADMIN_QUESTION_PAPERS } from '../constants';
import { supabase } from '../services/supabase';

interface DataContextType {
  tests: Test[];
  results: TestResult[];
  payments: Payment[];
  institutes: Institute[];
  adminQuestionPapers: AdminQuestionPaper[];
  mcqBank: MCQ[];
  addTest: (test: Test) => Promise<void>;
  editTest: (updatedTest: Test) => void;
  deleteTest: (testId: string) => Promise<void>;
  addTestResult: (result: TestResult) => void;
  updateTestStatus: (testId: string, status: Test['status']) => void;
  updatePaymentStatus: (paymentId: string, status: Payment['status']) => void;
  updateInstitute: (updatedInstitute: Institute) => void;
  addAdminQuestionPaper: (paper: AdminQuestionPaper) => void;
  addInstitute: (institute: { name: string; email: string; password?: string }) => void;
  deleteInstitute: (instituteId: string) => void;
  addMCQ: (mcq: MCQ) => Promise<void>;
  updateMCQ: (id: string, updates: Partial<MCQ>) => Promise<void>;
  deleteMCQ: (id: string) => Promise<void>;
  flagMCQ: (id: string, reason?: string) => Promise<void>;
  unflagMCQ: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tests, setTests] = useState<Test[]>([]);
  const [results, setResults] = useState<TestResult[]>(ALL_RESULTS);
  const [payments, setPayments] = useState<Payment[]>(STUDENT_PAYMENTS);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [adminQuestionPapers, setAdminQuestionPapers] = useState<AdminQuestionPaper[]>(ADMIN_QUESTION_PAPERS);
  const [mcqBank, setMcqBank] = useState<MCQ[]>([]);

  useEffect(() => {
    const fetchTests = async () => {
      const { data, error } = await supabase.from('tests').select('*');
      if (error) {
        console.error('Error fetching tests:', error);
      } else {
        setTests(data as Test[]);
      }
    };
    const fetchMCQs = async () => {
        const { data, error } = await supabase.from('mcqs').select('*');
        if (error) {
            console.error('Error fetching MCQs:', error);
        } else {
            setMcqBank(data as MCQ[]);
        }
    };
    const fetchInstitutes = async () => {
      const { data, error } = await supabase.from('institutes_with_users').select('*');
      if (error) {
          console.error('Error fetching institutes:', error);
      } else {
          setInstitutes(data as Institute[]);
      }
    };
    fetchTests();
    fetchMCQs();
    fetchInstitutes();
  }, []);

  // const addTest = async (newTest: Test) => {
  //   const { data, error } = await supabase.from('tests').insert([newTest]).select();
  //   if (error) {
  //     console.error('Error adding test:', error);
  //   } else if (data) {
  //     setTests(prev => [...prev, data[0] as Test]);
  //   }
  // };

const addTest = async (newTest: Test) => {
  // Only send columns that actually exist in the "tests" table
  const payload = {
    title: newTest.title,
    duration: newTest.duration,
    institute_id: newTest.institute_id ?? null,
    question_ids: newTest.question_ids ?? [],
    total_marks: newTest.total_marks,
    date: newTest.date, // make sure you pass 'YYYY-MM-DD'
  };

  const { data, error } = await supabase
    .from('tests')
    .insert([payload])
    .select();

  if (error) {
    console.error('Error adding test:', error);
  } else if (data) {
    setTests(prev => [...prev, data[0] as Test]);
  }
};



  const editTest = (updatedTest: Test) => setTests(prev => prev.map(t => t.id === updatedTest.id ? updatedTest : t));
  const deleteTest = async (testId: string) => {
    const { error } = await supabase.from('tests').delete().eq('id', testId);
    if (error) {
      console.error('Error deleting test:', error);
    } else {
      setTests(prev => prev.filter(t => t.id !== testId));
    }
  };
  const addTestResult = (newResult: TestResult) => setResults(prev => [...prev, newResult]);
  const updateTestStatus = (testId: string, status: Test['status']) => setTests(prev => prev.map(t => t.id === testId ? {...t, status} : t));
  const updatePaymentStatus = (paymentId: string, status: Payment['status']) => setPayments(prev => prev.map(p => p.id === paymentId ? {...p, status} : p));
  const updateInstitute = (updatedInstitute: Institute) => setInstitutes(prev => prev.map(inst => inst.id === updatedInstitute.id ? updatedInstitute : inst));
  const addAdminQuestionPaper = (paper: AdminQuestionPaper) => setAdminQuestionPapers(prev => [...prev, paper]);
  const addInstitute = async (institute: { name: string; email: string; password?: string }) => {
    try {
      const response = await fetch('http://localhost:5000/api/institutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'admin-static-token' // Replace with a dynamic token in a real app
        },
        body: JSON.stringify(institute)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to add institute');
      }
      setInstitutes(prev => [...prev, { ...data.institute, email: institute.email }]);
    } catch (error) {
      console.error('Error adding institute:', error);
    }
  };
  const deleteInstitute = async (instituteId: string) => {
    try {
      const response = await fetch(`http://localhost:5000/api/institutes/${instituteId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'admin-static-token' // Replace with a dynamic token in a real app
        }
      });
      if (!response.ok) {
        throw new Error('Failed to delete institute');
      }
      setInstitutes(prev => prev.filter(inst => inst.id !== instituteId));
    } catch (error) {
      console.error('Error deleting institute:', error);
    }
  };

  const addMCQ = async (mcq: MCQ) => {
    const { data, error } = await supabase.from('mcqs').insert([mcq]).select();
    if (error) {
      console.error('Error adding MCQ:', error);
    } else if (data) {
      setMcqBank(prev => [...prev, data[0] as MCQ]);
    }
  };

  const updateMCQ = async (id: string, updates: Partial<MCQ>) => {
    const { data, error } = await supabase.from('mcqs').update(updates).eq('id', id).select();
    if (error) {
      console.error('Error updating MCQ:', error);
    } else if (data) {
      setMcqBank(prev => prev.map(m => m.id === id ? data[0] as MCQ : m));
    }
  };

  const deleteMCQ = async (id: string) => {
    const { error } = await supabase.from('mcqs').delete().eq('id', id);
    if (error) {
      console.error('Error deleting MCQ:', error);
    } else {
      setMcqBank(prev => prev.filter(m => m.id !== id));
    }
  };
  
  const flagMCQ = async (id: string, reason?: string) => {
    await updateMCQ(id, { isFlagged: true, flagReason: reason });
  };
  
  const unflagMCQ = async (id: string) => {
    await updateMCQ(id, { isFlagged: false, flagReason: undefined });
  };

  return (
    <DataContext.Provider value={{ 
        tests, results, payments, institutes, adminQuestionPapers, mcqBank,
        addTest, editTest, deleteTest, addTestResult, updateTestStatus, updatePaymentStatus,
        updateInstitute, addAdminQuestionPaper, addInstitute, deleteInstitute,
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