import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../services/supabase';

// SVG Icons
const FlagIcon = ({ filled }: { filled?: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill={filled ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a15.26 15.26 0 019.318 0M3 14.5h11.511c1.54 0 3.04-.326 4.38-.94l3.111-1.372V4.5l-3.111 1.372a15.26 15.26 0 01-4.38.94H3" />
  </svg>
);

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
  
  // CBT Engine States
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set()); // Stores IDs of flagged questions
  const [currentIndex, setCurrentIndex] = useState(0); // Tracks current question index
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [scoreData, setScoreData] = useState<{ score: number, correct: number, total: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- 1. Fetch Test & Restore Session ---
  useEffect(() => {
    const fetchTest = async () => {
      try {
        if (!testId) throw new Error("No Test ID provided.");

        const { data: testData, error: testError } = await supabase.from('tests').select('*').eq('id', testId).single();
        if (testError) throw testError;
        if (!testData) throw new Error("Test not found.");

        const now = new Date();
        const start = new Date(testData.start_window);
        const end = new Date(testData.end_window);
        if (now < start) throw new Error(`Test has not started yet. Opens at ${start.toLocaleString()}`);
        if (now > end) throw new Error(`Test has expired. Closed at ${end.toLocaleString()}`);

        setTestDetails(testData);

        const { data: qData, error: qError } = await supabase.from('mcqs').select('*').in('id', testData.question_ids);
        if (qError) throw qError;
        setQuestions(qData || []);

        // RESTORE SESSION FROM LOCAL STORAGE
        const savedSession = localStorage.getItem(`test_session_${testId}`);
        if (savedSession) {
          const session = JSON.parse(savedSession);
          setGuestName(session.guestName || '');
          setGuestEmail(session.guestEmail || '');
          if (session.flagged) setFlagged(new Set(session.flagged));
          
          const currentTimestamp = Date.now();
          if (session.endTime && currentTimestamp < session.endTime) {
            setAnswers(session.answers || {});
            setTestStage('active');
          } else if (session.endTime && currentTimestamp >= session.endTime) {
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

  // --- 2. Timer & Sync ---
  useEffect(() => {
    if (testStage !== 'active') return;

    let endTime = 0;
    const sessionStr = localStorage.getItem(`test_session_${testId}`);
    if (sessionStr && JSON.parse(sessionStr).endTime) {
      endTime = JSON.parse(sessionStr).endTime;
    } else {
      endTime = Date.now() + (testDetails.duration_minutes * 60 * 1000);
      localStorage.setItem(`test_session_${testId}`, JSON.stringify({ guestName, guestEmail, answers, flagged: Array.from(flagged), endTime }));
    }

    const timer = setInterval(() => {
      const remaining = Math.round((endTime - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(timer);
        setTimeLeft(0);
        submitTestEngine(answers, questions, guestName, guestEmail);
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [testStage, testId]);

  // Sync state to local storage when answers or flags change
  useEffect(() => {
    if (testStage === 'active') {
      const sessionStr = localStorage.getItem(`test_session_${testId}`);
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        localStorage.setItem(`test_session_${testId}`, JSON.stringify({ ...session, answers, flagged: Array.from(flagged) }));
      }
    }
  }, [answers, flagged]);

  // --- Handlers ---
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !guestEmail.trim()) return alert("Please fill in all fields");
    setTestStage('instructions');
  };

  const toggleFlag = (id: string) => {
    setFlagged(prev => {
      const newFlagged = new Set(prev);
      if (newFlagged.has(id)) newFlagged.delete(id);
      else newFlagged.add(id);
      return newFlagged;
    });
  };

  const handleOptionSelect = (questionId: string, option: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: option }));
  };

  const submitTestEngine = async (currentAnswers: Record<string, string>, currentQuestions: any[], finalName: string, finalEmail: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    let correctCount = 0;
    currentQuestions.forEach(q => { if (currentAnswers[q.id] === q.answer) correctCount++; });
    const finalScore = Math.round((correctCount / currentQuestions.length) * 100);
    const wrongCount = currentQuestions.length - correctCount;
    setScoreData({ score: finalScore, correct: correctCount, total: currentQuestions.length });
    
    try {
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
      localStorage.removeItem(`test_session_${testId}`);
      setTestStage('completed');
    } catch (err) {
      console.error(err);
      alert("Failed to save attempt to database, but results are shown locally.");
      setTestStage('completed');
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

  if (loading) return <div className="min-h-screen bg-atlas-dark flex items-center justify-center text-white font-mono">Loading Environment...</div>;
  if (error) return <div className="min-h-screen bg-atlas-dark flex items-center justify-center text-red-500 font-bold p-8 text-center">{error}</div>;

  const currentQ = questions[currentIndex];

  return (
    <div className="min-h-screen bg-atlas-dark text-white font-sans selection:bg-atlas-green/30">
      
      {/* Registration & Instructions remain mostly same, omitted for brevity, keeping existing structure */}
      {testStage === 'registration' && (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-atlas-soft border border-gray-800 rounded-3xl p-10 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-extrabold mb-2 text-center">Enter Test Portal</h2>
            <p className="text-gray-400 text-center mb-8 text-sm">Please provide your details.</p>
            <form onSubmit={handleRegister} className="space-y-4">
              <div><label className="text-xs font-bold text-gray-500 uppercase">Full Name</label><input required value={guestName} onChange={e => setGuestName(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 px-4 focus:border-atlas-green outline-none" /></div>
              <div><label className="text-xs font-bold text-gray-500 uppercase">Email Address</label><input required type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 px-4 focus:border-atlas-green outline-none" /></div>
              <button type="submit" className="w-full bg-atlas-green hover:bg-green-500 text-atlas-dark py-3 rounded-xl font-bold mt-6">Continue</button>
            </form>
          </div>
        </div>
      )}

      {testStage === 'instructions' && (
        <div className="max-w-3xl mx-auto pt-20 p-6">
          <div className="bg-atlas-soft border border-gray-800 rounded-3xl p-10 shadow-2xl">
            <h1 className="text-3xl font-extrabold mb-8">{testDetails.title}</h1>
            <div className="space-y-4 mb-10 text-gray-300">
              <ul className="list-disc list-inside space-y-2">
                <li>Time limit: {testDetails.duration_minutes} minutes.</li>
                <li>Your progress is auto-saved. Do not clear browser cache.</li>
                <li>You can navigate freely and flag questions for review.</li>
              </ul>
            </div>
            <button onClick={() => setTestStage('active')} className="w-full bg-atlas-green hover:bg-green-500 text-atlas-dark py-4 rounded-xl font-bold text-lg">Start Test</button>
          </div>
        </div>
      )}

      {/* NEW CBT ACTIVE VIEW */}
      {testStage === 'active' && currentQ && (
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <header className="bg-atlas-soft border-b border-gray-800 p-4 sticky top-0 z-50 flex justify-between items-center px-6">
            <h2 className="font-bold text-lg text-gray-200 hidden md:block">{testDetails.title}</h2>
            <div className={`font-mono text-xl font-bold px-4 py-2 rounded-xl border ${timeLeft && timeLeft < 60 ? 'bg-red-500/10 text-red-500 border-red-500/30 animate-pulse' : 'bg-gray-900 text-atlas-green border-gray-700'}`}>
              {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
            </div>
          </header>

          {/* Main Layout Grid */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            
            {/* Left Area: Active Question */}
            <main className="flex-1 p-6 md:p-10 overflow-y-auto">
              <div className="max-w-3xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-gray-400 font-bold tracking-widest uppercase text-sm">Question {currentIndex + 1} of {questions.length}</span>
                  <button onClick={() => toggleFlag(currentQ.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition border ${flagged.has(currentQ.id) ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'}`}>
                    <FlagIcon filled={flagged.has(currentQ.id)} /> {flagged.has(currentQ.id) ? 'Flagged' : 'Flag for Review'}
                  </button>
                </div>

                <div className="bg-atlas-soft border border-gray-800 rounded-2xl p-8 mb-8 shadow-xl">
                  <p className="text-xl font-medium text-gray-200 leading-relaxed mb-8">{currentQ.question}</p>
                  <div className="space-y-3">
                    {(() => {
                      let opts = currentQ.options;
                      if (typeof opts === 'string') { try { opts = JSON.parse(opts); } catch (e) { opts = []; } }
                      return (opts || []).map((opt: string, i: number) => {
                        const isSelected = answers[currentQ.id] === opt;
                        return (
                          <label key={i} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'bg-green-900/20 border-atlas-green shadow-[0_0_15px_rgba(46,204,113,0.15)]' : 'bg-gray-900/50 border-gray-700 hover:border-gray-500'}`}>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-atlas-green' : 'border-gray-500'}`}>
                              {isSelected && <div className="w-2.5 h-2.5 bg-atlas-green rounded-full" />}
                            </div>
                            <input type="radio" className="sr-only" checked={isSelected} onChange={() => handleOptionSelect(currentQ.id, opt)} />
                            <span className={`text-base ${isSelected ? 'text-white font-medium' : 'text-gray-300'}`}>{opt}</span>
                          </label>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Question Navigation Footer */}
                <div className="flex justify-between items-center">
                  <button onClick={() => setCurrentIndex(prev => prev - 1)} disabled={currentIndex === 0} className="px-6 py-3 rounded-xl font-bold bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
                    &larr; Previous
                  </button>
                  <button onClick={() => setCurrentIndex(prev => prev + 1)} disabled={currentIndex === questions.length - 1} className="px-6 py-3 rounded-xl font-bold bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
                    Next &rarr;
                  </button>
                </div>
              </div>
            </main>

            {/* Right Area: Sidebar Grid */}
            <aside className="w-full md:w-80 bg-atlas-soft border-l border-gray-800 flex flex-col h-auto md:h-[calc(100vh-73px)]">
              <div className="p-6 flex-1 overflow-y-auto">
                <h3 className="font-bold text-gray-400 uppercase tracking-wider text-xs mb-4">Question Navigation</h3>
                <div className="grid grid-cols-5 gap-2 mb-8">
                  {questions.map((q, idx) => {
                    const isAnswered = !!answers[q.id];
                    const isFlagged = flagged.has(q.id);
                    const isActive = currentIndex === idx;
                    
                    let bgClass = "bg-gray-800 text-gray-400 border-gray-700"; // Default
                    if (isAnswered) bgClass = "bg-atlas-green/20 text-atlas-green border-atlas-green/50";
                    if (isFlagged) bgClass = "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
                    if (isAnswered && isFlagged) bgClass = "bg-yellow-500 text-gray-900 font-extrabold"; // Flagged + Answered Priority
                    
                    const ringClass = isActive ? "ring-2 ring-white ring-offset-2 ring-offset-atlas-dark" : "";

                    return (
                      <button 
                        key={q.id} 
                        onClick={() => setCurrentIndex(idx)}
                        className={`h-10 w-10 flex items-center justify-center rounded-lg border text-sm font-bold transition hover:opacity-80 ${bgClass} ${ringClass}`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-2 text-xs text-gray-400">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-atlas-green/20 border border-atlas-green/50" /> Answered</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-yellow-500/20 border border-yellow-500/50" /> Flagged</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-gray-800 border border-gray-700" /> Unanswered</div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-800 bg-gray-900/50">
                <p className="text-center text-sm mb-4 text-gray-400">Answered: <span className="text-white font-bold">{Object.keys(answers).length}</span> / {questions.length}</p>
                <button 
                  onClick={() => window.confirm('Are you sure you want to submit your final answers?') && submitTestEngine(answers, questions, guestName, guestEmail)}
                  disabled={isSubmitting}
                  className="w-full bg-atlas-green hover:bg-green-500 text-atlas-dark py-4 rounded-xl font-bold text-lg transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Grading...' : 'Submit Final Test'}
                </button>
              </div>
            </aside>

          </div>
        </div>
      )}

      {/* Completed State (remains same) */}
      {testStage === 'completed' && scoreData && (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-atlas-soft border border-gray-800 rounded-3xl p-10 max-w-md w-full text-center shadow-2xl relative overflow-hidden">
            <h2 className="text-3xl font-extrabold mb-2 relative z-10">Test Completed!</h2>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 mb-8 relative z-10 mt-6">
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Final Score</p>
              <div className={`text-6xl font-extrabold mb-4 ${scoreData.score >= 50 ? 'text-atlas-green' : 'text-red-500'}`}>{scoreData.score}%</div>
              <p className="text-gray-400 font-medium">{scoreData.correct} out of {scoreData.total} correct</p>
            </div>
            <button onClick={() => navigate('/')} className="w-full bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition">Return Home</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TakeTest;
