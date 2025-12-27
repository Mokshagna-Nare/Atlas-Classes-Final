import React, { useState } from 'react';
import { useData } from '../../../../contexts/DataContext';
import { AdminQuestionPaper } from '../../../../types';

type Subject = 'Physics' | 'Chemistry' | 'Botany' | 'Zoology';

const fileToBase64 = (file: File): Promise<{base64: string, mimeType: string}> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        const mimeType = result.split(',')[0].split(':')[1].split(';')[0];
        resolve({ base64, mimeType });
      };
      reader.onerror = error => reject(error);
    });
};

const UploadPaper: React.FC = () => {
  const { institutes, addAdminQuestionPaper } = useData();
  const [subject, setSubject] = useState<Subject>('Physics');
  const [file, setFile] = useState<File | null>(null);
  const [selectedInstitutes, setSelectedInstitutes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleInstituteToggle = (instituteId: string) => {
    setSelectedInstitutes(prev =>
      prev.includes(instituteId)
        ? prev.filter(id => id !== instituteId)
        : [...prev, instituteId]
    );
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        if (e.target.files[0].type === 'application/pdf') {
            setFile(e.target.files[0]);
            setError('');
        } else {
            setError('Please upload a valid PDF file.');
            setFile(null);
        }
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!file || selectedInstitutes.length === 0) {
      setError('Please select a file and at least one institute.');
      return;
    }

    setIsUploading(true);

    try {
        const { base64, mimeType } = await fileToBase64(file);

        const newPaper: AdminQuestionPaper = {
          id: `aqp-${Date.now()}`,
          subject,
          fileName: file.name,
          accessibleInstituteIds: selectedInstitutes,
          fileContent: base64,
          mimeType: mimeType,
        };

        addAdminQuestionPaper(newPaper);
        setSuccess(`Successfully uploaded "${file.name}" and shared with ${selectedInstitutes.length} institute(s).`);

        // Reset form
        setFile(null);
        setSelectedInstitutes([]);
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if(fileInput) fileInput.value = '';

    } catch (err) {
        setError('Failed to read file for upload. Please try again.');
        console.error(err);
    } finally {
        setIsUploading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-atlas-orange">Upload Question Paper</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="text-sm font-bold text-gray-300 block mb-2">Subject</label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value as Subject)}
            className="w-full p-3 bg-atlas-black border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-atlas-orange"
          >
            <option>Physics</option>
            <option>Chemistry</option>
            <option>Botany</option>
            <option>Zoology</option>
          </select>
        </div>

        <div>
            <label className="text-sm font-bold text-gray-300 block mb-2">Question Paper (PDF)</label>
            <input 
                id="file-upload"
                type="file" 
                accept=".pdf" 
                onChange={handleFileChange} 
                className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-atlas-orange file:text-white hover:file:bg-orange-600 cursor-pointer"
            />
            {file && <p className="text-xs text-green-400 mt-1">Selected: {file.name}</p>}
        </div>

        <div>
          <label className="text-sm font-bold text-gray-300 block mb-2">Grant Access To</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto bg-atlas-black p-2 rounded-md border border-gray-700">
            {institutes.map(institute => (
              <label key={institute.id} className="flex items-center space-x-2 p-2 rounded hover:bg-atlas-gray cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedInstitutes.includes(institute.id)}
                  onChange={() => handleInstituteToggle(institute.id)}
                  className="form-checkbox bg-atlas-gray border-gray-600 text-atlas-orange focus:ring-atlas-orange"
                />
                <span className="text-gray-300">{institute.name}</span>
              </label>
            ))}
          </div>
        </div>
        
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {success && <p className="text-green-500 text-sm">{success}</p>}

        <button type="submit" disabled={isUploading} className="w-full bg-atlas-orange text-white font-bold py-3 px-6 rounded-md hover:bg-orange-600 transition duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed">
          {isUploading ? 'Uploading...' : 'Upload and Share'}
        </button>
      </form>
    </div>
  );
};

export default UploadPaper;