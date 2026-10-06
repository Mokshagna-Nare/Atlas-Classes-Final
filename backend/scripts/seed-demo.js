/**
 * Demo analytics data for Atlas Classes.
 *
 *   npm run seed:demo          → (re)create the demo student, classmates, questions and 12 weekly tests
 *   npm run seed:demo:remove   → delete everything this script created (and nothing else)
 *
 * Everything lives under its own "Atlas Demo Academy" institute, so no real institute ever
 * sees demo students or tests. Only touches clearly demo-labelled rows: that institute,
 * tests titled "[Demo] …", questions with source "Atlas demo seed", users with an
 * @demo.atlasclasses.test email, and the "[Demo] PU II Science" class.
 * Logins (kept stable across reruns):
 *   student   demo.student@atlasclasses.test   / Demo@1234
 *   institute demo.institute@atlasclasses.test / Demo@1234
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const BANK = require('./demo-questions.js');

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const DEMO_EMAIL = 'demo.student@atlasclasses.test';
const DEMO_INSTITUTE_EMAIL = 'demo.institute@atlasclasses.test';
const DEMO_INSTITUTE_NAME = 'Atlas Demo Academy';
const DEMO_PASSWORD = 'Demo@1234';
const DEMO_DOMAIN = '@demo.atlasclasses.test';
const DEMO_CLASS = '[Demo] PU II Science';
const SOURCE = 'Atlas demo seed';
let INSTITUTE_ID = null; // resolved to the demo institute at runtime

async function ensureDemoInstitute() {
  const { data: existing } = await db.from('users').select('id').eq('email', DEMO_INSTITUTE_EMAIL).maybeSingle();
  if (existing) return existing.id;
  const { data: a, error } = await db.auth.admin.createUser({ email: DEMO_INSTITUTE_EMAIL, password: DEMO_PASSWORD, email_confirm: true });
  if (error) throw error;
  const id = a.user.id;
  const { error: iErr } = await db.from('institutes').insert({ id, name: DEMO_INSTITUTE_NAME, email: DEMO_INSTITUTE_EMAIL });
  if (iErr) { await db.auth.admin.deleteUser(id).catch(() => {}); throw iErr; }
  const { error: uErr } = await db.from('users').insert({ id, institute_id: id, role: 'institute', email: DEMO_INSTITUTE_EMAIL, name: DEMO_INSTITUTE_NAME });
  if (uErr) throw uErr;
  return id;
}

// Deterministic randomness so every run tells the same story.
let seed = 20260930;
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const opts = o => (typeof o === 'string' ? (() => { try { return JSON.parse(o) || []; } catch { return []; } })() : o || []);

// Mirrors utils/mcqAnswer.ts getCorrectOptionIndex
function correctIndex(m) {
  if (m.answer_index !== undefined && m.answer_index !== null) return m.answer_index;
  if (!m.answer) return null;
  const u = m.answer.trim().toUpperCase();
  if (/^[A-D]$/.test(u)) return u.charCodeAt(0) - 65;
  const o = opts(m.options), n = parseInt(m.answer.trim(), 10);
  if (!isNaN(n) && n >= 0 && n < o.length) return n;
  const i = o.findIndex(x => (x || '').toLowerCase() === m.answer.toLowerCase());
  return i !== -1 ? i : null;
}

// 4 weekly tests per month across July, August, September 2026.
const DATES = [];
for (const mo of [6, 7, 8]) for (const d of [5, 12, 19, 26]) DATES.push(new Date(Date.UTC(2026, mo, d, 10, 30)));

const DEMO_BASE = [0.42, 0.48, 0.45, 0.54, 0.58, 0.51, 0.62, 0.67, 0.65, 0.72, 0.78, 0.84];
const DEMO_VIOLATIONS = [[0,0],[0,0],[1,0],[0,0],[0,0],[3,1],[0,0],[1,0],[0,0],[0,0],[2,1],[0,0]]; // [tabSwitches, fullscreenExits]
const SUBJECT_OFFSET = { Biology: 0.08, Chemistry: 0, Physics: -0.12, Mathematics: -0.05 };
const PHYSICS_CATCHUP = 0.012; // physics improves faster over the term
const DIFFICULTY_ADJ = { Easy: 0.15, Medium: 0, Hard: -0.2 };
const CLASSMATES = [['Aarav Mehta',0.76,0.006],['Diya Nair',0.68,0.01],['Kabir Reddy',0.54,0.02],['Ishita Rao',0.62,0],['Vihaan Kulkarni',0.48,0.015],['Ananya Iyer',0.65,0.012],['Rohan Das',0.42,0.008]];

const answerQuestions = (questions, base, testIndex, isDemoStudent) => {
  const answers = {};
  let correct = 0;
  for (const q of questions) {
    const ci = correctIndex(q), n = opts(q.options).length || 4;
    let p = base + (DIFFICULTY_ADJ[q.difficulty] || 0);
    if (isDemoStudent) p += (SUBJECT_OFFSET[q.subject] || 0) + (q.subject === 'Physics' ? PHYSICS_CATCHUP * testIndex : 0);
    p = Math.min(0.97, Math.max(0.05, p));
    if (rand() < 0.03) continue; // occasional skipped question
    if (ci !== null && rand() < p) { answers[q.id] = ci; correct++; }
    else { let w = Math.floor(rand() * n); if (w === ci) w = (w + 1) % n; answers[q.id] = w; }
  }
  return { answers, correct, wrong: Object.keys(answers).length - correct };
};

async function removeDemoData({ keepStudent }) {
  const testIds = [];
  for (const pattern of ['[Demo]%', 'DEMO Test%']) {
    const { data } = await db.from('tests').select('id').like('title', pattern);
    (data || []).forEach(t => testIds.push(t.id));
  }
  if (testIds.length) {
    await db.from('test_attempts').delete().in('test_id', testIds);
    await db.from('test_assignments').delete().in('test_id', testIds);
    await db.from('tests').delete().in('id', testIds);
  }
  await db.from('mcqs').delete().eq('source', SOURCE);

  const { data: demoUsers } = await db.from('users').select('id, email').like('email', `%${DEMO_DOMAIN}`);
  const toDelete = (demoUsers || []).filter(u => !(keepStudent && u.email === DEMO_EMAIL));
  if (toDelete.length) {
    await db.from('test_attempts').delete().in('student_id', toDelete.map(u => u.id));
    await db.from('users').delete().in('id', toDelete.map(u => u.id));
    for (const u of toDelete.filter(u => u.email === DEMO_EMAIL)) await db.auth.admin.deleteUser(u.id).catch(() => {});
  }
  if (!keepStudent) {
    await db.from('classes').delete().eq('name', DEMO_CLASS);
    const { data: inst } = await db.from('users').select('id').eq('email', DEMO_INSTITUTE_EMAIL).maybeSingle();
    if (inst) {
      await db.from('users').delete().eq('id', inst.id);
      await db.from('institutes').delete().eq('id', inst.id);
      await db.auth.admin.deleteUser(inst.id).catch(() => {});
    }
  }
  return { tests: testIds.length, users: toDelete.length };
}

async function seedDemoData() {
  const removed = await removeDemoData({ keepStudent: true });
  console.log(`Cleared ${removed.tests} old demo tests, demo questions and ${removed.users} demo classmates.`);
  INSTITUTE_ID = await ensureDemoInstitute();
  console.log(`Demo institute: ${DEMO_INSTITUTE_NAME} (${INSTITUTE_ID})`);

  // Authored Physics / Chemistry / Maths questions
  const rows = [];
  const codes = { Physics: 'PHY', Chemistry: 'CHE', Mathematics: 'MAT' };
  const counter = {};
  for (const [subject, topics] of Object.entries(BANK)) {
    for (const [topic, questions] of Object.entries(topics)) {
      for (const [question, options, idx, difficulty, skill] of questions) {
        counter[subject] = (counter[subject] || 0) + 1;
        rows.push({
          question, type: 'Multiple Choice', options, answer: options[idx], answer_index: idx, explanation: '',
          subject, topic, sub_topic: topic, difficulty, skill_type: skill, marks: 4, grade: '11', question_type: 'MCQ',
          question_code: `DEMO-${codes[subject]}-${String(counter[subject]).padStart(3, '0')}`,
          source: SOURCE, remarks: 'Demo data — safe to delete', isFlagged: false,
        });
      }
    }
  }
  const { data: inserted, error: qErr } = await db.from('mcqs').insert(rows).select('*');
  if (qErr) throw qErr;
  console.log(`Inserted ${inserted.length} authored questions:`, counter);

  // Demo class + demo student (login kept stable across reruns)
  let { data: cls } = await db.from('classes').select('id').eq('institute_id', INSTITUTE_ID).eq('name', DEMO_CLASS).maybeSingle();
  if (!cls) {
    const r = await db.from('classes').insert({ institute_id: INSTITUTE_ID, name: DEMO_CLASS, subjects: ['Physics', 'Chemistry', 'Biology', 'Mathematics'] }).select('id').single();
    if (r.error) throw r.error;
    cls = r.data;
  }
  // Earlier versions put the demo class under a real institute — remove any such leftovers.
  await db.from('classes').delete().eq('name', DEMO_CLASS).neq('institute_id', INSTITUTE_ID);
  let { data: student } = await db.from('users').select('id').eq('email', DEMO_EMAIL).maybeSingle();
  if (!student) {
    const { data: a, error } = await db.auth.admin.createUser({ email: DEMO_EMAIL, password: DEMO_PASSWORD, email_confirm: true });
    if (error) throw error;
    const { error: uErr } = await db.from('users').insert({ id: a.user.id, name: 'Demo Student', email: DEMO_EMAIL, role: 'student', institute_id: INSTITUTE_ID, class_id: cls.id, roll_no: 'DEMO-01', password: DEMO_PASSWORD });
    if (uErr) throw uErr;
    student = { id: a.user.id };
  } else {
    await db.from('users').update({ class_id: cls.id, institute_id: INSTITUTE_ID }).eq('id', student.id);
  }

  // Classmates: DB rows only (no login), so class rank means something
  const mates = CLASSMATES.map(([name, base, trend], i) => ({
    base, trend,
    row: { id: crypto.randomUUID(), name, email: `classmate${i + 1}${DEMO_DOMAIN}`, role: 'student', institute_id: INSTITUTE_ID, class_id: cls.id, roll_no: `DEMO-${String(i + 2).padStart(2, '0')}` },
  }));
  const { error: mErr } = await db.from('users').insert(mates.map(m => m.row));
  if (mErr) throw mErr;

  // Question pools: Biology from the real bank, the rest from the authored demo set
  const bio = [];
  for (let f = 0; f < 5000; f += 1000) {
    const { data } = await db.from('mcqs').select('*').eq('subject', 'Biology').eq('isFlagged', false).range(f, f + 999);
    if (!data || data.length === 0) break;
    bio.push(...data);
  }
  const pools = { Biology: shuffle(bio.filter(q => correctIndex(q) !== null)) };
  for (const s of ['Physics', 'Chemistry', 'Mathematics']) pools[s] = shuffle(inserted.filter(q => q.subject === s));
  if (pools.Biology.length < 63) throw new Error('Not enough Biology questions in the bank for the NEET-pattern tests.');
  const cursor = {};
  const take = (s, n) => Array.from({ length: n }, () => { const c = cursor[s] || 0; cursor[s] = c + 1; return pools[s][c % pools[s].length]; });

  // 12 weekly tests: week 3 of each month is a JEE-pattern mock, the rest NEET-pattern
  for (let i = 0; i < DATES.length; i++) {
    const jee = i % 4 === 2;
    const questions = jee
      ? [...take('Physics', 5), ...take('Chemistry', 5), ...take('Mathematics', 5)]
      : [...take('Physics', 4), ...take('Chemistry', 4), ...take('Biology', 7)];
    const date = DATES[i];
    const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const title = `[Demo] ${month} Week ${(i % 4) + 1} · ${jee ? 'JEE' : 'NEET'} Mock`;

    const { data: test, error: tErr } = await db.from('tests').insert({
      title, duration_minutes: 30, status: 'completed', institute_id: INSTITUTE_ID,
      start_window: new Date(date.getTime() - 2 * 3600e3).toISOString(),
      end_window: new Date(date.getTime() + 22 * 3600e3).toISOString(),
      question_ids: questions.map(q => q.id),
    }).select().single();
    if (tErr) throw tErr;
    await db.from('test_assignments').insert({ test_id: test.id, class_id: cls.id, opens_at: test.start_window, closes_at: test.end_window });

    const endAt = mins => new Date(date.getTime() + mins * 60e3).toISOString();
    const demo = answerQuestions(questions, DEMO_BASE[i], i, true);
    const [tabs, fs] = DEMO_VIOLATIONS[i];
    const score = Math.round((demo.correct / questions.length) * 100);
    const { error: aErr } = await db.from('test_attempts').insert({
      test_id: test.id, student_id: student.id, score, total_correct: demo.correct, total_wrong: demo.wrong,
      status: 'finished', end_time: endAt(25), answers: demo.answers,
      tab_switch_count: tabs, fullscreen_exit_count: fs, flagged: tabs >= 3 || fs >= 3,
    });
    if (aErr) throw aErr;

    const mateRows = mates.map((m, k) => {
      const acc = Math.min(0.95, Math.max(0.15, m.base + m.trend * i + (rand() - 0.5) * 0.16));
      const a = answerQuestions(questions, acc, i, false);
      return {
        test_id: test.id, student_id: m.row.id, score: Math.round((a.correct / questions.length) * 100),
        total_correct: a.correct, total_wrong: a.wrong, status: 'finished', end_time: endAt(20 + k), answers: a.answers,
        tab_switch_count: 0, fullscreen_exit_count: 0, flagged: false,
      };
    });
    const { error: mateErr } = await db.from('test_attempts').insert(mateRows);
    if (mateErr) throw mateErr;

    const rank = 1 + mateRows.filter(r => r.score > score).length;
    console.log(`${title.padEnd(34)} ${String(score).padStart(3)}%  #${rank}/${mateRows.length + 1}${tabs >= 3 || fs >= 3 ? '  [flagged]' : ''}`);
  }
  console.log(`\nDone. Demo logins (password ${DEMO_PASSWORD}):\n  student   ${DEMO_EMAIL}\n  institute ${DEMO_INSTITUTE_EMAIL}`);
}

const run = process.argv.includes('--remove')
  ? removeDemoData({ keepStudent: false }).then(r => console.log(`Removed ${r.tests} demo tests, all demo questions, ${r.users} demo users and the demo class.`))
  : seedDemoData();

run.catch(e => { console.error('Demo seed failed:', e.message || e); process.exit(1); });
