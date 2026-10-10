import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { getCorrectOptionIndex } from '../../../utils/mcqAnswer';
import { replacePlaceholdersWithImages } from '../../../utils/imagePlaceholder';
import { markersToHtml } from '../../../utils/renderMath';

// ---------------------------------------------------------------------------
// Proctoring policy
// ---------------------------------------------------------------------------

/** The attempt is closed automatically on this violation. */
const MAX_VIOLATIONS = 3;
/** One physical action (e.g. Alt+Tab = key press + window blur + tab hidden) is one violation. */
const VIOLATION_COOLDOWN_MS = 2500;
/** Entering fullscreen / resuming fires focus and resize events that must not count. */
const START_GRACE_MS = 2000;
/** Treat fullscreen as unavailable if the browser hasn't granted it by then. */
const FULLSCREEN_TIMEOUT_MS = 1500;

type ViolationType = 'right_click' | 'keyboard' | 'tab_switch' | 'window_blur' | 'fullscreen_exit';

interface Violation {
  type: ViolationType;
  at: string;
}

const VIOLATION_COPY: Record<ViolationType, { title: string; detail: string }> = {
  right_click: { title: 'Right-click detected', detail: 'Using the right mouse button is not allowed during this exam.' },
  keyboard: { title: 'Keyboard use detected', detail: 'The keyboard must not be used during this exam. Use only the mouse.' },
  tab_switch: { title: 'Tab switch detected', detail: 'You switched to another tab or hid the exam window.' },
  window_blur: { title: 'You left the exam window', detail: 'Another window or application took focus, or the window was minimised.' },
  fullscreen_exit: { title: 'Fullscreen exited', detail: 'The exam must stay in fullscreen until you submit.' },
};

const lockKey = (testId: string) => `atlas_test_lock_${testId}`;
const sessionKey = (testId: string) => `test_session_${testId}`;

// ---------------------------------------------------------------------------
// Sections & palette
// ---------------------------------------------------------------------------

const SUBJECT_STYLE: Record<string, { dot: string; text: string; soft: string }> = {
  physics: { dot: 'bg-sky-400', text: 'text-sky-300', soft: 'bg-sky-400/10 ring-sky-400/30' },
  chemistry: { dot: 'bg-amber-400', text: 'text-amber-300', soft: 'bg-amber-400/10 ring-amber-400/30' },
  biology: { dot: 'bg-emerald-400', text: 'text-emerald-300', soft: 'bg-emerald-400/10 ring-emerald-400/30' },
  mathematics: { dot: 'bg-violet-400', text: 'text-violet-300', soft: 'bg-violet-400/10 ring-violet-400/30' },
};
const subjectStyle = (subject: string) =>
  SUBJECT_STYLE[subject.trim().toLowerCase()] ?? { dot: 'bg-gray-400', text: 'text-gray-300', soft: 'bg-white/5 ring-white/15' };

interface Section {
  subject: string;
  /** Indices into the flattened, section-ordered question list. */
  indices: number[];
}

type PaletteState = 'not_visited' | 'not_answered' | 'answered' | 'flagged' | 'flagged_answered';

const PALETTE: Record<PaletteState, { label: string; tile: string; swatch: string }> = {
  not_visited: {
    label: 'Not visited',
    tile: 'bg-white/[0.03] text-gray-400 ring-1 ring-inset ring-white/10 hover:ring-white/25',
    swatch: 'bg-white/[0.06] ring-1 ring-inset ring-white/15',
  },
  not_answered: {
    label: 'Not answered',
    tile: 'bg-rose-500/10 text-rose-300 ring-1 ring-inset ring-rose-400/40 hover:ring-rose-300/70',
    swatch: 'bg-rose-500/20 ring-1 ring-inset ring-rose-400/50',
  },
  answered: {
    label: 'Answered',
    tile: 'bg-gradient-to-b from-emerald-400 to-emerald-500 text-gray-950 shadow-[0_4px_14px_-6px_rgba(16,185,129,0.9)] hover:brightness-110',
    swatch: 'bg-emerald-400',
  },
  flagged: {
    label: 'Marked for review',
    tile: 'bg-amber-400/15 text-amber-200 ring-1 ring-inset ring-amber-400/60 hover:ring-amber-300',
    swatch: 'bg-amber-400/25 ring-1 ring-inset ring-amber-400/70',
  },
  flagged_answered: {
    label: 'Answered & marked',
    tile: 'bg-amber-400/15 text-amber-200 ring-1 ring-inset ring-amber-400/60 hover:ring-amber-300',
    swatch: 'bg-amber-400/25 ring-1 ring-inset ring-amber-400/70',
  },
};

const isAnswered = (value: number | null | undefined) => value !== null && value !== undefined;

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const Icon: React.FC<{ d: string; className?: string; filled?: boolean }> = ({ d, className = 'h-5 w-5', filled }) => (
  <svg className={className} fill={filled ? 'currentColor' : 'none'} viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);
const ICONS = {
  flag: 'M3 3v1.5M3 21v-6m0 0l2.77-.693a15.26 15.26 0 019.318 0M3 14.5h11.511c1.54 0 3.04-.326 4.38-.94l3.111-1.372V4.5l-3.111 1.372a15.26 15.26 0 01-4.38.94H3',
  shield: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
  clock: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  doc: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  layers: 'M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3',
  user: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
  mail: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75',
  mouse: 'M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59',
  keyboard: 'M3.75 6.75h16.5a1.5 1.5 0 011.5 1.5v7.5a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5v-7.5a1.5 1.5 0 011.5-1.5zM6 10.5h.008M9 10.5h.008M12 10.5h.008M15 10.5h.008M18 10.5h.008M7.5 14.25h9',
  window: 'M3 8.25V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18V8.25m-18 0V6a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 6v2.25m-18 0h18M5.25 6h.008v.008H5.25V6zM7.5 6h.008v.008H7.5V6zm2.25 0h.008v.008H9.75V6z',
  tabs: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
  expand: 'M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15',
  warn: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  ban: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
  check: 'M4.5 12.75l6 6 9-13.5',
  left: 'M15.75 19.5L8.25 12l7.5-7.5',
  right: 'M8.25 4.5l7.5 7.5-7.5 7.5',
  eraser: 'M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

const BRAND_LOGO = 'https://i.postimg.cc/xdCpx0Kj/Logo-new-(1).png';

// ---------------------------------------------------------------------------
// Shared shells (module level so React keeps their identity across renders —
// defining them inside TakeTest would remount the form on every keystroke)
// ---------------------------------------------------------------------------

const Backdrop: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="relative min-h-screen overflow-hidden bg-[#05080f] text-white font-sans">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.12),transparent_60%)]" />
    <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)] [background-size:48px_48px]" />
    <div className="relative">{children}</div>
  </div>
);

