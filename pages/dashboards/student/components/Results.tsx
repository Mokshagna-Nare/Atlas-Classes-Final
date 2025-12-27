
import React, { useState } from 'react';
import { useData } from '../../../../contexts/DataContext';
import { useAuth } from '../../../../contexts/AuthContext';
import { ChevronDownIcon, ChevronUpIcon, StarIcon, CheckCircleIcon, XIcon, InformationCircleIcon } from '../../../../components/icons';

const Results: React.FC = () => {
    const { tests, results } = useData();
    const { user } = useAuth()!;
    const [expandedTestId, setExpandedTestId] = useState<string | null>(null);
    const [reviewingTestId, setReviewingTestId] = useState<string | null>(null);

    const studentResults = results.filter(r => r.studentId === user?.id);

    const ReviewModal = ({ testId }: { testId: string }) => {
        const test = tests.find(t => t.id === testId);
        const result = studentResults.find(r => r.testId === testId);
        if (!test || !result || !test.questions) return null;

        return (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[100] p-4 md:p-8 animate-scale-in">
                <div className="bg-atlas-soft border border-gray-800 w-full max-w-5xl max-h-[90vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col">
                    <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-atlas-dark/50">
                        <div>
                            <h3 className="text-2xl font-bold text-white">{test.title}</h3>
                            <p className="text-atlas-text-muted text-sm uppercase tracking-widest font-bold mt-1">Detailed Analysis • {result.score}/{result.maxScore} Marks</p>
                        </div>
                        <button onClick={() => setReviewingTestId(null)} className="p-3 bg-gray-800 hover:bg-gray-700 rounded-2xl transition-colors text-white">
                            <XIcon className="h-6 w-6" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {test.questions.map((q, idx) => {
                            const userAnswer = result.studentAnswers?.[idx.toString()];
                            const isCorrect = userAnswer === q.answer;
                            const isUnanswered = !userAnswer;

                            return (
                                <div key={idx} className={`p-6 rounded-2xl border transition-all ${isCorrect ? 'bg-emerald-500/5 border-emerald-500/20' : isUnanswered ? 'bg-gray-800/20 border-gray-800' : 'bg-red-500/5 border-red-500/20'}`}>
                                    <div className="flex gap-4">
                                        <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-lg ${isCorrect ? 'bg-emerald-500 text-white' : isUnanswered ? 'bg-gray-700 text-gray-400' : 'bg-red-500 text-white'}`}>
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-lg font-bold text-white mb-4">{q.question}</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className={`p-4 rounded-xl border ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-gray-800/50 border-gray-700'}`}>
                                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Your Response</p>
                                                    <p className={`font-bold ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>{userAnswer || 'Not Attempted'}</p>
                                                </div>
                                                {!isCorrect && (
                                                    <div className="p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/20">
                                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Correct Answer</p>
                                                        <p className="font-bold text-emerald-400">{q.answer}</p>
                                                    </div>
                                                )}
                                            </div>
                                            {q.explanation && (
                                                <div className="mt-4 p-4 bg-atlas-dark rounded-xl border border-gray-800 flex gap-3">
                                                    <InformationCircleIcon className="h-5 w-5 text-atlas-primary flex-shrink-0" />
                                                    <div>
                                                        <p className="text-[10px] font-bold text-atlas-primary uppercase tracking-widest mb-1">Explanation</p>
                                                        <p className="text-sm text-atlas-text-muted italic">{q.explanation}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-extrabold text-white">Completed Tests</h2>
                    <p className="text-atlas-text-muted text-sm font-semibold uppercase tracking-widest mt-1">Academic history and analytics</p>
                </div>
            </div>

            {studentResults.length === 0 ? (
                <div className="bg-atlas-soft/40 border border-gray-800 p-12 rounded-3xl text-center">
                    <p className="text-gray-500 font-bold uppercase tracking-widest">No completed tests found</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {studentResults.map(result => {
                        const test = tests.find(t => t.id === result.testId);
                        const isExpanded = expandedTestId === result.testId;
                        return (
                            <div key={result.testId} className="group bg-atlas-soft/40 border border-gray-800 rounded-3xl overflow-hidden transition-all hover:border-atlas-primary/30">
                                <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-white">{test?.title || 'Unknown Test'}</h3>
                                        <div className="flex items-center gap-4 mt-1">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{test?.date}</span>
                                            <span className="w-1 h-1 rounded-full bg-gray-700"></span>
                                            <span className="text-[10px] font-bold text-atlas-primary uppercase tracking-widest">{test?.subject}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-8">
                                        <div className="text-center px-6 border-x border-gray-800">
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Score</p>
                                            <p className="text-2xl font-black text-atlas-primary">{result.score}/{result.maxScore}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Grade</p>
                                            <p className={`text-2xl font-black ${result.grade === 'A+' ? 'text-emerald-400' : 'text-white'}`}>{result.grade}</p>
                                        </div>
                                        <button 
                                            onClick={() => setReviewingTestId(result.testId)}
                                            className="px-6 py-3 bg-atlas-primary text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-emerald-500 transition-all shadow-lg active:scale-95"
                                        >
                                            View Details
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {reviewingTestId && <ReviewModal testId={reviewingTestId} />}
        </div>
    );
};

export default Results;
