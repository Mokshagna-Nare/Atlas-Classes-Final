/**
 * One-off data fix: textbook formatting for the Class 11 questions imported on 10 Oct 2026
 * (codes 26M11-*, 26P11-*). They were imported with maths typed flat — "sin x/1 + cos x"
 * for sin x over (1 + cos x), "π/6", "√(cos) x" — so fractions showed on one line and some
 * read wrongly. This rewrites the question, options and answer of the rows listed below into
 * the [FRAC]/[SUB] markers the app typesets (same format bulk upload produces).
 *
 *   node scripts/data-fixes/2026-10-10-maths-format.js                 → dry run: prints every change
 *   node scripts/data-fixes/2026-10-10-maths-format.js --apply         → backs up the rows, then writes
 *   node scripts/data-fixes/2026-10-10-maths-format.js --restore FILE  → puts a backup back
 *
 * Only formatting changes. Wording, numbers and answer keys are untouched; an answer that matched
 * an option keeps matching it (it is converted exactly like that option).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const F = (num, den) => `[FRAC]${num}[SEP]${den}[/FRAC]`;
const RE = 'R[SUB]E[/SUB]';
const ME = 'M[SUB]E[/SUB]';

// Per row: `auto` converts simple fractions (π/6, (2n+1)π/6, 2x/3, −5/3, 1/√(2)) in fields without
// an explicit fix. Explicit fixes are [exact text, replacement] pairs; the text must occur exactly once.
// They cover fractions whose numerator or denominator spans several terms, where the flat text
// alone can't say where the fraction ends (each checked against the row's worked solution).
const FIXES = {
  // ── Mathematics ──
  '90939543-4726-40df-8304-5e6fadf5c9d3': { code: '26M11-05', auto: true },
  '3f85417f-bb4a-4862-a20d-ccb1e05050ce': { code: '26M11-07', auto: true },
  'a0d55035-3a8f-4de6-b3ef-2418f0953a18': { code: '26M11-08', auto: true },
  'e311546e-1c46-4cda-8a04-c2481e7e9b03': { code: '26M11-09', auto: true },
  'a163db31-f1c4-4963-a0d3-0b026b048e10': { code: '26M11-10', auto: true },
  'ca9dd878-d3fc-4524-b1d8-12469943d2f7': { code: '26M11-11', auto: true },
  '9f923e22-e836-48cd-a85b-70f24c3d3774': { code: '26M11-12', auto: true, question: [['f(x) = 1/sin x · cos x', `f(x) = ${F('1', 'sin x · cos x')}`]] },
  '2cdd3dac-fd8f-4273-af3a-4ed902e42db4': { code: '26M11-14', auto: true },
  'd2368909-aaa2-4809-97df-c05b5a70b9c5': { code: '26M11-17', auto: true },
  'd5f639db-e39e-4f70-a9d9-925df09ff24b': { code: '26M11-19', auto: true },
  '85d6c25a-0332-4c1d-aa07-e7677a54dc60': { code: '26M11-21', auto: true },
  'ac293eb4-08b6-45c4-9377-0568419de016': { code: '26M11-22', auto: true },
  '0753dd7b-a428-4d37-8d75-b35ea2decd49': { code: '26M11-23', auto: true },
  '7be3c909-f806-4cee-a162-cb694f0b493f': { code: '26M11-24', auto: true },
  '6585b57c-7415-477b-b891-b9e18860d007': { code: '26M11-25', auto: true },
  '39d042c2-bd69-4a0b-8af5-cd639d330958': { code: '26M11-26', auto: true },
  '2b58245c-d530-4b81-97f2-64248b018a1e': { code: '26M11-29', auto: true },
  'd587130b-c0eb-4b62-8e30-c6a85ebb808a': { code: '26M11-31', auto: true, question: [['sin x + 1/sin x, where', `sin x + ${F('1', 'sin x')}, where`]] },
  '7c915a9f-e5cf-4cd6-9ad7-8126dd1fb69f': { code: '26M11-32', auto: true, question: [['f(x) = √(cos) x is', 'f(x) = √(cos x) is']] },
  '1d1d4ced-6147-489d-ac09-72da232c37c2': { code: '26M11-35', auto: true, question: [['f(x) = cos x/x² + 1 is', `f(x) = ${F('cos x', 'x² + 1')} is`]] },
  '7d086849-a503-423a-900b-d79195a87ca5': { code: '26M11-37', auto: true, question: [['f(x) = 1/2 + sin x is', `f(x) = ${F('1', '2 + sin x')} is`]] },
  'e88e5c3f-000c-448c-8d2e-8e2cc73b24dd': { code: '26M11-39', auto: true },
  '2145ab51-d794-40a2-b134-e7e365b9bd1f': { code: '26M11-40', auto: true },
  'dfd3093c-b311-48ab-8355-24ab75c59a0a': { code: '26M11-42', auto: true },
  'ed3f972d-d3d0-4711-b7a7-bf973ceb4c9b': { code: '26M11-43', auto: true },
  '377f8f6a-9aa8-4aca-b12e-5f526b803188': { code: '26M11-45', auto: true },
  '58ce5ce3-656c-4f2f-ad6d-2e0aaff3d240': {
    code: '26M11-46',
    options: {
      0: [['cot x cot y − 1/cot x + cot y', F('cot x cot y − 1', 'cot x + cot y')]],
      1: [['cot x − cot y/1 + cot x cot y', F('cot x − cot y', '1 + cot x cot y')]],
      2: [['cot x + cot y/1 − cot x cot y', F('cot x + cot y', '1 − cot x cot y')]],
      3: [['1 − cot x cot y/cot x + cot y', F('1 − cot x cot y', 'cot x + cot y')]],
    },
  },
  'de3f1d42-6675-4c2b-bca0-db3480edf2b6': { code: '26M11-49', auto: true, question: [['f(x) = sin x/1 + cos x is', `f(x) = ${F('sin x', '1 + cos x')} is`]] },
  '3a52819e-b99c-4d17-8127-0730b17a3378': { code: '26M11-51', auto: true },
  'a882b0c2-ea62-4d42-ad4d-e1dba3a1e73f': { code: '26M11-52', auto: true, question: [['f(x) = tan x/1 + tan²x is', `f(x) = ${F('tan x', '1 + tan²x')} is`]] },
  '5fdd93ca-bfd0-4770-9a2d-80dcb877890d': { code: '26M11-54', auto: true, question: [['f(x) = 1/sin x + cos x is', `f(x) = ${F('1', 'sin x + cos x')} is`]] },
  '0e41f263-cd5a-4858-ba48-9e4f19bb478c': { code: '26M11-55', auto: true, question: [['f(x) = sin x + 2/3 + sin x is', `f(x) = ${F('sin x + 2', '3 + sin x')} is`]] },
  '485e4801-7859-43bf-9686-cf801a3e94b8': { code: '26M11-57', auto: true },
  '01a2982a-954e-4d8c-aef7-5bcb88d0c8fc': { code: '26M11-58', auto: true },
  '816d7225-c45c-49c3-8810-b577be4f1022': { code: '26M11-60', auto: true, question: [['f(x) = 1/sin 2x + cos 2x is', `f(x) = ${F('1', 'sin 2x + cos 2x')} is`]] },

  // ── Physics (explicit: RE/ME are the subscripted Earth symbols R_E/M_E, and units like km/s stay inline) ──
  '70b78ba5-00e7-4fcc-9447-5d5bb9f8bee6': { code: '26P11-14', options: { 0: [['v/2', F('v', '2')]], 2: [['v/√(2)', F('v', '√(2)')]] } },
  '0140ca9b-afca-423d-a58b-f46a5b4e646a': {
    code: '26P11-16',
    options: { 0: [['v[SUB]e[/SUB]/√(2)', F('v[SUB]e[/SUB]', '√(2)')]], 3: [['v[SUB]e[/SUB]/2', F('v[SUB]e[/SUB]', '2')]] },
  },
  '60e4ceb5-5809-4520-a257-49653f792dd8': {
    code: '26P11-17',
    options: {
      0: [['π√(g/RE)', `π√(${F('g', RE)})`]],
      1: [['π√(RE/g)', `π√(${F(RE, 'g')})`]],
      2: [['2π√(g/RE)', `2π√(${F('g', RE)})`]],
      3: [['2π√(RE/g)', `2π√(${F(RE, 'g')})`]],
    },
  },
  '117fa6c6-7b10-4181-85d4-fa3027a89bc9': { code: '26P11-21', options: { 1: [['−U/2', `−${F('U', '2')}`]], 3: [['U/2', F('U', '2')]] } },
  'bbbdf14a-7b2a-4c22-aeaa-16f5d2b7a5c4': {
    code: '26P11-27',
    options: {
      0: [['√(3) Gm²/a²', `√(3) ${F('Gm²', 'a²')}`]],
      1: [['3Gm²/a²', F('3Gm²', 'a²')]],
      2: [['Gm²/a²', F('Gm²', 'a²')]],
      3: [['2Gm²/a²', F('2Gm²', 'a²')]],
    },
  },
  '6c4538ce-2d37-4b7b-a940-8564e776c43b': {
    code: '26P11-29',
    options: {
      0: [[`G ${ME} m/2RE`, F(`G${ME}m`, `2${RE}`)]],
      1: [[`G ${ME} m/8RE`, F(`G${ME}m`, `8${RE}`)]],
      2: [[`G ${ME} m/4RE`, F(`G${ME}m`, `4${RE}`)]],
      3: [[`3 G ${ME} m/8RE`, F(`3G${ME}m`, `8${RE}`)]],
    },
  },
  'bab4d1d1-78da-49e8-b99f-d25dc5110e1d': {
    code: '26P11-30',
    options: {
      0: [[`g(${RE}/d)`, `g(${F(RE, 'd')})`]],
      1: [[`g(1 + d/${RE})`, `g(1 + ${F('d', RE)})`]],
      2: [[`g(1 - d/${RE})`, `g(1 - ${F('d', RE)})`]],
      3: [['g√(1 - d/RE)', `g√(1 - ${F('d', RE)})`]],
    },
  },
  'd3989097-cf5c-449f-bcbb-bc1cf2751ef2': {
    code: '26P11-32',
    options: { 0: [['GMm/r²', F('GMm', 'r²')]], 2: [['GMm/R²', F('GMm', 'R²')]], 3: [['GMr²/R³', F('GMr²', 'R³')]] },
  },
  '8be972c9-866c-42c3-a856-7fc35527660e': {
    code: '26P11-33',
    question: [['the ratio g[SUB]d[/SUB] / g[SUB]0[/SUB], where', `the ratio ${F('g[SUB]d[/SUB]', 'g[SUB]0[/SUB]')}, where`]],
    options: {
      0: [[`(${RE} - d)/${RE}`, F(`${RE} - d`, RE)]],
      1: [[`1 - d²/${RE}²`, `1 - ${F('d²', `${RE}²`)}`]],
      2: [[`${RE}/(${RE} - d)`, F(RE, `${RE} - d`)]],
      3: [[`1 - d/${RE}`, `1 - ${F('d', RE)}`]],
    },
  },
  '9919b95d-9c02-4d7a-85cc-5c59e98883c2': {
    code: '26P11-34',
    options: {
      0: [['√(GME/(2RE))', `√(${F(`G${ME}`, `2${RE}`)})`]],
      1: [['√(GME/RE)', `√(${F(`G${ME}`, RE)})`]],
      2: [['√(gRE)', `√(g${RE})`]],
      3: [['√(2gRE)', `√(2g${RE})`]],
    },
  },
  'a1c2b336-8f74-4245-9c1b-f5f368e08e48': {
    code: '26P11-35',
    options: {
      0: [['-6Gm²/a', `-${F('6Gm²', 'a')}`]],
      1: [['-3Gm²/(2a)', `-${F('3Gm²', '2a')}`]],
      2: [['-Gm²/a', `-${F('Gm²', 'a')}`]],
      3: [['-3Gm²/a', `-${F('3Gm²', 'a')}`]],
    },
  },
  '3ac8dccd-1f2e-4490-b11f-bb4a018b1342': { code: '26P11-37', options: { 2: [['r = R/2', `r = ${F('R', '2')}`]] } },
  'd7bfbd47-29f0-4dbe-9f23-0ffdf704a518': {
    code: '26P11-43',
    options: {
      0: [['instead of 1/r²', `instead of ${F('1', 'r²')}`]],
      1: [['F ∝ 1/r² only', `F ∝ ${F('1', 'r²')} only`]],
      2: [['F ∝ 1/r³ instead of 1/r²', `F ∝ ${F('1', 'r³')} instead of ${F('1', 'r²')}`]],
      3: [['either F ∝ 1/r³ or F ∝ r, but not F ∝ 1/r²', `either F ∝ ${F('1', 'r³')} or F ∝ r, but not F ∝ ${F('1', 'r²')}`]],
    },
  },
};

// ---------------------------------------------------------------------------
// Simple fractions: atom/atom where each side is a single term (no spaces or operators).
// ---------------------------------------------------------------------------

const ATOM_CHAR = /[A-Za-z0-9π²³θ.]/;

function matchBack(s, close, open, closeTok) {
  // index of `open` matching the `closeTok` that ends just before `close`
  let depth = 0;
  for (let i = close - closeTok.length; i >= 0; i--) {
    if (s.startsWith(closeTok, i)) depth++;
    else if (s.startsWith(open, i) && --depth === 0) return i;
  }
  return -1;
}

function atomStart(s, slash) {
  let i = slash;
  for (;;) {
    const tail = s.slice(0, i);
    const tag = tail.endsWith('[/SUB]') ? 'SUB' : tail.endsWith('[/SUP]') ? 'SUP' : null;
    if (tag) {
      const open = matchBack(s, i, `[${tag}]`, `[/${tag}]`);
      if (open === -1) return i;
      i = open;
      continue;
    }
    const c = s[i - 1];
    if (c && (ATOM_CHAR.test(c) || c === '√')) { i--; continue; }
    if (c === ')') {
      const open = matchBack(s, i, '(', ')');
      if (open === -1) return i;
      i = open;
      continue;
    }
    return i;
  }
}

function matchForward(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')' && --depth === 0) return i;
  }
  return -1;
}

function atomEnd(s, start) {
  let j = start;
  if (s[j] === '(') {
    const close = matchForward(s, j);
    return close === -1 ? start : close + 1;
  }
  for (;;) {
    if (j > start && (s.startsWith('[SUB]', j) || s.startsWith('[SUP]', j))) {
      const tag = s.slice(j + 1, j + 4);
      const close = s.indexOf(`[/${tag}]`, j);
      if (close === -1) return j;
      j = close + 6;
      continue;
    }
    if (s[j] === '√' && s[j + 1] === '(') {
      const close = matchForward(s, j + 1);
      if (close === -1) return j;
      j = close + 1;
      continue;
    }
    if (j < s.length && ATOM_CHAR.test(s[j])) { j++; continue; }
    // a trailing full stop ends the sentence, it isn't part of the number
    while (j > start && s[j - 1] === '.') j--;
    return j;
  }
}

const UNIT_NUM = /^(?:k?m|cm|mm|g|kg|mol|N|J|W|L)$/;
const UNIT_DEN = /^(?:s|s²|h|min|mol|kg|m|m²|m³|K|L)$/;
const unwrap = t => (t.startsWith('(') && matchForward(t, 0) === t.length - 1 ? t.slice(1, -1) : t);

function fracify(text) {
  let s = text;
  let from = 0;
  for (;;) {
    const slash = s.indexOf('/', from);
    if (slash === -1) return s;
    if (s[slash - 1] === '[') { from = slash + 1; continue; } // closing marker such as [/SUB]
    const start = atomStart(s, slash);
    const end = atomEnd(s, slash + 1);
    const num = s.slice(start, slash);
    const den = s.slice(slash + 1, end);
    if (!num || !den || /\[FRAC\]/.test(num + den) || (UNIT_NUM.test(num) && UNIT_DEN.test(den))) {
      from = slash + 1;
      continue;
    }
    const frac = `[FRAC]${unwrap(num)}[SEP]${unwrap(den)}[/FRAC]`;
    s = s.slice(0, start) + frac + s.slice(end);
    from = start + frac.length;
  }
}

function applyFixes(text, fixes, where) {
  let out = text;
  for (const [find, replace] of fixes) {
    const count = out.split(find).length - 1;
    if (count !== 1) throw new Error(`${where}: expected "${find}" once, found ${count} times in "${out}"`);
    out = out.replace(find, replace);
  }
  return out;
}

function convertRow(row, fix) {
  const where = `${fix.code} (${row.id})`;
  if (row.question_code !== fix.code) throw new Error(`${where}: row has code ${row.question_code}`);
  const field = (text, fixes, label) => {
    if (!text) return text;
    if (fixes) return applyFixes(text, fixes, `${where} ${label}`);
    return fix.auto ? fracify(text) : text;
  };
  const question = field(row.question, fix.question, 'question');
  const options = (row.options || []).map((o, i) => field(o, fix.options?.[i], `option ${i + 1}`));
  // The answer is stored as option text: convert it exactly as the option it matches.
  const answerIdx = (row.options || []).findIndex(o => o && o === row.answer);
  const answer = answerIdx >= 0 ? options[answerIdx] : row.answer;
  return { question, options, answer, answerIdx };
}

// ---------------------------------------------------------------------------

async function loadRows(ids) {
  const { data, error } = await db.from('mcqs').select('*').in('id', ids);
  if (error) throw error;
  const byId = new Map(data.map(r => [r.id, r]));
  const missing = ids.filter(id => !byId.has(id));
  if (missing.length) throw new Error(`Rows not found: ${missing.join(', ')}`);
  return ids.map(id => byId.get(id));
}

async function run(apply) {
  const ids = Object.keys(FIXES);
  const rows = await loadRows(ids);
  const changes = [];
  for (const row of rows) {
    const next = convertRow(row, FIXES[row.id]);
    const diff = [];
    if (next.question !== row.question) diff.push(['question', row.question, next.question]);
    next.options.forEach((o, i) => { if (o !== row.options[i]) diff.push([`option ${i + 1}`, row.options[i], o]); });
    if (next.answer !== row.answer) diff.push(['answer', row.answer, next.answer]);
    if (row.answer && next.answerIdx === -1) console.warn(`! ${row.question_code}: answer "${row.answer}" matches no option — left as is`);
    if (next.answerIdx >= 0 && next.answer !== next.options[next.answerIdx]) throw new Error(`${row.question_code}: answer no longer matches its option`);
    if (!diff.length) { console.warn(`! ${row.question_code}: nothing to change`); continue; }
    changes.push({ row, next });
    console.log(`\n${row.question_code}`);
    for (const [label, before, after] of diff) console.log(`  ${label.padEnd(9)} ${before}\n  ${''.padEnd(9)} → ${after}`);
  }
  console.log(`\n${changes.length} of ${rows.length} rows change.`);
  if (!apply) return console.log('Dry run — nothing written. Re-run with --apply to save.');

  const backupDir = path.join(__dirname, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `2026-10-10-maths-format.before.${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(changes.map(c => c.row), null, 2));
  console.log(`Backup written: ${path.relative(process.cwd(), backupFile)}`);

  let written = 0;
  for (const { row, next } of changes) {
    // Only overwrite a row nobody edited since it was read.
    const { data, error } = await db
      .from('mcqs')
      .update({ question: next.question, options: next.options, answer: next.answer, updatedAt: new Date().toISOString() })
      .eq('id', row.id)
      .eq('question', row.question)
      .eq('updatedAt', row.updatedAt)
      .select('id');
    if (error) throw error;
    if (!data?.length) console.warn(`! ${row.question_code}: changed since it was read — skipped`);
    else written++;
  }
  console.log(`Saved ${written} rows.`);
}

async function restore(file) {
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const row of rows) {
    const { error } = await db.from('mcqs').update({ question: row.question, options: row.options, answer: row.answer, updatedAt: row.updatedAt }).eq('id', row.id);
    if (error) throw error;
  }
  console.log(`Restored ${rows.length} rows from ${file}`);
}

const restoreAt = process.argv.indexOf('--restore');
(restoreAt !== -1 ? restore(process.argv[restoreAt + 1]) : run(process.argv.includes('--apply'))).catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
