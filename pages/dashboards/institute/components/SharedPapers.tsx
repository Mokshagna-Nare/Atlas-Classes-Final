import React, { useState } from 'react';
import { useData } from '../../../../contexts/DataContext';
import { useAuth } from '../../../../contexts/AuthContext';
import { AdminQuestionPaper } from '../../../../types';
import { GlobeAltIcon, DocumentDuplicateIcon, ArrowUpTrayIcon } from '../../../../components/icons';

const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const bytes = atob(base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mimeType });
};

const SharedPapers: React.FC = () => {
    const { adminQuestionPapers } = useData();
    const { user } = useAuth()!;
    const [error, setError] = useState('');

    const papers = adminQuestionPapers.filter(p => p.accessibleInstituteIds.includes(user!.id));

    const handleDownload = (paper: AdminQuestionPaper) => {
        setError('');
        try {
            const url = URL.createObjectURL(base64ToBlob(paper.fileContent, paper.mimeType));
            const a = document.createElement('a');
            a.href = url;
            a.download = paper.fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            setError(`Couldn't download “${paper.fileName}”. The file may be damaged.`);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-extrabold text-white">Shared Papers</h2>
                <p className="text-sm text-gray-500 mt-1">Question papers Atlas has shared with your institute.</p>
            </div>

            {error && <p role="alert" className="text-sm text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl p-3">{error}</p>}

            {papers.length === 0 ? (
                <div className="p-16 text-center border border-dashed border-white/10 rounded-3xl">
                    <GlobeAltIcon className="h-10 w-10 text-gray-700 mx-auto mb-4" />
                    <p className="text-sm font-semibold text-gray-300">Nothing shared with you yet</p>
                    <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">Papers Atlas shares with your institute will appear here, ready to download.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {papers.map(p => (
                        <div key={p.id} className="bg-atlas-dark border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-atlas-primary/25 transition-colors">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className="p-2.5 rounded-xl bg-atlas-primary/10 text-atlas-primary shrink-0"><DocumentDuplicateIcon className="h-5 w-5" /></div>
                                <div className="min-w-0">
                                    <p className="font-bold text-white truncate">{p.fileName}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{p.subject}</p>
                                </div>
                            </div>
                            <button onClick={() => handleDownload(p)} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black text-atlas-black bg-atlas-primary hover:bg-emerald-400 transition-colors shrink-0">
                                <ArrowUpTrayIcon className="h-4 w-4 rotate-180" /> Download
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SharedPapers;
