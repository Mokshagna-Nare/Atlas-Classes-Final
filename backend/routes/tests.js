/**
 * Online test delivery. The browser never decides who may take a test or what the score is:
 *
 *   GET  /api/tests/:id/session      who may take it, test details, questions WITHOUT answers
 *   POST /api/tests/:id/guest-check  has this email already taken the (public) test?
 *   POST /api/tests/:id/submit       re-checks access, grades on the server, saves the attempt
 *   GET  /api/tests/my-ranks         the signed-in student's rank in every test they took
 *
 * Access rules
 *   - A test assigned to classes (or tied to an institute) can only be taken by a signed-in
 *     student in one of those classes (or, with no classes listed, of that institute).
 *   - A test with no institute and no classes is a public link: anyone may take it, once per email.
 *   - Admin and institute accounts can't take tests.
 *   - Only inside the test window (submissions get a short grace for the auto-submit at the end).
 */
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../supabaseClient');
const { identify } = require('../middleware/requireAuth');

const SUBMIT_GRACE_MS = 10 * 60 * 1000;
const MAX_VIOLATIONS = 3;
const QUESTION_FIELDS = 'id, question, options, subject, topic, sub_topic, difficulty, question_type, marks, imageUrl, option_images, inline_images, option_inline_images';

class AccessError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

/** Correct option index — same rules as utils/mcqAnswer.ts on the frontend. */
function correctIndexOf(mcq) {
  if (mcq.answer_index !== undefined && mcq.answer_index !== null) return mcq.answer_index;
  if (!mcq.answer) return null;
  const answer = String(mcq.answer).trim();
  if (/^[A-D]$/i.test(answer)) return answer.toUpperCase().charCodeAt(0) - 65;
  const options = mcq.options || [];
  if (/^\d+$/.test(answer)) {
    const n = parseInt(answer, 10);
    if (n >= 0 && n < options.length) return n;
  }
  const i = options.findIndex(o => String(o).toLowerCase() === answer.toLowerCase());
  return i === -1 ? null : i;
}

/** The caller's profile when a valid Supabase token was sent, otherwise null (a guest). */
async function callerOf(req) {
  if (!req.headers.authorization) return null;
  const result = await identify(req);
  if (!result.auth) return null;
  const { data } = await supabaseAdmin.from('users').select('id, name, email, role, institute_id, class_id').eq('id', result.auth.userId).maybeSingle();
  return data || null;
}

async function loadTest(testId) {
  const { data: test, error } = await supabaseAdmin.from('tests').select('*').eq('id', testId).maybeSingle();
  if (error || !test) throw new AccessError(404, 'not_found', 'This test does not exist or has been removed.');
  const { data: assignments } = await supabaseAdmin.from('test_assignments').select('class_id').eq('test_id', testId);
  return { test, classIds: (assignments || []).map(a => a.class_id) };
}

/** Throws AccessError unless the caller may take this test now. Returns 'student' or 'guest'. */
function checkAccess({ test, classIds }, caller, { submitting = false } = {}) {
  const now = Date.now();
  const start = new Date(test.start_window).getTime();
  const end = new Date(test.end_window).getTime();
  if (now < start) throw new AccessError(403, 'not_started', 'This test has not started yet.', { opensAt: test.start_window });
  if (now > end + (submitting ? SUBMIT_GRACE_MS : 0)) throw new AccessError(403, 'closed', 'This test has closed.', { closedAt: test.end_window });

  if (caller && caller.role !== 'student') {
    throw new AccessError(403, 'staff_account', 'Admin and institute accounts can’t take tests. Sign out and open the link as a student.');
  }

  const restricted = classIds.length > 0 || Boolean(test.institute_id);
  if (!restricted) return caller ? 'student' : 'guest';

  if (!caller) throw new AccessError(401, 'sign_in_required', 'This test is only for the students it was assigned to. Please sign in with your student account.');
  const allowed = classIds.length > 0 ? classIds.includes(caller.class_id) : caller.institute_id === test.institute_id;
  if (!allowed) throw new AccessError(403, 'not_assigned', 'This test hasn’t been assigned to your class.');
  return 'student';
}

async function existingGuestAttempt(testId, email) {
  const { data } = await supabaseAdmin
    .from('test_attempts')
    .select('*')
    .eq('test_id', testId)
    .is('student_id', null)
    .ilike('guest_email', email.replace(/[\\%_]/g, ch => `\\${ch}`))
    .limit(1);
  return data && data[0];
}

const summaryOf = attempt => ({
  score: attempt.score,
  total_correct: attempt.total_correct,
  total_wrong: attempt.total_wrong,
  status: attempt.status,
  violation_count: attempt.violation_count,
});

const sendError = (res, err) => {
  if (err instanceof AccessError) return res.status(err.status).json({ code: err.code, message: err.message, ...err.extra });
  console.error('Test route error:', err.message);
  return res.status(500).json({ code: 'server_error', message: 'Something went wrong. Please try again.' });
};