const Panel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] ring-1 ring-inset ring-white/10 shadow-[0_40px_80px_-32px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl ${className}`}>
    {children}
  </div>
);

const StatusScreen: React.FC<{ tone: 'error' | 'warn' | 'ok'; title: string; children: React.ReactNode }> = ({ tone, title, children }) => (
  <Backdrop>
    <div className="min-h-screen flex items-center justify-center p-4">
      <Panel className="max-w-md w-full p-10 text-center animate-auth-in">
        <div className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ring-inset ${
          tone === 'error' ? 'bg-rose-500/10 text-rose-300 ring-rose-400/30' : tone === 'warn' ? 'bg-amber-500/10 text-amber-300 ring-amber-400/30' : 'bg-emerald-500/10 text-emerald-300 ring-emerald-400/30'
        }`}>
          <Icon d={tone === 'ok' ? ICONS.check : tone === 'warn' ? ICONS.warn : ICONS.ban} className="h-7 w-7" />
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight">{title}</h2>
        {children}
      </Panel>
    </div>
  </Backdrop>
);


// ---------------------------------------------------------------------------

const TakeTest: React.FC = () => {
  const { testId = '' } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const student = auth?.user?.role === 'student' ? auth.user : null;

  // Core data
  const [testDetails, setTestDetails] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [sections, setSections] = useState<Section[]>([]);

  // Stage
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testStage, setTestStage] = useState<'registration' | 'instructions' | 'active' | 'completed' | 'terminated'>('registration');
  const [priorAttempt, setPriorAttempt] = useState<{ score: number; total_correct: number; total_wrong: number; status?: string; violation_count?: number } | null>(null);
  const [lockedOnDevice, setLockedOnDevice] = useState(false);

  // Candidate
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [checkingCandidate, setCheckingCandidate] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [acceptedRules, setAcceptedRules] = useState(false);

  // CBT engine
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [scoreData, setScoreData] = useState<{ score: number; correct: number; total: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  // Proctoring
  const [violations, setViolations] = useState<Violation[]>([]);
  const [activeWarning, setActiveWarning] = useState<Violation | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => Boolean(document.fullscreenElement));
  const [fullscreenUnavailable, setFullscreenUnavailable] = useState(false);
  const [fullscreenPending, setFullscreenPending] = useState(false);

  // Refs read by timers and event listeners, which would otherwise see stale state.
  const answersRef = useRef(answers);
  const questionsRef = useRef<any[]>([]);
  const violationsRef = useRef<Violation[]>([]);
  const submittingRef = useRef(false);
  const lastViolationAt = useRef(0);
  const graceUntil = useRef(0);
  /** Set while the page unloads: a reload fires 'hidden'/'blur', which is not a tab switch. */
  const unloading = useRef(false);
  const candidateRef = useRef({ name: '', email: '' });

  answersRef.current = answers;
  questionsRef.current = questions;
  violationsRef.current = violations;
  candidateRef.current = { name: student ? student.name : guestName.trim(), email: student ? student.email || '' : guestEmail.trim().toLowerCase() };

  const fullscreenSupported = typeof document !== 'undefined' && Boolean(document.fullscreenEnabled) && !fullscreenUnavailable;

  // --- 1. Load test, enforce access rules, restore an in-progress session ---
  useEffect(() => {
    const fetchTest = async () => {
      try {
        if (!testId) throw new Error('No test ID provided.');

        const { data: testData, error: testError } = await supabase.from('tests').select('*').eq('id', testId).single();
        if (testError) throw testError;
        if (!testData) throw new Error('Test not found.');

        const now = new Date();
        const start = new Date(testData.start_window);
        const end = new Date(testData.end_window);
        if (now < start) throw new Error(`This test has not started yet. It opens at ${start.toLocaleString()}.`);
        if (now > end) throw new Error(`This test has closed. It closed at ${end.toLocaleString()}.`);

        setTestDetails(testData);

        // A test closed for malpractice on this device can never be restarted here.
        if (localStorage.getItem(lockKey(testId))) {
          setLockedOnDevice(true);
          return;
        }

        if (student) {
          const { data: assignments } = await supabase.from('test_assignments').select('class_id').eq('test_id', testId);
          if (assignments && assignments.length > 0) {
            const isAssignedToMe = student.class_id && assignments.some((a: any) => a.class_id === student.class_id);
            if (!isAssignedToMe) throw new Error('This test has not been assigned to your class.');
          }

          const { data: existingAttempt } = await supabase
            .from('test_attempts')
            .select('*')
            .eq('test_id', testId)
            .eq('student_id', student.id)
            .maybeSingle();
          if (existingAttempt) {
            setPriorAttempt(existingAttempt);
            return;
          }
        }

        const { data: qData, error: qError } = await supabase.from('mcqs').select('*').in('id', testData.question_ids);
        if (qError) throw qError;

        // Keep the order the test was authored in, then group into subject sections
        // (sections appear in the order their first question appears in the test).
        const position = new Map<string, number>((testData.question_ids || []).map((id: string, i: number) => [id, i]));
        const ordered = [...(qData || [])].sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
        const groups = new Map<string, any[]>();
        for (const q of ordered) {
          const subject = String(q.subject || 'General').trim() || 'General';
          if (!groups.has(subject)) groups.set(subject, []);
          groups.get(subject)!.push(q);
        }
        const flat: any[] = [];
        const builtSections: Section[] = [];
        for (const [subject, qs] of groups) {
          builtSections.push({ subject, indices: qs.map((_, i) => flat.length + i) });
          flat.push(...qs);
        }
        questionsRef.current = flat;
        setQuestions(flat);
        setSections(builtSections);

        if (student) {
          setGuestName(student.name);
          setGuestEmail(student.email || '');
          setTestStage('instructions');
        }

        // Restore an in-progress session (page reload, crash).
        const savedSession = localStorage.getItem(sessionKey(testId));
        if (savedSession) {
          const session = JSON.parse(savedSession);
          if (!student) {
            setGuestName(session.guestName || '');
            setGuestEmail(session.guestEmail || '');
          }
          if (session.flagged) setFlagged(new Set(session.flagged));
          if (session.visited) setVisited(new Set(session.visited));
          if (Array.isArray(session.violations)) setViolations(session.violations);
          if (typeof session.currentIndex === 'number') setCurrentIndex(Math.min(session.currentIndex, Math.max(0, flat.length - 1)));

          if (session.endTime && Date.now() < session.endTime) {
            setAnswers(session.answers || {});
            setAcceptedRules(true);
            graceUntil.current = Date.now() + START_GRACE_MS;
            setTestStage('active');
          } else if (session.endTime) {
            setAnswers(session.answers || {});
            answersRef.current = session.answers || {};
            candidateRef.current = student
              ? { name: student.name, email: student.email || '' }
              : { name: session.guestName || '', email: session.guestEmail || '' };
            await submitTestEngine('finished', flat, session.violations || []);
          }
        }
      } catch (err: any) {
        setError(err.message || 'An error occurred loading the test.');
      } finally {
        setLoading(false);
      }
    };
    fetchTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  // --- 2. Timer (end time persisted so a reload can't reset the clock) ---
  useEffect(() => {
    if (testStage !== 'active') return;

    let endTime = 0;
    const sessionStr = localStorage.getItem(sessionKey(testId));
    if (sessionStr && JSON.parse(sessionStr).endTime) {
      endTime = JSON.parse(sessionStr).endTime;
    } else {
      endTime = Date.now() + testDetails.duration_minutes * 60 * 1000;
      localStorage.setItem(
        sessionKey(testId),
        JSON.stringify({
          guestName: candidateRef.current.name,
          guestEmail: candidateRef.current.email,
          answers,
          flagged: Array.from(flagged),
          visited: Array.from(visited),
          violations,
          currentIndex,
          endTime,
        })
      );
    }

    const tick = () => {
      const remaining = Math.round((endTime - Date.now()) / 1000);
      if (remaining <= 0) {
        setTimeLeft(0);
        // Read the latest answers from the ref — the closure's copy is from when the test started.
        submitTestEngine('finished');
        return false;
      }
      setTimeLeft(remaining);
      return true;
    };
    if (!tick()) return;
    const timer = setInterval(() => {
      if (!tick()) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testStage, testId]);

  // Persist progress on every change.
  useEffect(() => {
    if (testStage !== 'active') return;
    const sessionStr = localStorage.getItem(sessionKey(testId));
    if (!sessionStr) return;
    const session = JSON.parse(sessionStr);
    localStorage.setItem(
      sessionKey(testId),
      JSON.stringify({ ...session, answers, flagged: Array.from(flagged), visited: Array.from(visited), violations, currentIndex })
    );
  }, [answers, flagged, visited, violations, currentIndex, testStage, testId]);

  // Mark the current question visited.
  const currentQ = questions[currentIndex];
  useEffect(() => {
    if (testStage === 'active' && currentQ && !visited.has(currentQ.id)) {
      setVisited(prev => new Set(prev).add(currentQ.id));
    }
  }, [testStage, currentQ, visited]);

  // --- 3. Proctoring ---
  const recordViolation = useCallback((type: ViolationType) => {
    if (submittingRef.current || unloading.current) return;
    const now = Date.now();
    if (now < graceUntil.current || now - lastViolationAt.current < VIOLATION_COOLDOWN_MS) return;
    lastViolationAt.current = now;

    const violation: Violation = { type, at: new Date(now).toISOString() };
    const next = [...violationsRef.current, violation];
    violationsRef.current = next;
    setViolations(next);

    if (next.length >= MAX_VIOLATIONS) {
      setActiveWarning(null);
      submitTestEngine('terminated', undefined, next);
    } else {
      setActiveWarning(violation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (testStage !== 'active') return;

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      recordViolation('right_click');
    };
    const onKeyDown = (e: KeyboardEvent) => {
      // Swallow the key so no shortcut (copy, find, reload, devtools…) takes effect.
      e.preventDefault();
      e.stopPropagation();
      recordViolation('keyboard');
    };
    const onVisibility = () => {
      if (document.hidden) recordViolation('tab_switch');
    };
    const onBlur = () => recordViolation('window_blur');
    const onFullscreenChange = () => {
      const fs = Boolean(document.fullscreenElement);
      setIsFullscreen(fs);
      if (!fs) recordViolation('fullscreen_exit');
    };
    const block = (e: Event) => e.preventDefault();
    // Progress is restored after a reload, so the unload itself is not a violation. (A candidate
    // can't reload without a key press or leaving fullscreen, which are violations already.)
    const onUnload = () => {
      unloading.current = true;
    };

    window.addEventListener('beforeunload', onUnload);
    window.addEventListener('pagehide', onUnload);
    document.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    ['copy', 'cut', 'paste', 'dragstart', 'selectstart', 'drop'].forEach(evt => document.addEventListener(evt, block));

    return () => {
      window.removeEventListener('beforeunload', onUnload);
      window.removeEventListener('pagehide', onUnload);
      document.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      ['copy', 'cut', 'paste', 'dragstart', 'selectstart', 'drop'].forEach(evt => document.removeEventListener(evt, block));
    };
  }, [testStage, recordViolation]);

  const enterFullscreen = useCallback(async () => {
    graceUntil.current = Date.now() + START_GRACE_MS;
    if (!document.fullscreenEnabled || document.fullscreenElement) return;
    setFullscreenPending(true);
    try {
      // Some embedded browsers never settle the request; don't let that hang the exam.
      await Promise.race([
        document.documentElement.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions),
        new Promise((_, reject) => setTimeout(() => reject(new Error('fullscreen timeout')), FULLSCREEN_TIMEOUT_MS)),
      ]);
      setIsFullscreen(true);
    } catch {
      // Refused or unsupported (embedded browsers, strict policies): the other checks still apply.
      if (!document.fullscreenElement) setFullscreenUnavailable(true);
    } finally {
      setFullscreenPending(false);
      graceUntil.current = Date.now() + START_GRACE_MS;
    }
  }, []);

  const exitFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };

  // --- Handlers ---
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = guestName.trim();
    const email = guestEmail.trim().toLowerCase();
    if (!name || !email) {
      setRegistrationError('Please enter your full name and email address.');
      return;
    }
    setCheckingCandidate(true);
    setRegistrationError(null);
    try {
      // One attempt per email per test.
      const escaped = email.replace(/[\\%_]/g, ch => `\\${ch}`);
      const { data: existing } = await supabase
        .from('test_attempts')
        .select('*')
        .eq('test_id', testId)
        .is('student_id', null)
        .ilike('guest_email', escaped)
        .limit(1);
      if (existing && existing.length > 0) {
        setRegistrationError(
          existing[0].status === 'terminated' || (existing[0].violation_count ?? 0) >= MAX_VIOLATIONS
            ? 'This email’s attempt was closed for exam-rule violations. It cannot be taken again.'
            : 'An attempt has already been submitted with this email. Each test can be taken only once.'
        );
        return;
      }
      setGuestName(name);
      setGuestEmail(email);
      setTestStage('instructions');
    } finally {
      setCheckingCandidate(false);
    }
  };

  const startTest = () => {
    if (!acceptedRules) return;
    // Must be called straight from the click so the browser accepts the fullscreen request.
    enterFullscreen();
    setTestStage('active');
  };

  const toggleFlag = (id: string) => {
    setFlagged(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleOptionSelect = (questionId: string, optionIndex: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const clearResponse = (questionId: string) => {
    setAnswers(prev => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  };

  const goTo = (index: number) => setCurrentIndex(Math.max(0, Math.min(questions.length - 1, index)));

  const submitTestEngine = async (
    outcome: 'finished' | 'terminated',
    questionList: any[] = questionsRef.current,
    violationList: Violation[] = violationsRef.current
  ) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setShowSubmitConfirm(false);

    const currentAnswers = answersRef.current;
    const { name, email } = candidateRef.current;

    let correctCount = 0;
    questionList.forEach(q => {
      const selectedIndex = currentAnswers[q.id];
      if (!isAnswered(selectedIndex)) return;
      const correctIndex = getCorrectOptionIndex(q);
      if (correctIndex !== null) {
        if (selectedIndex === correctIndex) correctCount++;
      } else if (q.options?.[selectedIndex as number] === q.answer) {
        correctCount++;
      }
    });

    const total = questionList.length || 1;
    const finalScore = Math.round((correctCount / total) * 100);
    setScoreData({ score: finalScore, correct: correctCount, total: questionList.length });

    const count = (...types: ViolationType[]) => violationList.filter(v => types.includes(v.type)).length;
    const baseRow = {
      test_id: testId,
      ...(student ? { student_id: student.id } : { guest_name: name, guest_email: email }),
      score: finalScore,
      total_correct: correctCount,
      total_wrong: questionList.length - correctCount,
      status: outcome,
      end_time: new Date().toISOString(),
      answers: currentAnswers,
      tab_switch_count: count('tab_switch', 'window_blur'),
      fullscreen_exit_count: count('fullscreen_exit'),
      flagged: outcome === 'terminated' || violationList.length > 0,
    };

    if (outcome === 'terminated') localStorage.setItem(lockKey(testId), new Date().toISOString());

    try {
      // Save the full record, falling back gracefully while migration 004 isn't applied yet:
      //  23514 — the status check constraint doesn't allow 'terminated' yet → save as 'finished'
      //          (still identifiable as closed: flagged + violation_count >= MAX_VIOLATIONS);
      //  PGRST204 / 42703 — the violation columns don't exist yet → save without them.
      let row: Record<string, unknown> = { ...baseRow, violation_count: violationList.length, violations: violationList };
      let dbError: any = null;
      for (let tries = 0; tries < 3; tries++) {
        ({ error: dbError } = await supabase.from('test_attempts').insert(row));
        if (!dbError) break;
        if (dbError.code === '23514' && row.status === 'terminated') {
          row = { ...row, status: 'finished' };
        } else if ((dbError.code === 'PGRST204' || dbError.code === '42703') && 'violations' in row) {
          const { violation_count: _count, violations: _log, ...rest } = row;
          row = rest;
        } else {
          break;
        }
      }
      // 23505: one attempt per candidate per test already exists (e.g. a second tab or device).
      if (dbError && dbError.code !== '23505') throw dbError;
      localStorage.removeItem(sessionKey(testId));
    } catch (err) {
      console.error('Failed to save attempt', err);
      setSaveFailed(true);
    } finally {
      setTestStage(outcome === 'terminated' ? 'terminated' : 'completed');
      exitFullscreen();
      setIsSubmitting(false);
    }
  };

  // --- Derived ---
  const sectionOf = useMemo(() => {
    const map = new Map<number, number>();
    sections.forEach((s, si) => s.indices.forEach(i => map.set(i, si)));
    return map;
  }, [sections]);

  const paletteState = (q: any): PaletteState => {
    const answered = isAnswered(answers[q.id]);
    const isFlagged = flagged.has(q.id);
    if (isFlagged) return answered ? 'flagged_answered' : 'flagged';
    if (answered) return 'answered';
    return visited.has(q.id) ? 'not_answered' : 'not_visited';
  };

  const stats = useMemo(() => {
    const result: Record<PaletteState, number> = { not_visited: 0, not_answered: 0, answered: 0, flagged: 0, flagged_answered: 0 };
    questions.forEach(q => {
      result[paletteState(q)]++;
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, answers, flagged, visited]);

  const answeredCount = questions.filter(q => isAnswered(answers[q.id])).length;
  const strikesLeft = MAX_VIOLATIONS - violations.length;

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <Backdrop>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4" role="status">
          <div className="h-10 w-10 rounded-full border-4 border-emerald-400/20 border-t-emerald-400 animate-spin" />
          <p className="text-sm font-semibold text-gray-400 tracking-wide">Preparing secure exam environment…</p>
        </div>
      </Backdrop>
    );
  }

  if (error) {
    return (
      <StatusScreen tone="error" title="Unable to open this test">
        <p className="mt-3 text-sm text-gray-400">{error}</p>
      </StatusScreen>
    );
  }

  if (lockedOnDevice) {
    return (
      <StatusScreen tone="error" title="Test closed">
        <p className="mt-3 text-sm text-gray-400">
          {testDetails?.title ? <>Your attempt at <span className="font-semibold text-white">{testDetails.title}</span> was </> : 'This attempt was '}
          closed automatically after {MAX_VIOLATIONS} exam-rule violations. It cannot be taken again.
        </p>
        <p className="mt-4 text-xs text-gray-500">If you believe this is a mistake, contact your exam administrator.</p>
      </StatusScreen>
    );
  }

  if (priorAttempt) {
    const terminated = priorAttempt.status === 'terminated' || (priorAttempt.violation_count ?? 0) >= MAX_VIOLATIONS;
    return (
      <StatusScreen tone={terminated ? 'error' : 'warn'} title={terminated ? 'Test closed' : 'Already submitted'}>
        <p className="mt-3 text-sm text-gray-400">
          {terminated
            ? `Your attempt at ${testDetails?.title || 'this test'} was closed for exam-rule violations.`
            : `You've already completed ${testDetails?.title || 'this test'}. Each test can only be attempted once.`}
        </p>
        {!terminated && (
          <div className="mt-6 rounded-2xl bg-black/30 ring-1 ring-inset ring-white/10 p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Your score</p>
            <p className={`mt-2 text-5xl font-black tabular-nums ${priorAttempt.score >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>{priorAttempt.score}%</p>
            <p className="mt-2 text-sm text-gray-400">{priorAttempt.total_correct} correct · {priorAttempt.total_wrong} wrong</p>
          </div>
        )}
        <button onClick={() => navigate('/dashboard/student')} className="mt-8 w-full rounded-xl bg-white/[0.06] py-3 font-bold ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.1]">
          Back to dashboard
        </button>
      </StatusScreen>
    );
  }

  const metaTiles = testDetails && (
    <div className="grid grid-cols-3 gap-3">
      {[
        { icon: ICONS.clock, label: 'Duration', value: `${testDetails.duration_minutes} min` },
        { icon: ICONS.doc, label: 'Questions', value: questions.length },
        { icon: ICONS.layers, label: sections.length === 1 ? 'Section' : 'Sections', value: sections.length },
      ].map(tile => (
        <div key={tile.label} className="rounded-2xl bg-black/25 ring-1 ring-inset ring-white/[0.07] px-4 py-3">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
            <Icon d={tile.icon} className="h-3.5 w-3.5" />
            {tile.label}
          </div>
          <p className="mt-1 text-lg font-black tabular-nums">{tile.value}</p>
        </div>
      ))}
    </div>
  );

  // --- Registration ---
  if (testStage === 'registration') {
    return (
      <Backdrop>
        <div className="min-h-screen flex items-center justify-center p-4 py-12">
          <Panel className="w-full max-w-lg p-8 sm:p-10 animate-auth-in">
            <div className="flex items-center justify-between">
              <img src={BRAND_LOGO} alt="Atlas Classes" className="h-10 w-auto object-contain" />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
                <Icon d={ICONS.shield} className="h-3.5 w-3.5" /> Proctored
              </span>
            </div>

            <p className="mt-8 text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400/80">Online examination</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight leading-tight">{testDetails.title}</h1>
            <div className="mt-6">{metaTiles}</div>

            <form onSubmit={handleRegister} className="mt-8 space-y-4" noValidate>
              {[
                { id: 'name', label: 'Full name', icon: ICONS.user, type: 'text', value: guestName, set: setGuestName, placeholder: 'As it should appear on your result', auto: 'name' },
                { id: 'email', label: 'Email address', icon: ICONS.mail, type: 'email', value: guestEmail, set: setGuestEmail, placeholder: 'you@example.com', auto: 'email' },
              ].map(field => (
                <label key={field.id} className="block">
                  <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400">{field.label}</span>
                  <span className="relative mt-2 block">
                    <Icon d={field.icon} className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <input
                      required
                      type={field.type}
                      autoComplete={field.auto}
                      value={field.value}
                      onChange={e => field.set(e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full rounded-xl bg-black/30 py-3.5 pl-11 pr-4 text-[15px] text-white placeholder-gray-600 ring-1 ring-inset ring-white/10 outline-none transition focus:bg-black/40 focus:ring-emerald-400/60 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.1)] [&:-webkit-autofill]:[-webkit-text-fill-color:#fff] [&:-webkit-autofill]:[transition:background-color_9999s]"
                    />
                  </span>
                </label>
              ))}

              {registrationError && (
                <p className="flex items-start gap-2 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200 ring-1 ring-inset ring-rose-400/30 animate-shake" role="alert">
                  <Icon d={ICONS.warn} className="mt-0.5 h-4 w-4 shrink-0" />
                  {registrationError}
                </p>
              )}

              <button
                type="submit"
                disabled={checkingCandidate}
                className="mt-2 w-full rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 py-3.5 text-[15px] font-bold text-gray-950 shadow-[0_12px_30px_-12px_rgba(16,185,129,0.9),inset_0_1px_0_rgba(255,255,255,0.35)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
              >
                {checkingCandidate ? 'Verifying…' : 'Continue to instructions'}
              </button>
            </form>
          </Panel>
        </div>
      </Backdrop>
    );
  }

  // --- Instructions ---
  if (testStage === 'instructions') {
    const rules: { icon: string; title: string; text: string }[] = [
      { icon: ICONS.mouse, title: 'No right-click', text: 'The right mouse button must not be used.' },
      { icon: ICONS.keyboard, title: 'No keyboard', text: 'Do not press any key. Answer using the mouse only.' },
      { icon: ICONS.window, title: 'No minimising or leaving the window', text: 'Stay in this window. Do not minimise it or open other applications.' },
      { icon: ICONS.tabs, title: 'No tab switching', text: 'Do not switch to another browser tab or window.' },
      { icon: ICONS.expand, title: 'Stay in fullscreen', text: 'The exam runs in fullscreen. Exiting fullscreen counts as a violation.' },
    ];
    return (
      <Backdrop>
        <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
          <Panel className="p-6 sm:p-10 animate-auth-in">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <img src={BRAND_LOGO} alt="Atlas Classes" className="h-10 w-auto object-contain" />
              <div className="flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1.5 text-xs text-gray-300 ring-1 ring-inset ring-white/10">
                <Icon d={ICONS.user} className="h-3.5 w-3.5 text-gray-500" />
                <span className="font-semibold">{candidateRef.current.name}</span>
                <span className="text-gray-500">· {candidateRef.current.email}</span>
              </div>
            </div>

            <p className="mt-8 text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400/80">Exam instructions</p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">{testDetails.title}</h1>
            <div className="mt-6">{metaTiles}</div>

            {sections.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {sections.map((s, i) => {
                  const st = subjectStyle(s.subject);
                  return (
                    <span key={s.subject} className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${st.soft}`}>
                      <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                      Section {i + 1}: {s.subject}
                      <span className="text-gray-400">· {s.indices.length} Qs</span>
                    </span>
                  );
                })}
              </div>
            )}

            <div className="mt-8 grid gap-6 lg:grid-cols-5">
              <div className="lg:col-span-2 space-y-3 text-sm text-gray-300">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">General</h2>
                <ul className="space-y-2.5">
                  {[
                    `You have ${testDetails.duration_minutes} minutes. The test submits automatically when time runs out.`,
                    'Questions are grouped into subject sections. You can move between sections at any time.',
                    'Mark questions for review and return to them before submitting.',
                    'Your progress is saved automatically. Do not clear your browser data during the test.',
                    'Each test can be attempted only once.',
                  ].map(text => (
                    <li key={text} className="flex gap-2.5">
                      <Icon d={ICONS.check} className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>

                <h2 className="pt-4 text-xs font-black uppercase tracking-[0.2em] text-gray-500">Question palette</h2>
                <div className="grid grid-cols-1 gap-2">
                  {(Object.keys(PALETTE) as PaletteState[]).map(state => (
                    <div key={state} className="flex items-center gap-2.5 text-xs text-gray-400">
                      <PaletteSwatch state={state} />
                      {PALETTE[state].label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-3 rounded-2xl bg-rose-500/[0.06] ring-1 ring-inset ring-rose-400/25 p-5 sm:p-6">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-400/30">
                    <Icon d={ICONS.shield} className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-extrabold text-white">This is a proctored exam</h2>
                    <p className="text-xs text-rose-200/80">Your activity is monitored for the whole test.</p>
                  </div>
                </div>

                <ul className="mt-5 space-y-3">
                  {rules.map(rule => (
                    <li key={rule.title} className="flex gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/30 text-rose-300 ring-1 ring-inset ring-white/10">
                        <Icon d={rule.icon} className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-bold text-white">{rule.title}</span>
                        <span className="block text-xs text-gray-400">{rule.text}</span>
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 rounded-xl bg-black/30 p-4 ring-1 ring-inset ring-rose-400/20">
                  <p className="text-sm font-bold text-rose-200">Three strikes policy</p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-300">
                    Each of the actions above is recorded as a malpractice attempt. You will see a warning after the 1st and 2nd attempt.
                    On the <span className="font-bold text-white">{MAX_VIOLATIONS}rd attempt the test closes automatically</span>, your answers so far are
                    submitted, and you <span className="font-bold text-white">cannot take this test again</span>.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    {Array.from({ length: MAX_VIOLATIONS }).map((_, i) => (
                      <span key={i} className={`h-1.5 flex-1 rounded-full ${i === MAX_VIOLATIONS - 1 ? 'bg-rose-500' : 'bg-amber-400/70'}`} />
                    ))}
                  </div>
                  <div className="mt-1.5 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    <span>Warning 1</span>
                    <span>Warning 2</span>
                    <span className="text-rose-300">Test closed</span>
                  </div>
                </div>
              </div>
            </div>

            <label className="mt-8 flex cursor-pointer items-start gap-3 rounded-2xl bg-black/25 p-4 ring-1 ring-inset ring-white/10 transition hover:ring-white/20">
              <input type="checkbox" checked={acceptedRules} onChange={e => setAcceptedRules(e.target.checked)} className="peer sr-only" />
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition ${acceptedRules ? 'bg-emerald-400 text-gray-950' : 'bg-black/40 ring-1 ring-inset ring-white/20'}`}>
                {acceptedRules && <Icon d={ICONS.check} className="h-3.5 w-3.5" />}
              </span>
              <span className="text-sm text-gray-300">
                I have read the instructions. I understand this exam is proctored and that the test will close automatically after {MAX_VIOLATIONS} violations.
              </span>
            </label>

            <button
              onClick={startTest}
              disabled={!acceptedRules}
              className="mt-5 w-full rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 py-4 text-base font-bold text-gray-950 shadow-[0_12px_30px_-12px_rgba(16,185,129,0.9),inset_0_1px_0_rgba(255,255,255,0.35)] transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              Start test in fullscreen
            </button>
          </Panel>
        </div>
      </Backdrop>
    );
  }

  // --- Closed for malpractice ---
  if (testStage === 'terminated') {
    return (
      <StatusScreen tone="error" title="Test closed">
        <p className="mt-3 text-sm text-gray-400">
          Your test was closed automatically after {MAX_VIOLATIONS} exam-rule violations. The answers you gave up to this point have been submitted for review.
        </p>
        <div className="mt-6 space-y-2 rounded-2xl bg-black/30 p-4 text-left ring-1 ring-inset ring-white/10">
          {violations.map((v, i) => (
            <div key={i} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-2 text-gray-300">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/15 text-[10px] font-black text-rose-300">{i + 1}</span>
                {VIOLATION_COPY[v.type].title}
              </span>
              <span className="tabular-nums text-gray-500">{new Date(v.at).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
        {saveFailed && <p className="mt-4 text-xs text-amber-300">We couldn't reach the server. Please inform your exam administrator.</p>}
        <p className="mt-4 text-xs text-gray-500">This test cannot be taken again.</p>
      </StatusScreen>
    );
  }

  // --- Completed ---
  if (testStage === 'completed' && scoreData) {
    return (
      <StatusScreen tone="ok" title="Test submitted">
        <p className="mt-2 text-sm text-gray-400">{testDetails?.title}</p>
        <div className="mt-6 rounded-2xl bg-black/30 p-6 ring-1 ring-inset ring-white/10">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Final score</p>
          <p className={`mt-2 text-6xl font-black tabular-nums ${scoreData.score >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>{scoreData.score}%</p>
          <p className="mt-2 text-sm text-gray-400">{scoreData.correct} of {scoreData.total} correct</p>
        </div>
        {saveFailed && <p className="mt-4 text-xs text-amber-300">Your result is shown here, but saving it failed. Please inform your exam administrator.</p>}
        <button onClick={() => navigate(student ? '/dashboard/student' : '/')} className="mt-8 w-full rounded-xl bg-white/[0.06] py-3 font-bold ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.1]">
          {student ? 'Back to dashboard' : 'Return home'}
        </button>
      </StatusScreen>
    );
  }

  if (testStage !== 'active' || !currentQ) return null;

  // --- Active exam ---
  const currentSectionIndex = sectionOf.get(currentIndex) ?? 0;
  const currentSection = sections[currentSectionIndex];
  const currentSubject = subjectStyle(currentSection?.subject || '');
  const positionInSection = currentSection ? currentSection.indices.indexOf(currentIndex) + 1 : 0;
  const isFlaggedNow = flagged.has(currentQ.id);
  const timeLow = timeLeft !== null && timeLeft < 300;
  const timeCritical = timeLeft !== null && timeLeft < 60;
  const needsFullscreen = fullscreenSupported && !isFullscreen && !fullscreenPending && !isSubmitting;

  let options = currentQ.options;
  if (typeof options === 'string') {
    try { options = JSON.parse(options); } catch { options = []; }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#05080f] text-white font-sans select-none">
      {/* ── Header ── */}
      <header className="relative z-30 shrink-0 border-b border-white/[0.06] bg-[#0a0f18]/95 backdrop-blur-xl">
        <div className="flex items-center gap-4 px-4 sm:px-6 py-3">
          <img src={BRAND_LOGO} alt="Atlas Classes" className="hidden sm:block h-8 w-auto object-contain" />
          <span className="hidden sm:block h-8 w-px bg-white/10" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base sm:text-xl font-black tracking-tight" title={testDetails.title}>{testDetails.title}</h1>
            <p className="truncate text-[11px] sm:text-xs text-gray-500">
              <span className="font-semibold text-gray-300">{candidateRef.current.name}</span>
              <span className="mx-1.5">·</span>{questions.length} questions
              <span className="mx-1.5">·</span>{sections.length} {sections.length === 1 ? 'section' : 'sections'}
            </p>
          </div>

          <div
            className={`hidden md:flex items-center gap-2 rounded-xl px-3 py-2 ring-1 ring-inset ${
              violations.length === 0 ? 'bg-emerald-400/[0.07] ring-emerald-400/25 text-emerald-300' : 'bg-rose-500/10 ring-rose-400/40 text-rose-300'
            }`}
            title="Exam-rule violations recorded on this attempt"
          >
            <Icon d={ICONS.shield} className="h-4 w-4" />
            <div className="leading-tight">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-70">Proctoring</p>
              <p className="text-xs font-bold tabular-nums">{violations.length} / {MAX_VIOLATIONS} warnings</p>
            </div>
          </div>

          <div
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 ring-1 ring-inset transition-colors ${
              timeCritical ? 'bg-rose-500/15 ring-rose-400/50 text-rose-300 animate-pulse' : timeLow ? 'bg-amber-400/10 ring-amber-400/40 text-amber-200' : 'bg-white/[0.04] ring-white/10 text-white'
            }`}
            role="timer"
            aria-live="off"
          >
            <Icon d={ICONS.clock} className="h-4 w-4 opacity-70" />
            <div className="leading-tight">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">Time left</p>
              <p className="font-mono text-lg font-bold tabular-nums">{timeLeft !== null ? formatTime(timeLeft) : '--:--'}</p>
            </div>
          </div>
        </div>

        {/* Section tabs */}
        {sections.length > 0 && (
          <nav className="flex gap-1 overflow-x-auto px-4 sm:px-6" aria-label="Sections">
            {sections.map((s, si) => {
              const st = subjectStyle(s.subject);
              const done = s.indices.filter(i => isAnswered(answers[questions[i].id])).length;
              const active = si === currentSectionIndex;
              return (
                <button
                  key={s.subject}
                  onClick={() => goTo(s.indices[0])}
                  className={`group relative flex shrink-0 items-center gap-2.5 px-4 py-3 text-sm font-semibold transition-colors ${active ? 'text-white' : 'text-gray-500 hover:text-gray-200'}`}
                >
                  <span className={`h-2 w-2 rounded-full ${st.dot} ${active ? '' : 'opacity-60'}`} />
                  {s.subject}
                  <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${active ? 'bg-white/10 text-gray-200' : 'bg-white/[0.04] text-gray-500'}`}>
                    {done}/{s.indices.length}
                  </span>
                  <span className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full transition-all ${active ? `${st.dot}` : 'bg-transparent'}`} />
                </button>
              );
            })}
          </nav>
        )}
      </header>

      <div className="relative flex-1 flex flex-col md:flex-row min-h-0">
        {/* ── Question ── */}
        <main className="relative flex-1 min-h-0 overflow-y-auto">
          {/* Candidate watermark: discourages photographing the screen. */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.025]" aria-hidden="true">
            <div className="absolute -inset-1/2 flex flex-wrap content-start gap-x-24 gap-y-20 -rotate-[24deg]">
              {Array.from({ length: 80 }).map((_, i) => (
                <span key={i} className="whitespace-nowrap text-sm font-bold">{candidateRef.current.email || candidateRef.current.name}</span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto max-w-3xl px-4 sm:px-8 py-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${currentSubject.soft} ${currentSubject.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${currentSubject.dot}`} />
                  {currentSection?.subject}
                </span>
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">
                  Question <span className="text-white tabular-nums">{currentIndex + 1}</span> of {questions.length}
                  {sections.length > 1 && <span className="ml-2 normal-case tracking-normal text-gray-600">({positionInSection} of {currentSection.indices.length} in section)</span>}
                </span>
              </div>
              <button
                onClick={() => toggleFlag(currentQ.id)}
                aria-pressed={isFlaggedNow}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold ring-1 ring-inset transition-all active:scale-[0.97] ${
                  isFlaggedNow ? 'bg-amber-400/15 text-amber-200 ring-amber-400/60 shadow-[0_0_20px_-8px_rgba(251,191,36,0.8)]' : 'bg-white/[0.04] text-gray-400 ring-white/10 hover:text-white hover:ring-white/20'
                }`}
              >
                <Icon d={ICONS.flag} className="h-4 w-4" filled={isFlaggedNow} />
                {isFlaggedNow ? 'Marked for review' : 'Mark for review'}
              </button>
            </div>

            <div key={currentQ.id} className="mt-5 rounded-3xl bg-gradient-to-b from-white/[0.05] to-white/[0.015] p-6 sm:p-8 ring-1 ring-inset ring-white/[0.08] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)] animate-view-in">
              <div
                className="text-lg sm:text-xl font-medium leading-relaxed text-gray-100 prose prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: markersToHtml(replacePlaceholdersWithImages(currentQ.question, currentQ.inline_images)) }}
              />

              <div className="mt-8 space-y-3" role="radiogroup" aria-label="Answer options">
                {(options || []).map((opt: string, i: number) => {
                  const selected = answers[currentQ.id] === i;
                  const optImages = currentQ.option_inline_images?.[i] || [];
                  return (
                    <button
                      type="button"
                      key={i}
                      role="radio"
                      aria-checked={selected}
                      onClick={() => handleOptionSelect(currentQ.id, i)}
                      className={`group flex w-full items-center gap-4 rounded-2xl p-4 text-left ring-1 ring-inset transition-all duration-200 active:scale-[0.995] ${
                        selected
                          ? 'bg-emerald-400/[0.1] ring-emerald-400/70 shadow-[0_0_0_4px_rgba(16,185,129,0.08),0_12px_30px_-16px_rgba(16,185,129,0.7)]'
                          : 'bg-black/20 ring-white/[0.08] hover:bg-white/[0.04] hover:ring-white/20'
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black transition-all ${
                          selected ? 'bg-gradient-to-b from-emerald-400 to-emerald-500 text-gray-950 shadow-[0_6px_16px_-6px_rgba(16,185,129,0.9)]' : 'bg-white/[0.05] text-gray-400 ring-1 ring-inset ring-white/10 group-hover:text-white'
                        }`}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span
                        className={`flex-1 text-[15px] prose prose-invert max-w-none ${selected ? 'font-semibold text-white' : 'text-gray-300'}`}
                        dangerouslySetInnerHTML={{ __html: markersToHtml(replacePlaceholdersWithImages(opt || '[Image option]', optImages)) }}
                      />
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-2 transition ${selected ? 'ring-emerald-400' : 'ring-white/15'}`}>
                        <span className={`h-2.5 w-2.5 rounded-full bg-emerald-400 transition-transform duration-200 ${selected ? 'scale-100' : 'scale-0'}`} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => goTo(currentIndex - 1)}
                disabled={currentIndex === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.05] px-5 py-3 text-sm font-bold ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.08] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon d={ICONS.left} className="h-4 w-4" /> Previous
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => clearResponse(currentQ.id)}
                  disabled={!isAnswered(answers[currentQ.id])}
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-3 text-sm font-semibold text-gray-400 transition hover:bg-white/[0.04] hover:text-white disabled:pointer-events-none disabled:opacity-30"
                >
                  <Icon d={ICONS.eraser} className="h-4 w-4" /> Clear response
                </button>
                {currentIndex < questions.length - 1 ? (
                  <button
                    onClick={() => goTo(currentIndex + 1)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 px-5 py-3 text-sm font-bold text-gray-950 shadow-[0_10px_24px_-10px_rgba(16,185,129,0.9),inset_0_1px_0_rgba(255,255,255,0.35)] transition hover:brightness-110 active:scale-[0.98]"
                  >
                    Save & next <Icon d={ICONS.right} className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => setShowSubmitConfirm(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 px-5 py-3 text-sm font-bold text-gray-950 shadow-[0_10px_24px_-10px_rgba(16,185,129,0.9),inset_0_1px_0_rgba(255,255,255,0.35)] transition hover:brightness-110 active:scale-[0.98]"
                  >
                    Review & submit
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* ── Palette ── */}
        <aside className="relative z-10 flex w-full shrink-0 flex-col border-t border-white/[0.06] bg-[#0a0f18] md:w-[340px] md:border-l md:border-t-0 min-h-0">
          <div className="grid grid-cols-2 gap-2 border-b border-white/[0.06] p-4">
            {(Object.keys(PALETTE) as PaletteState[]).map(state => (
              <div key={state} className={`flex items-center gap-2 text-[11px] text-gray-400 ${state === 'flagged_answered' ? 'col-span-2' : ''}`}>
                <PaletteSwatch state={state} />
                <span className="flex-1 truncate">{PALETTE[state].label}</span>
                <span className="font-bold tabular-nums text-gray-200">{stats[state]}</span>
              </div>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-5">
            {sections.map((s, si) => {
              const st = subjectStyle(s.subject);
              const done = s.indices.filter(i => isAnswered(answers[questions[i].id])).length;
              return (
                <section key={s.subject} aria-label={`${s.subject} questions`}>
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] text-gray-300">
                      <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                      {s.subject}
                    </span>
                    <span className="text-[11px] font-semibold tabular-nums text-gray-500">{done}/{s.indices.length} answered</span>
                  </div>
                  <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.05]">
                    <div className={`h-full rounded-full ${st.dot} transition-all duration-500`} style={{ width: `${(done / s.indices.length) * 100}%` }} />
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    {s.indices.map(idx => {
                      const q = questions[idx];
                      const state = paletteState(q);
                      const active = idx === currentIndex;
                      return (
                        <button
                          key={q.id}
                          onClick={() => goTo(idx)}
                          aria-label={`Question ${idx + 1}: ${PALETTE[state].label}`}
                          aria-current={active ? 'step' : undefined}
                          className={`relative flex h-10 items-center justify-center rounded-xl text-[13px] font-bold tabular-nums transition-all duration-150 active:scale-95 ${PALETTE[state].tile} ${
                            active ? 'outline outline-2 outline-offset-2 outline-white' : ''
                          } ${si === currentSectionIndex ? '' : 'opacity-80 hover:opacity-100'}`}
                        >
                          {idx + 1}
                          <PaletteBadges state={state} />
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          <div className="border-t border-white/[0.06] p-4">
            <div className="mb-3 flex items-center justify-between text-xs">
              <span className="text-gray-500">Answered</span>
              <span className="font-bold tabular-nums">{answeredCount} <span className="text-gray-500">/ {questions.length}</span></span>
            </div>
            <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-500" style={{ width: `${(answeredCount / Math.max(questions.length, 1)) * 100}%` }} />
            </div>
            <button
              onClick={() => setShowSubmitConfirm(true)}
              disabled={isSubmitting}
              className="w-full rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 py-3.5 text-[15px] font-bold text-gray-950 shadow-[0_12px_30px_-12px_rgba(16,185,129,0.9),inset_0_1px_0_rgba(255,255,255,0.35)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
            >
              {isSubmitting ? 'Submitting…' : 'Submit test'}
            </button>
          </div>
        </aside>
      </div>

      {/* ── Submit confirmation (in-page: a browser confirm() would leave fullscreen) ── */}
      {showSubmitConfirm && (
        <Overlay>
          <h3 className="text-xl font-extrabold">Submit your test?</h3>
          <p className="mt-1 text-sm text-gray-400">You can't change your answers after submitting.</p>
          <div className="mt-5 overflow-hidden rounded-2xl ring-1 ring-inset ring-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.04] text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                <tr><th className="px-4 py-2.5 text-left">Section</th><th className="px-2 py-2.5">Answered</th><th className="px-2 py-2.5">Marked</th><th className="px-4 py-2.5">Unanswered</th></tr>
              </thead>
              <tbody>
                {sections.map(s => {
                  const ids = s.indices.map(i => questions[i].id);
                  const ans = ids.filter(id => isAnswered(answers[id])).length;
                  const mk = ids.filter(id => flagged.has(id)).length;
                  return (
                    <tr key={s.subject} className="border-t border-white/[0.06] text-center tabular-nums">
                      <td className="px-4 py-2.5 text-left font-semibold">
                        <span className="inline-flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${subjectStyle(s.subject).dot}`} />{s.subject}</span>
                      </td>
                      <td className="px-2 py-2.5 text-emerald-300">{ans}</td>
                      <td className="px-2 py-2.5 text-amber-200">{mk}</td>
                      <td className="px-4 py-2.5 text-rose-300">{ids.length - ans}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {questions.length - answeredCount > 0 && (
            <p className="mt-4 flex items-center gap-2 text-xs text-amber-200">
              <Icon d={ICONS.warn} className="h-4 w-4" /> {questions.length - answeredCount} question{questions.length - answeredCount === 1 ? ' is' : 's are'} still unanswered.
            </p>
          )}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button onClick={() => setShowSubmitConfirm(false)} className="rounded-xl bg-white/[0.05] py-3 font-bold ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.08]">
              Keep working
            </button>
            <button
              onClick={() => submitTestEngine('finished')}
              disabled={isSubmitting}
              className="rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 py-3 font-bold text-gray-950 transition hover:brightness-110 disabled:opacity-60"
            >
              {isSubmitting ? 'Submitting…' : 'Submit now'}
            </button>
          </div>
        </Overlay>
      )}

      {/* ── Violation warning / fullscreen gate ── */}
      {(activeWarning || needsFullscreen) && !isSubmitting && (
        <Overlay tone={activeWarning ? 'danger' : 'neutral'}>
          {activeWarning ? (
            <>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-400/40">
                  <Icon d={ICONS.warn} className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-rose-300">Warning {violations.length} of {MAX_VIOLATIONS}</p>
                  <h3 className="text-xl font-extrabold">{VIOLATION_COPY[activeWarning.type].title}</h3>
                </div>
              </div>
              <p className="mt-4 text-sm text-gray-300">{VIOLATION_COPY[activeWarning.type].detail}</p>
              <div className="mt-5 flex items-center gap-2">
                {Array.from({ length: MAX_VIOLATIONS }).map((_, i) => (
                  <span key={i} className={`h-2 flex-1 rounded-full ${i < violations.length ? 'bg-rose-500' : 'bg-white/10'}`} />
                ))}
              </div>
              <p className="mt-3 text-sm font-semibold text-rose-200">
                {strikesLeft === 1
                  ? 'One more violation will close your test automatically.'
                  : `${strikesLeft} more violations will close your test automatically.`}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
                  <Icon d={ICONS.expand} className="h-6 w-6" />
                </span>
                <h3 className="text-xl font-extrabold">Return to fullscreen</h3>
              </div>
              <p className="mt-4 text-sm text-gray-300">The exam must run in fullscreen. Your timer is still running.</p>
            </>
          )}
          <button
            onClick={async () => {
              setActiveWarning(null);
              await enterFullscreen();
            }}
            className="mt-6 w-full rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 py-3.5 font-bold text-gray-950 shadow-[0_12px_30px_-12px_rgba(16,185,129,0.9)] transition hover:brightness-110 active:scale-[0.99]"
          >
            {needsFullscreen ? 'I understand — resume in fullscreen' : 'I understand — continue test'}
          </button>
        </Overlay>
      )}

      {isSubmitting && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm" role="status">
          <div className="flex items-center gap-3 rounded-2xl bg-[#0d131d] px-6 py-4 ring-1 ring-white/10">
            <div className="h-5 w-5 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-spin" />
            <span className="text-sm font-semibold">Submitting your answers…</span>
          </div>
        </div>
      )}
    </div>
  );
};

const PaletteSwatch: React.FC<{ state: PaletteState }> = ({ state }) => (
  <span className={`relative inline-block h-4 w-4 shrink-0 rounded-[5px] ${PALETTE[state].swatch}`}>
    {state === 'flagged_answered' && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[#0a0f18]" />}
  </span>
);

/** Corner marks that make "answered" and "marked for review" readable at the same time. */
const PaletteBadges: React.FC<{ state: PaletteState }> = ({ state }) => {
  if (state !== 'flagged' && state !== 'flagged_answered') return null;
  return (
    <>
      <span className="absolute -left-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-gray-950 ring-2 ring-[#0a0f18]">
        <svg className="h-2 w-2" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2h2v20H4zM7 3h11l-2.5 4L18 11H7z" /></svg>
      </span>
      {state === 'flagged_answered' && (
        <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-400 text-gray-950 ring-2 ring-[#0a0f18]">
          <svg className="h-2 w-2" fill="none" stroke="currentColor" strokeWidth={4} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
        </span>
      )}
    </>
  );
};

const Overlay: React.FC<{ children: React.ReactNode; tone?: 'neutral' | 'danger' }> = ({ children, tone = 'neutral' }) => (
  <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" role="dialog" aria-modal="true">
    <div
      className={`w-full max-w-md rounded-3xl bg-[#0d131d] p-7 ring-1 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9)] animate-menu-in ${
        tone === 'danger' ? 'ring-rose-400/40' : 'ring-white/10'
      }`}
    >
      {children}
    </div>
  </div>
);

export default TakeTest;
