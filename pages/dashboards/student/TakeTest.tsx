import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../services/supabase';

const TakeTest: React.FC = () => {
  const { testId } = useParams();
  const navigate = useNavigate();

  // Core Data
  const [testDetails, setTestDetails] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  
  // UI States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testStage, setTestStage] = useState<'registration' | 'instructions' | 'active' | 'completed'>('registration');
  
  // User & Execution States
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [scoreData, setScoreData] = useState<{ score: number, correct: number, total: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- 1. Fetch Test & Restore Session ---
  useEffect(() => {
    const fetchTest = async () => {
      try {
        if (!testId) throw new Error("No Test ID provided.");

        // Fetch Test Metadata
        const { data: testData, error: testError } = await supabase.from('tests').select('*').eq('id', testId).single();
        if (testError) throw testError;
        if (!testData) throw new Error("Test not found.");

        const now = new Date();
        const start = new Date(testData.start_window);
        const end = new Date(testData.end_window);
        if (now < start) throw new Error(`Test has not started yet. Opens at ${start.toLocaleString()}`);
        if (now > end) throw new Error(`Test has expired. Closed at ${end.toLocaleString()}`);

        setTestDetails(testData);

        // Fetch Questions
        const { data: qData, error: qError } = await supabase.from('mcqs').select('*').in('id', testData.question_ids);
        if (qError) throw qError;
        setQuestions(qData || []);

        // --- RESTORE SESSION FROM LOCAL STORAGE ---
        const savedSession = localStorage.getItem(`test_session_${testId}`);
        if (savedSession) {
          const session = JSON.parse(savedSession);
          setGuestName(session.guestName || '');
          setGuestEmail(session.guestEmail || '');
          
          const currentTimestamp = Date.now();
          if (session.endTime && currentTimestamp < session.endTime) {
            setAnswers(session.answers || {});
            setTestStage('active');
          } else if (session.endTime && currentTimestamp >= session.endTime) {
            // Time ran out while they were disconnected
            setAnswers(session.answers || {});
            await submitTestEngine(session.answers || {}, qData || [], session.guestName, session.guestEmail);
          }
        }
      } catch (err: any) {
        setError(err.message || 'An error occurred loading the test.');
      } finally {
        setLoading(false);
      }
    };
    fetchTest();
  }, [testId]);

  // --- 2. Timer & Local Storage Sync Logic ---
  useEffect(() => {
    if (testStage !== 'active') return;

    let endTime = 0;
    const sessionStr = localStorage.getItem(`test_session_${testId}`);
    
    if (sessionStr && JSON.parse(sessionStr).endTime) {
      endTime = JSON.parse(sessionStr).endTime;
    } else {
      // First time starting the test: Calculate exact end time
      endTime = Date.now() + (testDetails.duration_minutes * 60 * 1000);
      localStorage.setItem(`test_session_${testId}`, JSON.stringify({ guestName, guestEmail, answers, endTime }));
    }

    const timer = setInterval(() => {
      const remaining = Math.round((endTime - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(timer);
        setTimeLeft(0);
        submitTestEngine(answers, questions, guestName, guestEmail); // Auto submit
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [testStage, testId]);

  // Sync answers to local storage whenever they change
  useEffect(() => {
    if (testStage === 'active') {
      const sessionStr = localStorage.getItem(`test_session_${testId}`);
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        localStorage.setItem(`test_session_${testId}`, JSON.stringify({ ...session, answers }));
      }
    }
  }, [answers]);

  // --- Handlers ---
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !guestEmail.trim()) return alert("Please fill in all fields");
    setTestStage('instructions');
  };

  const handleStartTest = () => {
    setTestStage('active');
  };

  const handleOptionSelect = (questionId: string, option: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: option }));
  };

  // --- Core Grading & Database Engine ---
  const submitTestEngine = async (currentAnswers: Record<string, string>, currentQuestions: any[], finalName: string, finalEmail: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    let correctCount = 0;
    currentQuestions.forEach(q => {
      if (currentAnswers[q.id] === q.answer) correctCount++;
    });

    const finalScore = Math.round((correctCount / currentQuestions.length) * 100);
    const wrongCount = currentQuestions.length - correctCount;
    setScoreData({ score: finalScore, correct: correctCount, total: currentQuestions.length });
    
    try {
      // Save result to Supabase
      const { error: dbError } = await supabase.from('test_attempts').insert({
        test_id: testId,
        guest_name: finalName,
        guest_email: finalEmail,
        score: finalScore,
        total_correct: correctCount,
        total_wrong: wrongCount,
        status: 'finished',
        end_time: new Date().toISOString()
      });

      if (dbError) throw dbError;
      
      // Clear the local storage session to prevent retakes
      localStorage.removeItem(`test_session_${testId}`);
      setTestStage('completed');
    } catch (err) {
      console.error("Failed to save test attempt:", err);
      alert("Test submitted, but failed to save to database. Please contact an admin.");
      setTestStage('completed'); // Still show completion screen
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  // --- Render Views ---
  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white font-mono">Loading Environment...</div>;
  if (error) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-red-500 font-bold p-8 text-center">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans selection:bg-blue-500/30">
      
      {/* VIEW 1: REGISTRATION */}
      {testStage === 'registration' && (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-3xl p-10 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-extrabold mb-2 text-center text-white">Enter Test Portal</h2>
            <p className="text-gray-400 text-center mb-8 text-sm">Please provide your details to access the exam.</p>
            
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 block">Full Name</label>
                <input required type="text" value={guestName} onChange={e => setGuestName(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 px-4 focus:border-blue-500 outline-none transition" placeholder="e.g. Jane Doe" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 block">Email Address</label>
                <input required type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 px-4 focus:border-blue-500 outline-none transition" placeholder="e.g. jane@example.com" />
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold mt-6 transition shadow-lg shadow-blue-900/20">
                Continue to Instructions
              </button>
            </form>
          </div>
        </div>
      )}

      {/* VIEW 2: INSTRUCTIONS */}
      {testStage === 'instructions' && (
        <div className="max-w-3xl mx-auto pt-20 p-6 animate-fade-in">
          <div className="bg-gray-800 border border-gray-700 rounded-3xl p-10 shadow-2xl">
            <h1 className="text-4xl font-extrabold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-400">
              {testDetails.title}
            </h1>
            
            <div className="grid grid-cols-2 gap-4 mb-8 bg-gray-900/50 p-6 rounded-2xl border border-gray-800">
              <div>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Total Questions</p>
                <p className="text-2xl font-bold">{questions.length}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Time Limit</p>
                <p className="text-2xl font-bold">{testDetails.duration_minutes} Minutes</p>
              </div>
            </div>

            <div className="space-y-4 mb-10 text-gray-300">
              <h3 className="font-bold text-white text-lg">Instructions:</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Once you start, the timer cannot be paused.</li>
                <li>If your browser reloads, your progress is saved, but the timer keeps running.</li>
                <li>When the timer reaches zero, your test will auto-submit.</li>
                <li>Ensure you have a stable internet connection before submitting.</li>
              </ul>
            </div>

            <button onClick={handleStartTest} className="w-full bg-green-600 hover:bg-green-500 text-white py-4 rounded-xl font-bold text-lg transition shadow-[0_0_20px_rgba(22,163,74,0.3)]">
              I understand, Start Test
            </button>
          </div>
        </div>
      )}

      {/* VIEW 3: ACTIVE TEST */}
      {testStage === 'active' && (
        <div className="max-w-4xl mx-auto pt-8 p-4 pb-32">
          {/* Floating Header */}
          <div className="sticky top-4 z-50 bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-2xl p-4 flex justify-between items-center shadow-2xl mb-8">
            <h2 className="font-bold text-lg truncate pr-4 text-gray-200">{testDetails.title}</h2>
            <div className={`font-mono text-2xl font-bold px-4 py-2 rounded-xl border ${timeLeft && timeLeft < 60 ? 'bg-red-500/10 text-red-500 border-red-500/30 animate-pulse' : 'bg-gray-800 text-green-400 border-gray-700'}`}>
              {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-8">
            {questions.map((q, index) => {
              let opts = q.options;
              if (typeof opts === 'string') { try { opts = JSON.parse(opts); } catch (e) { opts = []; } }

              return (
                <div key={q.id} className="bg-gray-800 border border-gray-700 p-6 md:p-8 rounded-2xl shadow-lg">
                  <div className="flex gap-4 mb-6">
                    <span className="flex-shrink-0 bg-blue-600/20 text-blue-400 h-8 w-8 flex items-center justify-center rounded-lg font-bold">
                      {index + 1}
                    </span>
                    <p className="text-lg font-medium text-gray-200 leading-relaxed pt-1">
                      {q.question}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(opts || []).map((opt: string, i: number) => {
                      const isSelected = answers[q.id] === opt;
                      return (
                        <label key={i} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'bg-blue-900/20 border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.15)]' : 'bg-gray-900/50 border-gray-700 hover:border-gray-500 hover:bg-gray-800'}`}>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-blue-500' : 'border-gray-500'}`}>
                            {isSelected && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />}
                          </div>
                          <input type="radio" name={`question-${q.id}`} className="sr-only" checked={isSelected} onChange={() => handleOptionSelect(q.id, opt)} />
                          <span className={`text-sm ${isSelected ? 'text-white font-medium' : 'text-gray-400'}`}>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Submit Footer */}
          <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur border-t border-gray-800 p-4 z-40">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <p className="text-sm text-gray-400 font-medium hidden md:block">
                Answered: <span className="text-white">{Object.keys(answers).length}</span> / {questions.length}
              </p>
              <button 
                onClick={() => window.confirm('Are you sure you want to submit your final answers?') && submitTestEngine(answers, questions, guestName, guestEmail)}
                disabled={isSubmitting}
                className="w-full md:w-auto bg-green-600 hover:bg-green-500 text-white px-10 py-3 rounded-xl font-bold text-lg transition disabled:opacity-50"
              >
                {isSubmitting ? 'Grading Test...' : 'Submit Test'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: COMPLETED / RESULTS */}
      {testStage === 'completed' && scoreData && (
        <div className="min-h-screen flex items-center justify-center p-4 animate-scale-in">
          <div className="bg-gray-800 border border-gray-700 rounded-3xl p-10 max-w-md w-full text-center shadow-2xl relative overflow-hidden">
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 blur-[100px] opacity-20 pointer-events-none ${scoreData.score >= 50 ? 'bg-green-500' : 'bg-red-500'}`} />

            <h2 className="text-3xl font-extrabold mb-2 relative z-10">Test Completed!</h2>
            <p className="text-gray-400 mb-8 relative z-10">Thank you, {guestName}. Your results are saved.</p>
            
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 mb-8 relative z-10">
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Final Score</p>
              <div className={`text-6xl font-extrabold mb-4 ${scoreData.score >= 50 ? 'text-green-500' : 'text-red-500'}`}>
                {scoreData.score}%
              </div>
              <p className="text-gray-400 font-medium">
                {scoreData.correct} out of {scoreData.total} correct
              </p>
            </div>

            <button onClick={() => navigate('/')} className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl font-bold transition relative z-10">
              Return to Website
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default TakeTest;
