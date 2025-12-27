
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../services/supabase';
import { useData } from '../../../contexts/DataContext';

const TakeTestPage: React.FC = () => {
    const { testId } = useParams<{ testId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { tests } = useData();
    
    const [attemptId, setAttemptId] = useState<string | null>(null);
    const [questions, setQuestions] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
    const [endTime, setEndTime] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!user) {
            navigate('/auth/student-login');
        }
    }, [user, navigate]);

    useEffect(() => {
        const initializeTest = async () => {
            setIsLoading(true);
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

            const loadLocalTest = () => {
                try {
                    const localTest = tests.find(t => String(t.id) === String(testId));
                    if (localTest && localTest.questions && localTest.questions.length > 0) {
                        setAttemptId(`local-${Date.now()}`);
                        const durationMinutes = localTest.duration ?? 30;
                        setEndTime(new Date(Date.now() + (durationMinutes * 60 * 1000)).toISOString());
                        const normalizedLocal = localTest.questions.map((q: any, idx: number) => ({
                            id: q.id ?? `q-local-${idx}`,
                            question_text: q.question ?? q.question_text ?? '',
                            options: q.options ?? []
                        }));
                        setQuestions(normalizedLocal);
                    } else {
                        alert('Local test not found or has no questions. Contact admin.');
                        navigate('/dashboard/student');
                    }
                } catch (innerErr) {
                    alert('Error loading local test: ' + innerErr);
                    navigate('/dashboard/student');
                } finally {
                    setIsLoading(false);
                }
            };

            if (testId && uuidRegex.test(testId)) {
                try {
                    // Call the SQL function we created in Supabase
                    const { data, error } = await supabase.rpc('start_student_test', { p_test_id: testId });
                    if (error) throw error;

                    setAttemptId(data.attemptId);
                    setEndTime(data.endTime);
                    const normalized = (data.questions || []).map((q: any, idx: number) => ({
                        id: q.id ?? `q-${idx}`,
                        question_text: q.question ?? '',
                        options: q.options ?? [],
                    }));
                    setQuestions(normalized);
                    setIsLoading(false);
                } catch (err: any) {
                    const msg = err?.message || String(err || '');
                     // If RPC fails (e.g. not found, network), fall back to local test
                    console.warn(`Supabase RPC failed ('${msg}'), falling back to local test search.`);
                    loadLocalTest();
                }
            } else {
                // If testId is not a valid UUID, assume it's a local test
                console.warn(`Invalid or missing UUID for testId: "${testId}". Searching for local test.`);
                loadLocalTest();
            }
        };

        if (testId) initializeTest();
        else {
            alert('No test ID provided!');
            navigate('/dashboard/student');
        }
    }, [testId, tests, navigate]);

    const handleOptionSelect = async (option: string) => {
        const questionId = questions[currentIndex].id;
        setSelectedAnswers(prev => ({ ...prev, [questionId]: option }));

        // Send answer to server immediately (Idempotent)
        await supabase.from('attempt_answers').upsert({
            attempt_id: attemptId,
            question_id: questionId,
            selected_option: option
        });
    };

    const handleFinish = async () => {
        setIsSubmitting(true);
        try {
            const { data, error } = await supabase.rpc('finish_student_test', { p_attempt_id: attemptId });
            if (error) throw error;
            alert(`Test Completed! Score: ${data.score}/${data.total_questions}`);
            navigate('/dashboard/student');
        } catch (err: any) {
            alert(`Error finishing test: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) return <div className="min-h-screen bg-atlas-dark flex items-center justify-center">Loading Secure Test Environment...</div>;

    if (!questions || questions.length === 0) return <div className="min-h-screen bg-atlas-dark flex items-center justify-center">No questions available for this test.</div>;

    const q = questions[currentIndex];

    return (
        <div className="min-h-screen bg-atlas-dark text-white flex flex-col md:flex-row">
            {/* Question Palette */}
            <aside className="w-full md:w-64 bg-atlas-soft border-r border-gray-800 p-6">
                <h2 className="font-bold mb-4">Questions</h2>
                <div className="grid grid-cols-4 gap-2">
                    {questions.map((_, i) => (
                        <button 
                            key={i}
                            onClick={() => setCurrentIndex(i)}
                            className={`p-2 rounded font-bold ${currentIndex === i ? 'bg-atlas-primary text-white' : 'bg-gray-800'}`}
                        >
                            {i + 1}
                        </button>
                    ))}
                </div>
                <div className="mt-8">
                    <button 
                        onClick={handleFinish}
                        disabled={isSubmitting}
                        className="w-full bg-atlas-primary py-3 rounded-lg font-bold shadow-glow"
                    >
                        {isSubmitting ? 'Finalizing...' : 'Submit Test'}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 md:p-12 overflow-y-auto">
                <div className="max-w-3xl mx-auto">
                    <div className="mb-8 flex justify-between items-center">
                        <span className="text-gray-500 uppercase font-black text-xs">Question {currentIndex + 1} of {questions.length}</span>
                        <span className="text-atlas-primary font-mono font-bold">Time Ends: {endTime ? new Date(endTime).toLocaleTimeString() : ''}</span>
                    </div>

                    <h3 className="text-2xl font-bold mb-8">{q.question_text}</h3>

                    <div className="space-y-4">
                        {q.options.map((opt: string, i: number) => (
                            <button 
                                key={i}
                                onClick={() => handleOptionSelect(opt)}
                                className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
                                    selectedAnswers[q.id] === opt ? 'border-atlas-primary bg-atlas-primary/10' : 'border-gray-800 bg-atlas-soft hover:border-gray-700'
                                }`}
                            >
                                <span className="font-black mr-4 text-atlas-primary">{String.fromCharCode(65 + i)}</span>
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default TakeTestPage;
