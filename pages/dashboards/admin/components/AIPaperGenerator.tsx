
import React, { useState } from 'react';
import { convertHtmlToTest } from '../../../../services/geminiService';
import { supabase } from '../../../../services/supabase';
import { Question } from '../../../../types';
import { SparklesIcon, DocumentTextIcon, ArrowRightIcon, CodeBracketIcon } from '../../../../components/icons';

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
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.type === 'text/html' || file.name.endsWith('.html') || file.name.endsWith('.htm')) {
                setHtmlFile(file);
                setFilePreviewName(file.name);
                setError('');
                // Reset previous generations
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
                throw new Error("No questions detected. Please ensure the HTML contains text content.");
            }

            setGeneratedQuestions(result.questions);
            setGeneratedTitle(result.testTitle || filePreviewName.replace(/\.html?$/, ''));
            setGeneratedSubject(result.subject || 'Mixed');
        } catch (err: any) {
            console.error(err);
            const errorMessage = err.message || 'Failed to process HTML.';
            setError(`Error: ${errorMessage}`);
        }
        setIsLoading(false);
    };

    // Persists the converted questions into the Question Bank, then saves them as a finalized
    // paper in offline_papers (same shape QuestionPaperGenerator writes), so it can be scheduled
    // and assigned from Create Online Test → "Load from Existing Paper".
    const handleSaveAsTest = async () => {
        if (!generatedQuestions || isSaving) return;
        setIsSaving(true);
        setError(null);
        setSaveMessage(null);
        try {
            const subject = generatedSubject || 'Mixed';
            const rows = generatedQuestions
                .map(q => {
                    const options = q.options && q.options.length >= 2 ? q.options : (q.type === 'True/False' ? ['True', 'False'] : null);
                    if (!options) return null; // online tests are multiple-choice only
                    const idx = options.findIndex(o => o.trim().toLowerCase() === (q.answer || '').trim().toLowerCase());
                    return {
                        question: q.question, type: 'Multiple Choice', options, answer: q.answer || '',
                        answer_index: idx >= 0 ? idx : null, explanation: q.explanation || '',
                        subject, topic: generatedTitle, sub_topic: '', difficulty: 'Medium', marks: 4,
                        question_type: 'MCQ', source: `HTML converter · ${filePreviewName}`, isFlagged: false,
                    };
                })
                .filter((r): r is NonNullable<typeof r> => r !== null);

            const skipped = generatedQuestions.length - rows.length;
            if (rows.length === 0) throw new Error('None of the converted questions are multiple-choice, so they can’t be used in an online test.');

            const { data: inserted, error: qErr } = await supabase.from('mcqs').insert(rows).select('id');
            if (qErr) throw qErr;
            const ids = (inserted || []).map((r: any) => r.id);

            const { error: pErr } = await supabase.from('offline_papers').insert([{
                title: generatedTitle, subject, duration: 60, question_ids: ids, total_marks: ids.length * 4,
                exam_date: new Date().toISOString().split('T')[0], assessment_type: 'Test', status: 'Finalized',
                tracks_enabled: false,
                subject_config: { [subject]: { track1: ids.length, track2: 0 } },
                question_allocations: { [subject]: { track1: ids, track2: [] } },
                downloads: 0, student_downloads: 0, teacher_downloads: 0,
            }]);
            if (pErr) throw pErr;

            setSaveMessage(`Saved ${ids.length} question${ids.length === 1 ? '' : 's'} to the Question Bank and created the paper “${generatedTitle}”.${skipped ? ` ${skipped} non-multiple-choice question${skipped === 1 ? ' was' : 's were'} skipped.` : ''} To schedule it for students, open Create Online Test → Load from Existing Paper.`);
            setGeneratedQuestions(null);
            setHtmlFile(null);
            setFilePreviewName('');
        } catch (err: any) {
            setError(`Couldn't save: ${err.message || 'unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                 <div>
                    <h2 className="text-2xl font-bold text-atlas-primary">HTML Exam Converter</h2>
                    <p className="text-gray-400 text-sm mt-1">Convert HTML document code into interactive tests.</p>
                 </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* Input Panel */}
                <form onSubmit={handleGenerate} className="md:col-span-4 space-y-6 bg-atlas-black p-6 rounded-2xl border border-gray-800 shadow-xl h-fit">
                    
                    <div className="text-center py-8 border-2 border-dashed border-gray-700 rounded-xl bg-atlas-gray/20 hover:bg-atlas-gray/40 transition-colors">
                         <DocumentTextIcon className="h-12 w-12 text-atlas-primary mx-auto mb-4" />
                         <p className="text-gray-300 font-bold mb-2">Upload HTML Paper</p>
                         <p className="text-gray-500 text-sm mb-6 px-4">Supports .html files. The AI will extract questions, options, and diagrams.</p>
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

                    <button type="submit" disabled={isLoading} className="w-full flex justify-center items-center space-x-2 bg-gradient-to-r from-atlas-primary to-emerald-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-emerald-900/50 hover:shadow-emerald-900/70 hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isLoading ? (
                             <span className="animate-pulse">Processing...</span>
                        ) : (
                            <>
                                <SparklesIcon className="h-5 w-5" />
                                <span>Convert & Extract</span>
                            </>
                        )}
                    </button>
                    {error && <p className="text-red-400 text-sm mt-2 text-center bg-red-900/20 p-2 rounded border border-red-900/50">{error}</p>}
                </form>

                {/* Preview Panel */}
                <div className="md:col-span-8 bg-atlas-black p-6 rounded-2xl border border-gray-800 shadow-xl min-h-[600px] flex flex-col">
                    <div className="flex justify-between items-center mb-6 pb-6 border-b border-gray-800">
                        <h3 className="text-xl font-bold text-white">Preview & Edit</h3>
                        {generatedQuestions && (
                            <button
                                onClick={handleSaveAsTest}
                                disabled={isSaving}
                                className="flex items-center space-x-2 bg-atlas-primary text-atlas-black font-bold py-2 px-5 rounded-lg hover:bg-emerald-400 transition-colors shadow-glow disabled:opacity-60 disabled:cursor-wait"
                            >
                                <span>{isSaving ? 'Saving…' : 'Save as Paper'}</span>
                                {!isSaving && <ArrowRightIcon className="h-4 w-4" />}
                            </button>
                        )}
                    </div>
                    {saveMessage && (
                        <div role="status" className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-sm text-emerald-100/90">{saveMessage}</div>
                    )}
                    
                    <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
                        {isLoading ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                                <div className="w-16 h-16 border-4 border-atlas-primary border-t-transparent rounded-full animate-spin"></div>
                                <p className="animate-pulse">Parsing HTML & Generating Diagrams...</p>
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
                                    <span className="inline-block bg-atlas-gray px-3 py-1 rounded-full text-xs text-gray-400 uppercase tracking-widest">{generatedSubject}</span>
                                </div>
                                {generatedQuestions.map((q, index) => (
                                    <div key={index} className="bg-atlas-gray/40 p-6 rounded-xl border border-gray-700/50 hover:border-atlas-primary/30 transition-colors">
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="bg-atlas-black text-atlas-primary font-bold w-8 h-8 flex items-center justify-center rounded-lg text-sm">{index + 1}</span>
                                            <span className="text-xs text-gray-500 uppercase tracking-wider">{q.type}</span>
                                        </div>
                                        <div className="text-lg text-gray-200 font-medium mb-4 prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: q.question }} />
                                        
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