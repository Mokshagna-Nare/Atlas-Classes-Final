import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { getCorrectOptionIndex } from '../../../utils/mcqAnswer';
import { replacePlaceholdersWithImages } from '../../../utils/imagePlaceholder';

// SVG Icons
const FlagIcon = ({ filled }: { filled?: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill={filled ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a15.26 15.26 0 019.318 0M3 14.5h11.511c1.54 0 3.04-.326 4.38-.94l3.111-1.372V4.5l-3.111 1.372a15.26 15.26 0 01-4.38.94H3" />
  </svg>
);

const TakeTest: React.FC = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const student = auth?.user?.role === 'student' ? auth.user : null;

  // Core Data
  const [testDetails, setTestDetails] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);

  // UI States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testStage, setTestStage] = useState<'registration' | 'instructions' | 'active' | 'completed'>('registration');
  const [priorAttempt, setPriorAttempt] = useState<{ score: number; total_correct: number; total_wrong: number } | null>(null);

  // CBT Engine States
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set()); // Stores IDs of flagged questions
  const [currentIndex, setCurrentIndex] = useState(0); // Tracks current question index
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [scoreData, setScoreData] = useState<{ score: number, correct: number, total: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Basic browser-lockdown proctoring (authenticated students only — guest/public
  // practice-test links are untouched and never enter fullscreen or get monitored).
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [fullscreenExitCount, setFullscreenExitCount] = useState(0);
  const [showFullscreenWarning, setShowFullscreenWarning] = useState(false);
  const PROCTOR_VIOLATION_LIMIT = 3;

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

        // Logged-in students taking an assigned test: verify their class is actually
        // assigned before letting them in (tests with zero assignment rows stay public/guest-open).
        if (student) {
          const { data: assignments } = await supabase.from('test_assignments').select('class_id').eq('test_id', testId);
          if (assignments && assignments.length > 0) {
            const isAssignedToMe = student.class_id && assignments.some((a: any) => a.class_id === student.class_id);
            if (!isAssignedToMe) throw new Error('This test has not been assigned to your class.');
          }

          const { data: existingAttempt } = await supabase
            .from('test_attempts')
            .select('score, total_correct, total_wrong')
            .eq('test_id', testId)
            .eq('student_id', student.id)
            .maybeSingle();
          if (existingAttempt) {
            setPriorAttempt(existingAttempt);
            setTestDetails(testData);
            setLoading(false);
            return;
          }
        }

        setTestDetails(testData);

        const { data: qData, error: qError } = await supabase.from('mcqs').select('*').in('id', testData.question_ids);
        if (qError) throw qError;
        setQuestions(qData || []);

        if (student) {
          // Authenticated students skip the guest registration screen entirely — go straight to instructions.
          setGuestName(student.name);
          setGuestEmail(student.email || '');
          setTestStage('instructions');
        }

        // RESTORE SESSION FROM LOCAL STORAGE
        const savedSession = localStorage.getItem(`test_session_${testId}`);
        if (savedSession) {
          const session = JSON.parse(savedSession);
          if (!student) {
            setGuestName(session.guestName || '');
            setGuestEmail(session.guestEmail || '');
          }
          if (session.flagged) setFlagged(new Set(session.flagged));

          const currentTimestamp = Date.now();
          if (session.endTime && currentTimestamp < session.endTime) {
            setAnswers(session.answers || {});
            setTestStage('active');
          } else if (session.endTime && currentTimestamp >= session.endTime) {
            setAnswers(session.answers || {});
            await submitTestEngine(session.answers || {}, qData || [], student ? student.name : session.guestName, student ? (student.email || '') : session.guestEmail);
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

  // --- 3. Proctoring: fullscreen-exit + tab-switch detection, copy/paste lockdown ---
  useEffect(() => {
    if (testStage !== 'active' || !student) return;

    const handleVisibilityChange = () => {
      if (document.hidden) setTabSwitchCount(c => c + 1);
    };
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setFullscreenExitCount(c => c + 1);
        setShowFullscreenWarning(true);
      } else {
        setShowFullscreenWarning(false);
      }
    };
    const blockAction = (e: Event) => e.preventDefault();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('copy', blockAction);
    document.addEventListener('cut', blockAction);
    document.addEventListener('paste', blockAction);
    document.addEventListener('contextmenu', blockAction);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('copy', blockAction);
      document.removeEventListener('cut', blockAction);
      document.removeEventListener('paste', blockAction);
      document.removeEventListener('contextmenu', blockAction);
    };
  }, [testStage, student]);

  const requestFullscreenLockdown = () => {
    if (!student) return;
    const el = document.documentElement as any;
    const request = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (request) request.call(el).catch(() => { /* non-fatal: some environments block it */ });
  };

  const exitFullscreenLockdown = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };

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

  const handleOptionSelect = (questionId: string, optionIndex: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const submitTestEngine = async (currentAnswers: Record<string, number | null>, currentQuestions: any[], finalName: string, finalEmail: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    let correctCount = 0;
    currentQuestions.forEach(q => {
      const selectedIndex = currentAnswers[q.id];
      if (selectedIndex === null || selectedIndex === undefined) {
        return; // Unanswered
      }

      // Try to get the correct option index using the helper function
      const correctIndex = getCorrectOptionIndex(q);

      if (correctIndex !== null) {
        // New format: compare indices
        if (selectedIndex === correctIndex) {
          correctCount++;
        }
      } else {
        // Fallback for old format: if we couldn't get index, try text comparison
        // Get the selected option text
        const selectedOptionText = q.options?.[selectedIndex];
        if (selectedOptionText && selectedOptionText === q.answer) {
          correctCount++;
        }
      }
    });
    
    const finalScore = Math.round((correctCount / currentQuestions.length) * 100);
    const wrongCount = currentQuestions.length - correctCount;
    setScoreData({ score: finalScore, correct: correctCount, total: currentQuestions.length });
    
    try {
      const { error: dbError } = await supabase.from('test_attempts').insert({
        test_id: testId,
        ...(student
          ? { student_id: student.id }
          : { guest_name: finalName, guest_email: finalEmail }),
        score: finalScore,
        total_correct: correctCount,
        total_wrong: wrongCount,
        status: 'finished',
        end_time: new Date().toISOString(),
        answers: currentAnswers,
        ...(student ? {
          tab_switch_count: tabSwitchCount,
          fullscreen_exit_count: fullscreenExitCount,
          flagged: tabSwitchCount >= PROCTOR_VIOLATION_LIMIT || fullscreenExitCount >= PROCTOR_VIOLATION_LIMIT,
        } : {}),
      });
      if (dbError) {
        // Unique constraint (one attempt per student per test) tripped — most likely a double
        // submit from two tabs. Treat it as already-submitted rather than a hard failure.
        if (dbError.code === '23505') {
          localStorage.removeItem(`test_session_${testId}`);
          setTestStage('completed');
          return;
        }
        throw dbError;
      }
      localStorage.removeItem(`test_session_${testId}`);
      setTestStage('completed');
    } catch (err) {
      console.error(err);
      alert("Failed to save attempt to database, but results are shown locally.");
      setTestStage('completed');
    } finally {
      exitFullscreenLockdown();
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

  if (priorAttempt) {
    return (
      <div className="min-h-screen bg-atlas-dark flex items-center justify-center p-4">
        <div className="bg-atlas-soft border border-gray-800 rounded-3xl p-10 max-w-md w-full text-center shadow-2xl">
          <h2 className="text-2xl font-extrabold mb-2 text-white">Already Submitted</h2>
          <p className="text-gray-400 text-sm mb-6">You've already completed {testDetails?.title || 'this test'}. Each test can only be attempted once.</p>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 mb-8">
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Your Score</p>
            <div className={`text-6xl font-extrabold mb-4 ${priorAttempt.score >= 50 ? 'text-atlas-green' : 'text-red-500'}`}>{priorAttempt.score}%</div>
            <p className="text-gray-400 font-medium">{priorAttempt.total_correct} correct &middot; {priorAttempt.total_wrong} wrong</p>
          </div>
          <button onClick={() => navigate('/dashboard/student')} className="w-full bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition">Back to Dashboard</button>
        </div>
      </div>
    );
  }

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
                {student && (
                  <>
                    <li className="text-amber-400">This is a proctored test: it runs in fullscreen, and exiting fullscreen or switching tabs is recorded.</li>
                    <li className="text-amber-400">Copy, paste, and right-click are disabled during the test.</li>
                  </>
                )}
              </ul>
            </div>
            <button
              onClick={() => { requestFullscreenLockdown(); setTestStage('active'); }}
              className="w-full bg-atlas-green hover:bg-green-500 text-atlas-dark py-4 rounded-xl font-bold text-lg"
            >
              Start Test
            </button>
          </div>
        </div>
      )}

      {/* NEW CBT ACTIVE VIEW */}
      {testStage === 'active' && currentQ && (
        <div className="min-h-screen flex flex-col">
          {/* Fullscreen-exit warning */}
          {student && showFullscreenWarning && (
            <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-atlas-soft border border-red-500/40 rounded-3xl p-10 max-w-md w-full text-center shadow-2xl">
                <h3 className="text-xl font-extrabold text-red-400 mb-2">Fullscreen Exited</h3>
                <p className="text-gray-400 text-sm mb-2">
                  Leaving fullscreen during a proctored test is recorded as a violation.
                </p>
                <p className="text-xs text-gray-600 mb-6">
                  Violations recorded: {fullscreenExitCount} / {PROCTOR_VIOLATION_LIMIT} allowed before this attempt is flagged for review.
                </p>
                <button onClick={requestFullscreenLockdown} className="w-full bg-atlas-green hover:bg-green-500 text-atlas-dark py-3 rounded-xl font-bold">
                  Resume Fullscreen
                </button>
              </div>
            </div>
          )}

          {/* Header */}
          <header className="bg-atlas-soft border-b border-gray-800 p-4 sticky top-0 z-50 flex justify-between items-center px-6">
            <h2 className="font-bold text-lg text-gray-200 hidden md:block">{testDetails.title}</h2>
            <div className="flex items-center gap-3">
              {student && (tabSwitchCount > 0 || fullscreenExitCount > 0) && (
                <div className="text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-xl border bg-amber-500/10 text-amber-400 border-amber-500/30" title="Proctoring violations recorded on this attempt">
                  {tabSwitchCount + fullscreenExitCount} Violation{tabSwitchCount + fullscreenExitCount === 1 ? '' : 's'}
                </div>
              )}
              <div className={`font-mono text-xl font-bold px-4 py-2 rounded-xl border ${timeLeft && timeLeft < 60 ? 'bg-red-500/10 text-red-500 border-red-500/30 animate-pulse' : 'bg-gray-900 text-atlas-green border-gray-700'}`}>
                {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
              </div>
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
                  <div className="text-xl font-medium text-gray-200 leading-relaxed mb-8 prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: replacePlaceholdersWithImages(currentQ.question, currentQ.inline_images) }} />
                  <div className="space-y-3">
                    {(() => {
                      let opts = currentQ.options;
                      if (typeof opts === 'string') { try { opts = JSON.parse(opts); } catch (e) { opts = []; } }
                      return (opts || []).map((opt: string, i: number) => {
                        const isSelected = answers[currentQ.id] === i;
                        const optImages = currentQ.option_inline_images?.[i] || [];
                        return (
                          <label key={i} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'bg-green-900/20 border-atlas-green shadow-[0_0_15px_rgba(46,204,113,0.15)]' : 'bg-gray-900/50 border-gray-700 hover:border-gray-500'}`}>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-atlas-green' : 'border-gray-500'}`}>
                              {isSelected && <div className="w-2.5 h-2.5 bg-atlas-green rounded-full" />}
                            </div>
                            <input type="radio" className="sr-only" checked={isSelected} onChange={() => handleOptionSelect(currentQ.id, i)} />
                            <div className={`text-base flex items-center gap-2 prose prose-invert max-w-none ${isSelected ? 'text-white font-medium' : 'text-gray-300'}`} dangerouslySetInnerHTML={{ __html: replacePlaceholdersWithImages(opt || '[Image option]', optImages) }} />
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
            <button onClick={() => navigate(student ? '/dashboard/student' : '/')} className="w-full bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition">
              {student ? 'Back to Dashboard' : 'Return Home'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TakeTest;
