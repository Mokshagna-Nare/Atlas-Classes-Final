
import React, { useState } from 'react';
import { convertHtmlToTest } from '../../../../services/geminiService';
import { Question, Test } from '../../../../types';
import { SparklesIcon, DocumentTextIcon, ArrowRightIcon, UserGroupIcon, CodeBracketIcon } from '../../../../components/icons';
import { useData } from '../../../../contexts/DataContext';
import { useAuth } from '../../../../contexts/AuthContext';

const AIPaperGenerator: React.FC = () => {
    // Upload State
    const [htmlFile, setHtmlFile] = useState<File | null>(null);
    const [filePreviewName, setFilePreviewName] = useState('');

    // Common State
    const [isLoading, setIsLoading] = useState(false);
    const [generatedQuestions, setGeneratedQuestions] = useState<Question[] | null>(null);
    const [generatedTitle, setGeneratedTitle] = useState('');
    const [generatedSubject, setGeneratedSubject] = useState('');
    const [error, setError] = useState<string | null>(null);
    
    // Admin Specific State
    const { addTest, institutes } = useData();
    const [targetInstituteId, setTargetInstituteId] = useState<string>(institutes.length > 0 ? institutes[0].id : '');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            // Check for HTML extension or MIME type
            if (file.type === 'text/html' || file.name.endsWith('.html') || file.name.endsWith('.htm')) {
                setHtmlFile(file);
                setFilePreviewName(file.name);
                setError('');
                // Reset previous generations when new file selected
                setGeneratedQuestions(null);
            } else {
                setError('Please upload a valid HTML file (.html, .htm).');
                setHtmlFile(null);
            }
        }
    };

    const fileToText = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsText(file);
            reader.onload = () => {
                resolve(reader.result as string);
            };
            reader.onerror = error => reject(error);
        });
    };

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!htmlFile) {
            setError('Please select an HTML file first.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setGeneratedQuestions(null);

        try {
            const htmlContent = await fileToText(htmlFile);
            const result = await convertHtmlToTest(htmlContent);
            
            if (!result.questions || result.questions.length === 0) {
                throw new Error("No questions detected. Please check if the HTML file contains text.");
            }

            setGeneratedQuestions(result.questions);
            setGeneratedTitle(result.testTitle || filePreviewName.replace(/\.html?$/, ''));
            setGeneratedSubject(result.subject || 'Mixed');
        } catch (err: any) {
            console.error(err);
            const errorMessage = err.message || 'Failed to process request.';
            setError(`Error: ${errorMessage}`);
        }
        setIsLoading(false);
    };

    const handleSaveAsTest = async () => {
        if (!generatedQuestions) return;
        if (!targetInstituteId) {
            alert('Please select an institute to assign this test to.');
            return;
        }

        const selectedInstituteName = institutes.find(i => i.id === targetInstituteId)?.name || 'Institute';

        const newTest: Test = {
            id: crypto.randomUUID(),
            title: generatedTitle,
            subject: generatedSubject,
            date: new Date().toISOString().split('T')[0],
            status: 'Upcoming',
            institute_id: targetInstituteId,
            pdfFileName: filePreviewName, // Keeping key name for compatibility, storing HTML filename
            questions: generatedQuestions
        };

        await addTest(newTest);
        alert(`Test successfully created and assigned to ${selectedInstituteName}!`);
        
        // Reset
        setGeneratedQuestions(null);
        setHtmlFile(null);
        setFilePreviewName('');
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                 <div>
                    <h2 className="text-2xl font-bold text-atlas-primary">HTML Exam Converter</h2>
                    <p className="text-gray-400 text-sm mt-1">Convert HTML document code into interactive tests with AI.</p>
                 </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* Input Panel */}
                <form onSubmit={handleGenerate} className="md:col-span-4 space-y-6 bg-atlas-black p-6 rounded-2xl border border-gray-800 shadow-xl h-fit">
                    
                    {/* Admin: Select Institute */}
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2 flex items-center gap-2">
                            <UserGroupIcon className="h-4 w-4" />
                            Assign to Institute
                        </label>
                        <select 
                            value={targetInstituteId} 
                            onChange={(e) => setTargetInstituteId(e.target.value)} 
                            className="w-full p-3 bg-atlas-gray border border-gray-600 rounded-xl focus:outline-none focus:border-atlas-primary text-white"
                        >
                            {institutes.map(inst => (
                                <option key={inst.id} value={inst.id}>{inst.name} ({inst.id})</option>
                            ))}
                        </select>
                    </div>

                    <div className="border-t border-gray-800 pt-6">
                        <div className="text-center py-8 border-2 border-dashed border-gray-700 rounded-xl bg-atlas-gray/20 hover:bg-atlas-gray/40 transition-colors">
                             <DocumentTextIcon className="h-12 w-12 text-atlas-primary mx-auto mb-4" />
                             <p className="text-gray-300 font-bold mb-2">Upload HTML Paper</p>
                             <p className="text-gray-500 text-sm mb-6 px-4">Upload the .html file containing the questions.</p>
                             <label className="inline-block">
                                <span className="bg-atlas-gray border border-gray-600 text-white font-bold py-2 px-6 rounded-lg cursor-pointer hover:bg-gray-700 hover:border-white transition-all">
                                    Browse Files
                                </span>
                                <input type="file" accept=".html,.htm" onChange={handleFileChange} className="hidden"/>
                             </label>
                             {filePreviewName && (
                                 <div className="mt-4 flex items-center justify-center text-sm text-emerald-400 bg-emerald-900/20 py-2 mx-4 rounded">
                                     <span className="truncate max-w-[200px]">{filePreviewName}</span>
                                 </div>
                             )}
                        </div>
                    </div>

                    <button type="submit" disabled={isLoading} className="w-full flex justify-center items-center space-x-2 bg-gradient-to-r from-atlas-primary to-emerald-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-emerald-900/50 hover:shadow-emerald-900/70 hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isLoading ? (
                             <span className="animate-pulse">Processing...</span>
                        ) : (
                            <>
                                <SparklesIcon className="h-5 w-5" />
                                <span>Extract & Create Test</span>
                            </>
                        )}
                    </button>
                    {error && <p className="text-red-400 text-sm mt-2 text-center bg-red-900/20 p-2 rounded border border-red-900/50">{error}</p>}
                </form>

                {/* Preview Panel */}
                <div className="md:col-span-8 bg-atlas-black p-6 rounded-2xl border border-gray-800 shadow-xl min-h-[600px] flex flex-col">
                    <div className="flex justify-between items-center mb-6 pb-6 border-b border-gray-800">
                        <h3 className="text-xl font-bold text-white">Test Preview</h3>
                        {generatedQuestions && (
                            <button 
                                onClick={handleSaveAsTest}
                                className="flex items-center space-x-2 bg-white text-black font-bold py-2 px-5 rounded-lg hover:bg-gray-200 transition-colors shadow-glow animate-pulse-slow"
                            >
                                <span>Confirm & Assign</span>
                                <ArrowRightIcon className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    
                    <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
                        {isLoading ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                                <div className="w-16 h-16 border-4 border-atlas-primary border-t-transparent rounded-full animate-spin"></div>
                                <p className="animate-pulse text-lg">Parsing HTML & Generating Diagrams...</p>
                            </div>
                        ) : !generatedQuestions ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                                <DocumentTextIcon className="h-24 w-24 mb-4" />
                                <p className="text-lg">Generated content will appear here.</p>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-fade-in-up">
                                <div className="text-center mb-8">
                                    <h2 className="text-3xl font-bold text-white mb-2">{generatedTitle}</h2>
                                    <div className="flex justify-center gap-2">
                                        <span className="inline-block bg-atlas-gray px-3 py-1 rounded-full text-xs text-gray-400 uppercase tracking-widest">{generatedSubject}</span>
                                        <span className="inline-block bg-atlas-primary/20 px-3 py-1 rounded-full text-xs text-atlas-primary uppercase tracking-widest">{generatedQuestions.length} Questions</span>
                                    </div>
                                </div>
                                {generatedQuestions.map((q, index) => (
                                    <div key={index} className="bg-atlas-gray/40 p-6 rounded-xl border border-gray-700/50 hover:border-atlas-primary/30 transition-colors">
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="bg-atlas-black text-atlas-primary font-bold w-8 h-8 flex items-center justify-center rounded-lg text-sm">{index + 1}</span>
                                            <span className="text-xs text-gray-500 uppercase tracking-wider">{q.type}</span>
                                        </div>
                                        <p className="text-lg text-gray-200 font-medium mb-4">{q.question}</p>
                                        
                                        {/* SVG Diagram Rendering */}
                                        {q.diagramSvg ? (
                                             <div className="mb-6 p-4 bg-white rounded-lg flex items-center justify-center border border-gray-600">
                                                 <div 
                                                    className="w-full max-w-sm"
                                                    dangerouslySetInnerHTML={{ __html: q.diagramSvg }} 
                                                 />
                                             </div>
                                        ) : q.diagramDescription ? (
                                            <div className="mb-4 p-4 bg-black/40 border border-dashed border-gray-600 rounded-lg text-gray-400 text-sm italic flex items-center gap-3">
                                                 <CodeBracketIcon className="h-5 w-5" />
                                                 <span>[Diagram: {q.diagramDescription}]</span>
                                            </div>
                                        ) : null}

                                        {q.type === 'Multiple Choice' && q.options && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                                {q.options.map((opt, i) => (
                                                    <div key={i} className={`p-3 rounded-lg border text-sm ${opt === q.answer ? 'bg-green-900/20 border-green-500/50 text-green-300' : 'bg-atlas-black border-gray-700 text-gray-400'}`}>
                                                        <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span> {opt}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        
                                        <div className="flex items-center gap-2 text-sm mt-4 pt-4 border-t border-gray-700/50">
                                            <span className="text-gray-500 font-bold">Answer:</span>
                                            <span className="text-emerald-400 font-mono">{q.answer}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.02);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(16, 185, 129, 0.5);
                }
                svg {
                    max-width: 100%;
                    height: auto;
                }
            `}</style>
        </div>
    );
};

export default AIPaperGenerator;
