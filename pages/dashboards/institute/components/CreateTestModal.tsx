import React, { useState, useEffect } from 'react';
import { useData } from '../../../../contexts/DataContext';
import { useAuth } from '../../../../contexts/AuthContext';
import { XIcon } from '../../../../components/icons';
import { Test } from '../../../../types';

interface CreateTestModalProps {
  onClose: () => void;
  testToEdit: Test | null;
}

const CreateTestModal: React.FC<CreateTestModalProps> = ({ onClose, testToEdit }) => {
    const isEditMode = Boolean(testToEdit);
    
    const [title, setTitle] = useState('');
    const [subject, setSubject] = useState('');
    const [date, setDate] = useState('');
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [existingPdfName, setExistingPdfName] = useState('');
    const [error, setError] = useState('');
    
    const { addTest, editTest } = useData();
    const { user } = useAuth()!;

    useEffect(() => {
        if (isEditMode && testToEdit) {
            setTitle(testToEdit.title);
            setSubject(testToEdit.subject);
            setDate(testToEdit.date);
            setExistingPdfName(testToEdit.pdfFileName || '');
        }
    }, [isEditMode, testToEdit]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            if (e.target.files[0].type === 'application/pdf') {
                setPdfFile(e.target.files[0]);
                setError('');
            } else {
                setError('Please upload a valid PDF file.');
                setPdfFile(null);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !subject || !date) {
            setError('Please fill all fields.');
            return;
        }
        if (!isEditMode && !pdfFile) {
            setError('Please upload a question paper for new tests.');
            return;
        }

        if (isEditMode && testToEdit) {
            const updatedTest: Test = {
                ...testToEdit,
                title,
                subject,
                date,
                pdfFileName: pdfFile ? pdfFile.name : existingPdfName,
            };
            editTest(updatedTest);
        } else {
            const newTest: Test = {
                id: crypto.randomUUID(),
                title,
                subject,
                date,
                pdfFileName: pdfFile!.name,
                status: 'Upcoming',
                institute_id: user!.id,
                // FIX: Add these missing mandatory fields
    duration: 60,         // Default duration (e.g., 60 minutes)
    total_marks: 100,     // Default total marks
    question_ids: [],     // Initialize as empty array since no questions exist yet
    batch: 'AXIS',     // Default batch name (or get it from a form input)
            };
            await addTest(newTest);
        }
        
        onClose();
    };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 animate-fade-in-up" style={{animationDuration: '0.3s'}}>
      <div className="bg-atlas-gray rounded-lg shadow-2xl w-full max-w-lg relative p-8" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
          <XIcon className="h-6 w-6" />
        </button>
        <h2 className="text-2xl font-bold mb-6 text-atlas-orange">{isEditMode ? 'Edit Test' : 'Create New Test'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-300 block mb-2">Test Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="w-full p-2 bg-atlas-black border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-atlas-orange" />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-300 block mb-2">Subject</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)} required className="w-full p-2 bg-atlas-black border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-atlas-orange" />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-300 block mb-2">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full p-2 bg-atlas-black border border-gray-700 rounded-md" />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-300 block mb-2">Question Paper (PDF)</label>
            <input type="file" accept=".pdf" onChange={handleFileChange} className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-atlas-orange file:text-white hover:file:bg-orange-600 cursor-pointer"/>
            {pdfFile && <p className="text-xs text-green-400 mt-1">New file selected: {pdfFile.name}</p>}
            {!pdfFile && existingPdfName && <p className="text-xs text-gray-400 mt-1">Current file: {existingPdfName}</p>}
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="pt-2">
            <button type="submit" className="w-full bg-atlas-orange text-white font-bold py-3 px-6 rounded-md hover:bg-orange-600 transition">
                {isEditMode ? 'Update Test' : 'Create Test'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTestModal;