
import React, { useState } from 'react';
import { useData } from '../../../../contexts/DataContext';
import { AdminQuestionPaper, Institute } from '../../../../types';
import { XIcon, DocumentDuplicateIcon, SparklesIcon } from '../../../../components/icons';

interface SharePaperModalProps {
  institute: Institute;
  onClose: () => void;
}

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

const SharePaperModal: React.FC<SharePaperModalProps> = ({ institute, onClose }) => {
  const { addAdminQuestionPaper } = useData();
  const [subject, setSubject] = useState<'Physics' | 'Chemistry' | 'Botany' | 'Zoology'>('Physics');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

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
    if (!file) {
      setError('Please select a PDF document.');
      return;
    }

    setIsUploading(true);
    try {
        const { base64, mimeType } = await fileToBase64(file);
        const newPaper: AdminQuestionPaper = {
          id: `aqp-${Date.now()}`,
          subject,
          fileName: file.name,
          accessibleInstituteIds: [institute.id],
          fileContent: base64,
          mimeType: mimeType,
        };

        addAdminQuestionPaper(newPaper);
        alert(`Successfully shared "${file.name}" with ${institute.name}`);
        onClose();
    } catch (err) {
        setError('Failed to process file.');
        console.error(err);
    } finally {
        setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex justify-center items-center z-[100] p-4 animate-fade-in-up" style={{ animationDuration: '0.3s' }}>
      <div className="bg-atlas-soft border border-gray-800 rounded-[2.5rem] shadow-2xl w-full max-w-xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-10 relative z-10">
            <button onClick={onClose} className="absolute top-8 right-8 text-gray-500 hover:text-white transition-colors">
                <XIcon className="h-7 w-7" />
            </button>
            
            <div className="flex items-center gap-4 mb-10">
                <div className="p-3 bg-atlas-primary/10 rounded-2xl border border-atlas-primary/20">
                    <DocumentDuplicateIcon className="h-8 w-8 text-atlas-primary" />
                </div>
                <div>
                    <h2 className="text-3xl font-black text-white">Share Documents</h2>
                    <p className="text-gray-500 text-sm font-bold uppercase tracking-widest mt-1">Sharing with: <span className="text-atlas-primary">{institute.name}</span></p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2 ml-1">Academic Subject</label>
                    <select
                        value={subject}
                        onChange={(e) => setSubject(e.target.value as any)}
                        className="w-full p-4 bg-atlas-dark border border-gray-700 rounded-2xl text-white outline-none focus:border-atlas-primary transition-all cursor-pointer"
                    >
                        <option>Physics</option>
                        <option>Chemistry</option>
                        <option>Botany</option>
                        <option>Zoology</option>
                    </select>
                </div>

                <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2 ml-1">Document Source (PDF)</label>
                    <div className="relative group">
                        <input 
                            type="file" 
                            accept=".pdf" 
                            onChange={handleFileChange} 
                            className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                        />
                        <div className="w-full p-10 border-2 border-dashed border-gray-700 rounded-2xl bg-atlas-dark text-center group-hover:border-atlas-primary/50 transition-all">
                             <SparklesIcon className="h-10 w-10 text-gray-700 mx-auto mb-3" />
                             <p className="text-gray-400 font-bold text-sm">{file ? file.name : 'Click to Browse PDF'}</p>
                        </div>
                    </div>
                </div>
                
                {error && <p className="text-red-500 text-xs font-bold text-center italic">{error}</p>}
                
                <div className="pt-6">
                    <button type="submit" disabled={isUploading} className="w-full bg-atlas-primary text-white font-black py-5 rounded-2xl shadow-glow hover:bg-emerald-600 transition-all uppercase tracking-widest text-sm active:scale-95 disabled:opacity-50">
                        {isUploading ? 'Securing Transfer...' : 'Deliver Document'}
                    </button>
                </div>
            </form>
        </div>
      </div>
    </div>
  );
};

export default SharePaperModal;