// The signed-in student's rank in each test they've taken (registered students only).
// Declared before /:id routes so "my-ranks" isn't read as a test id.
router.get('/my-ranks', async (req, res) => {
  try {
    const caller = await callerOf(req);
    if (!caller || caller.role !== 'student') return res.status(401).json({ message: 'Please sign in as a student.' });
    const { data: mine } = await supabaseAdmin.from('test_attempts').select('test_id, score').eq('student_id', caller.id);
    const testIds = [...new Set((mine || []).map(a => a.test_id))];
    const ranks = {};
    if (testIds.length) {
      const { data: all } = await supabaseAdmin.from('test_attempts').select('test_id, student_id, score').in('test_id', testIds).not('student_id', 'is', null);
      for (const testId of testIds) {
        const scored = (all || []).filter(a => a.test_id === testId);
        const me = scored.find(a => a.student_id === caller.id);
        // Competition ranking: tied scores share a rank.
        ranks[testId] = { rank: me ? 1 + scored.filter(a => a.score > me.score).length : scored.length + 1, total: scored.length || 1 };
      }
    }
    res.json({ ranks });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/:id/session', async (req, res) => {
  try {
    const caller = await callerOf(req);
    const loaded = await loadTest(req.params.id);
    const mode = checkAccess(loaded, caller);
    const { test } = loaded;
    const details = {
      id: test.id,
      title: test.title,
      duration_minutes: test.duration_minutes,
      start_window: test.start_window,
      end_window: test.end_window,
      question_count: (test.question_ids || []).length,
    };

    if (mode === 'student') {
      const { data: prior } = await supabaseAdmin.from('test_attempts').select('*').eq('test_id', test.id).eq('student_id', caller.id).maybeSingle();
      if (prior) return res.json({ test: details, mode, priorAttempt: summaryOf(prior) });
    }

    const ids = test.question_ids || [];
    const { data: questions, error } = ids.length
      ? await supabaseAdmin.from('mcqs').select(QUESTION_FIELDS).in('id', ids)
      : { data: [], error: null };
    if (error) throw error;
    const position = new Map(ids.map((id, i) => [id, i]));
    const ordered = (questions || []).sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
    res.json({
      test: details,
      mode,
      candidate: caller ? { name: caller.name, email: caller.email } : null,
      questions: ordered,
    });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/:id/guest-check', async (req, res) => {
  try {
    const caller = await callerOf(req);
    const loaded = await loadTest(req.params.id);
    if (checkAccess(loaded, caller) !== 'guest') return res.json({ available: true });
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ message: 'Enter your email address.' });
    const prior = await existingGuestAttempt(loaded.test.id, email);
    if (!prior) return res.json({ available: true });
    const closed = prior.status === 'terminated' || (prior.violation_count ?? 0) >= MAX_VIOLATIONS;
    res.json({ available: false, reason: closed ? 'terminated' : 'taken' });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/:id/submit', async (req, res) => {
  try {
    const caller = await callerOf(req);
    const loaded = await loadTest(req.params.id);
    const mode = checkAccess(loaded, caller, { submitting: true });
    const { test } = loaded;

    const body = req.body || {};
    const outcome = body.status === 'terminated' ? 'terminated' : 'finished';
    const violations = Array.isArray(body.violations) ? body.violations.slice(0, 50) : [];
    const rawAnswers = body.answers && typeof body.answers === 'object' ? body.answers : {};

    let identity;
    if (mode === 'student') {
      identity = { student_id: caller.id };
    } else {
      const name = String(body.guest_name || '').trim().slice(0, 120);
      const email = String(body.guest_email || '').trim().toLowerCase().slice(0, 200);
      if (!name || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ code: 'bad_candidate', message: 'Enter your name and a valid email address.' });
      identity = { guest_name: name, guest_email: email };
    }

    // Grade against the answer keys, which never leave the server.
    const ids = test.question_ids || [];
    const { data: mcqs, error: mcqError } = ids.length
      ? await supabaseAdmin.from('mcqs').select('id, options, answer, answer_index').in('id', ids)
      : { data: [], error: null };
    if (mcqError) throw mcqError;
    const answers = {};
    let correct = 0;
    for (const q of mcqs || []) {
      const picked = rawAnswers[q.id];
      if (!Number.isInteger(picked) || picked < 0 || picked >= (q.options || []).length) continue;
      answers[q.id] = picked;
      if (picked === correctIndexOf(q)) correct++;
    }
    const total = ids.length;
    const score = total ? Math.round((correct / total) * 100) : 0;
    const count = (...types) => violations.filter(v => v && types.includes(v.type)).length;

    let row = {
      test_id: test.id,
      ...identity,
      score,
      total_correct: correct,
      total_wrong: Object.keys(answers).length - correct, // answered but incorrect; skipped ones aren't wrong
      status: outcome,
      end_time: new Date().toISOString(),
      answers,
      tab_switch_count: count('tab_switch', 'window_blur'),
      fullscreen_exit_count: count('fullscreen_exit'),
      flagged: outcome === 'terminated' || violations.length > 0,
      violation_count: violations.length,
      violations,
    };

    let { error } = await supabaseAdmin.from('test_attempts').insert(row);
    // Older databases: no 'terminated' status yet (23514) or no violation columns (42703/PGRST204).
    if (error && error.code === '23514') ({ error } = await supabaseAdmin.from('test_attempts').insert((row = { ...row, status: 'finished' })));
    if (error && (error.code === '42703' || error.code === 'PGRST204')) {
      const { violation_count, violations: _log, ...rest } = row;
      ({ error } = await supabaseAdmin.from('test_attempts').insert(rest));
    }
    if (error && error.code === '23505') return res.status(409).json({ code: 'already_submitted', message: 'This test has already been submitted.' });
    if (error) throw error;

    res.json({ score, correct, total });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
