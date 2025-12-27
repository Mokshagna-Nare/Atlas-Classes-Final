import React from 'react';
import { useData } from '../../../../contexts/DataContext';
import { useAuth } from '../../../../contexts/AuthContext';
import { AdminQuestionPaper } from '../../../../types';

const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
};

const SharedPapers: React.FC = () => {
    const { adminQuestionPapers } = useData();
    const { user } = useAuth()!;

    const accessiblePapers = adminQuestionPapers.filter(paper => 
        paper.accessibleInstituteIds.includes(user!.id)
    );

    const handleDownload = (paper: AdminQuestionPaper) => {
        try {
            const blob = base64ToBlob(paper.fileContent, paper.mimeType);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = paper.fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Download failed:", error);
            alert("Could not download the file. It may be corrupted or in an unsupported format.");
        }
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-6 text-atlas-orange">Shared Question Papers</h2>
            <div className="bg-atlas-black p-4 rounded-lg">
                {accessiblePapers.length > 0 ? (
                    <ul className="space-y-3">
                        {accessiblePapers.map(paper => (
                            <li key={paper.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-atlas-gray rounded-md gap-3">
                                <div>
                                    <p className="font-bold">{paper.fileName}</p>
                                    <p className="text-sm text-gray-400">Subject: {paper.subject}</p>
                                </div>
                                <button 
                                    onClick={() => handleDownload(paper)} 
                                    className="bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-500 transition text-sm self-end sm:self-center"
                                >
                                    Download
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-center text-gray-500 py-8">No question papers have been shared with your institute yet.</p>
                )}
            </div>
        </div>
    );
};

export default SharedPapers;