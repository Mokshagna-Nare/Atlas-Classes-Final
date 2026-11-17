// Turns what an admin said ("add a high priority bug in the student portal, login fails after
// OTP, due Friday") into task actions. Pure functions, no browser APIs — see understand.test.ts.
//
// It understands three kinds of request:
//   create  — one or several new tasks, with type, priority, areas, assignee and due date
//   update  — complete / start / postpone / cancel / reopen / assign / re-prioritise / re-date
//             an existing task found by what it's about ("the login error task")
//   query   — "what's pending in MCQ upload?", "anything overdue?", "my urgent tasks"
// Common Hindi and Telugu words (romanised or in their own script) are understood too.
// Nothing is saved here: the UI always shows the result for confirmation first.

import {
  AdminUser, AreaTag, OPEN_STATUSES, PRIORITY_META, STATUS_META, Task, TaskChanges, TaskDraft, TaskPriority, TaskStatus, TaskType,
  addDays, compareTasks, friendlyDay, isOverdue, weekday,
} from '../taskModel';

export interface UnderstandContext {
  tasks: Task[];
  admins: AdminUser[];
  me: string | null;
  areas: AreaTag[];
  /** Today's date in IST, "2026-11-17". */
  today: string;
  /** The admin section open when the request was made (pre-tags new tasks). */
  currentArea?: string | null;
  /** The task the admin dealt with last ("mark it done"). */
  lastTaskId?: string | null;
}

export interface DraftNote {
  /** What the draft got from the request, for the confirmation card. */
  heardPriority?: boolean;
  heardDate?: boolean;
  heardAreas?: boolean;
  heardAssignee?: boolean;
  usedCurrentArea?: boolean;
}

export type Understanding =
  | { kind: 'create'; heard: string; drafts: (TaskDraft & { notes: DraftNote })[] }
  | { kind: 'update'; heard: string; target: string; candidates: Task[]; changes: TaskChanges; note: string | null; summary: string }
  | { kind: 'query'; heard: string; tasks: Task[]; answer: string }
  | { kind: 'none'; heard: string; message: string };

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------
const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, a: 1, an: 1, couple: 2, few: 3,
};
const ORDINAL_WORDS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18,
  nineteenth: 19, twentieth: 20, thirtieth: 30,
};
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_RE = '(sun|mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?)(?:day)?';
const ACRONYMS = ['mcq', 'mcqs', 'otp', 'api', 'pdf', 'ui', 'ux', 'neet', 'jee', 'ocr', 'html', 'url', 'docx', 'mfa', '2fa', 'id', 'ids', 'csv', 'svg', 'sql', 'db', 'cbse', 'icse', 'ai', 'qr'];

/** Hindi / Telugu / Hinglish words → the English the rest of the parser understands. */
const TRANSLATIONS: [RegExp, string][] = [
  [/(?:bahut|bohot|bahot|bhot|bohat|bhut|bahuth|chala|chaala|బాగా|చాలా|बहुत)\s+(?:zaroori|zaruri|jaruri|jaroori|zarori|zharori|jarori|zururi|zaruuri|important|urgent|mukhyam\w*|ज़रूरी|जरूरी|जरोरी|जरुरी|ముఖ్యం|ముఖ్యమైన)/g, ' urgent '],
  [/\b(?:turant|fauran|abhi ke abhi|ventane)\b|तुरंत|फ़ौरन|అత్యవసరం|అత్యవసర|వెంటనే|अत्यावश्यक/g, ' urgent '],
  [/\b(?:zaroori|zaruri|jaruri|jaroori|zarori|zharori|jarori|zururi|mukhyama(?:i|yi|y)? ?nadi|mukhyam(?:aina|ainadi|ayina|ayinadi|ayi|ai|amaina|am)?)\b|ज़रूरी|जरूरी|जरोरी|जरुरी|ముఖ్యమైనది|ముఖ్యమైన|ముఖ్యం/g, ' important '],
  [/\b(?:parso|parson|ellundi)\b|परसों|ఎల్లుండి/g, ' day after tomorrow '],
  [/\b(?:kal|repu|repati(?:loga|lopu|ki)?|rai pati(?:loga|lopu)?|repatiki)\b|कल|రేపటిలోగా|రేపటికి|రేపు/g, ' tomorrow '],
  [/\b(?:aaj|eroju|eeroju|ivvala|ivala|ee roju)\b|आज|ఈరోజు|ఈ రోజు/g, ' today '],
  [/\b(?:agle hafte|agle week|vachhe vaaram|vache varam)\b|अगले हफ्ते|अगले सप्ताह|వచ్చే వారం/g, ' next week '],
  [/\b(?:baad mein|baad me|bad me|bad mein|taal do|tal do|vayida|vaayida)\b|बाद में|टाल दो|వాయిదా/g, ' postpone '],
  [/\b(?:shuru karo|shuru kar do|shuru)\b|शुरू|మొదలు పెట్టు|మొదలు/g, ' start '],
  [/\b(?:rehne do|rahne do|cancel karo|vaddu)\b|रहने दो|వద్దు/g, ' cancel '],
  [/\b(?:add karo|add kar do|bana do|banao|jodo|add cheyyi|add chey)\b|जोड़ो|जोड़ दो|बना दो/g, ' add '],
  [/\b(?:naya|nayi|kotha)\s+(?:task|kaam)\b|नया टास्क|नया काम|కొత్త టాస్క్/g, ' new task '],
  [/टास्क|టాస్క్|\bkaam\b|काम/g, ' task '],
  [/\b(?:kya|kaun se|kitne|enti|emi|enni)\b|क्या|कितने|ఏమి|ఎన్ని/g, ' what '],
  [/\b(?:baaki|baki|pending hai|migilina)\b|बाकी|మిగిలిన/g, ' pending '],
  [/\b(?:mera|mere|meri|naa)\b|मेरा|मेरे|मेरी|నా/g, ' my '],
];
/** "... ho gaya" at the end of a sentence means it's done (elsewhere it just means "became"). */
const DONE_AT_END_RE = /\s(?:ho gaya|ho gya|hogaya|ho chuka|khatam|khatam ho gaya|pura ho gaya|poora ho gaya|aipoyindi|ayipoyindi|purthi ayindi|purthi)(?:\s(?:hai|he|ga))?\s*$|\s(?:हो गया|पूरा हो गया|खत्म|అయిపోయింది|పూర్తయింది|పూర్తి)(?:\s(?:है))?\s*$/;

export function normalise(raw: string) {
  let s = ` ${String(raw || '').toLowerCase()} `
    .replace(/[“”"«»]/g, ' ')
    .replace(/[’`]/g, "'")
    .replace(/[!?¿¡।]+/g, m => (m.includes('?') ? ' ? ' : ' . '))
    .replace(/\s+/g, ' ');

  s = s.replace(DONE_AT_END_RE, ' is done ');
  for (const [pattern, english] of TRANSLATIONS) s = s.replace(pattern, english);
  s = s.replace(/\b([a-z]+) ko assign(?: karo| kar do| cheyyi)?\b/g, 'assign to $1');

  // Spelled-out letters from speech: "m c q" → "mcq", "o t p" → "otp", "a p i" → "api".
  s = s.replace(/\b(?:[a-z] ){2,5}[a-z]\b/g, m => m.replace(/ /g, ''));
  s = s.replace(/\b(?:m c q|mc q|m cq|emcee queue|mc queue|mcq's)\b/g, 'mcq');
  s = s.replace(/\bq ?bank\b/g, 'question bank').replace(/\bto-?do\b/g, 'todo').replace(/\bin-progress\b/g, 'in progress');
  s = s.replace(/\b(\d+)(?:st|nd|rd|th)\b/g, '$1');

  return s.replace(/\s+/g, ' ').trim();
}

const restoreCase = (text: string) => {
  let out = text.replace(/\s+([,.;:])/g, '$1').replace(/\s+/g, ' ').trim();
  for (const word of ACRONYMS) out = out.replace(new RegExp(`\\b${word}\\b`, 'g'), word.toUpperCase().replace(/S$/, 's'));
  out = out.replace(/\bi\b/g, 'I');
  return out.charAt(0).toUpperCase() + out.slice(1);
};

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------
interface Found<T> { value: T; start: number; end: number }

const numberValue = (word: string) => {
  if (/^\d+$/.test(word)) return Number(word);
  return NUMBER_WORDS[word] ?? ORDINAL_WORDS[word] ?? null;
};

const monthIndex = (word: string) => MONTHS.findIndex(name => name.startsWith(word.slice(0, 3)));

function dayOfMonth(today: string, day: number, month: number | null, year: number | null) {
  const [ty, tm] = today.split('-').map(Number);
  let y = year ?? ty;
  let m = month ?? tm - 1;
  const build = (yy: number, mm: number) => {
    const date = new Date(Date.UTC(yy, mm, day));
    return date.getUTCMonth() === mm ? date.toISOString().slice(0, 10) : null;
  };
  let result = build(y, m);
  if (result && result < today && year === null) {
    if (month === null) {
      m += 1;
      if (m > 11) { m = 0; y += 1; }
    } else {
      y += 1;
    }
    result = build(y, m);
  }
  return result;
}

const nextWeekday = (today: string, target: number, allowToday: boolean) => {
  const delta = (target - weekday(today) + 7) % 7;
  return addDays(today, delta === 0 && !allowToday ? 7 : delta);
};

/** The first date mentioned, with its position (including a leading "by/on/due/till ..."). */
export function findDate(s: string, today: string): Found<string> | null {
  const lead = '(?:(?:due|deadline|by|on|before|till|until|untill|for|to|latest by|no later than|is due)\\s+)*(?:the\\s+)?';
  const patterns: [RegExp, (m: RegExpExecArray) => string | null][] = [
    [new RegExp(`\\b${lead}day after tomorrow\\b`), () => addDays(today, 2)],
    [new RegExp(`\\b${lead}(?:tomorrow|tmrw|tmr)(?: morning| evening| night)?\\b`), () => addDays(today, 1)],
    [new RegExp(`\\b${lead}(?:today|tonight|eod|end of (?:the )?day|this evening)\\b`), () => today],
    [new RegExp(`\\b${lead}(?:end of (?:the |this )?week|this week|week end|weekend)\\b`), () => nextWeekday(today, 5, true)],
    [new RegExp(`\\b${lead}next week\\b`), () => nextWeekday(today, 1, false)],
    [new RegExp(`\\b${lead}(?:end of (?:the |this )?month|month end|month-end|this month)\\b`), () => {
      const [y, m] = today.split('-').map(Number);
      return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    }],
    [new RegExp(`\\b${lead}next month\\b`), () => {
      const [y, m] = today.split('-').map(Number);
      return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    }],
    [new RegExp(`\\b(?:in|within|after)\\s+(?:a |an |the next )?(\\d+|${Object.keys(NUMBER_WORDS).join('|')})?\\s*(day|days|week|weeks|month|months)\\b`), m => {
      const count = m[1] ? numberValue(m[1]) ?? 1 : 1;
      return m[2].startsWith('day') ? addDays(today, count) : m[2].startsWith('week') ? addDays(today, 7 * count) : (() => {
        const [y, mo, d] = today.split('-').map(Number);
        const date = new Date(Date.UTC(y, mo - 1 + count, d));
        return date.toISOString().slice(0, 10);
      })();
    }],
    [new RegExp(`\\b${lead}(?:(this|next|coming|upcoming)\\s+)?${WEEKDAY_RE}\\b`), m => {
      const target = WEEKDAYS.findIndex(day => day.startsWith(m[2].slice(0, 3)));
      return target < 0 ? null : nextWeekday(today, target, !m[1]);
    }],
    [new RegExp(`\\b${lead}(\\d{1,2}|${Object.keys(ORDINAL_WORDS).join('|')})(?:\\s+of)?\\s+${MONTH_RE}(?:\\s+(\\d{4}))?\\b`), m =>
      dayOfMonth(today, numberValue(m[1]) ?? 0, monthIndex(m[2]), m[3] ? Number(m[3]) : null)],
    [new RegExp(`\\b${lead}${MONTH_RE}\\s+(\\d{1,2}|${Object.keys(ORDINAL_WORDS).join('|')})(?:\\s+(\\d{4}))?\\b`), m =>
      dayOfMonth(today, numberValue(m[2]) ?? 0, monthIndex(m[1]), m[3] ? Number(m[3]) : null)],
    [new RegExp(`\\b${lead}(\\d{1,2})[/.-](\\d{1,2})(?:[/.-](\\d{2,4}))?\\b`), m => {
      const year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : null;
      return dayOfMonth(today, Number(m[1]), Number(m[2]) - 1, year); // Indian order: day/month
    }],
    [new RegExp(`\\b(?:due|deadline|by|on|before|till|until)\\s+(?:the\\s+)?(\\d{1,2}|${Object.keys(ORDINAL_WORDS).join('|')})\\b(?!\\s*(?:days?|weeks?|months?|hours?|minutes?|questions?|marks?|%|percent))`), m =>
      dayOfMonth(today, numberValue(m[1]) ?? 0, null, null)],
  ];

  let best: Found<string> | null = null;

  for (const [pattern, toDate] of patterns) {
    const match = pattern.exec(s);
    if (!match) continue;
    const value = toDate(match);
    if (!value) continue;
    if (!best || match.index < best.start) best = { value, start: match.index, end: match.index + match[0].length };
  }

  return best;
}

// ---------------------------------------------------------------------------
// Priority, type, areas, people
// ---------------------------------------------------------------------------
const PRIORITY_PATTERNS: [TaskPriority, RegExp][] = [
  ['urgent', /\b(?:(?:it'?s |it is |this is |mark it |make it |as |with |set to |and )?(?:urgent(?:ly)?|critical|asap|as soon as possible|immediately|emergency|top priority|highest priority|very important|super important|blocker|p0)(?: priority)?)\b/],
  ['high', /\b(?:(?:it'?s |it is |this is |mark it |make it |as |with |set to |and |a )?(?:high[- ]priority|priority (?:is )?high|important|p1)(?: one| task)?)\b/],
  ['low', /\b(?:(?:it'?s |it is |this is |mark it |make it |as |with |set to |and |a )?(?:low[- ]priority|priority (?:is )?low|not urgent|no rush|no hurry|whenever possible|when possible|minor|p3)(?: one| task)?)\b/],
  ['medium', /\b(?:(?:it'?s |it is |this is |mark it |make it |as |with |set to |and |a )?(?:medium[- ]priority|normal priority|priority (?:is )?(?:medium|normal)|p2)(?: one| task)?)\b/],
];

export function findPriority(s: string): Found<TaskPriority> | null {
  for (const [priority, pattern] of PRIORITY_PATTERNS) {
    const match = pattern.exec(s);
    if (match) return { value: priority, start: match.index, end: match.index + match[0].length };
  }
  return null;
}

const EXPLICIT_TYPES: [TaskType, RegExp][] = [
  ['bug', /\b(?:(?:it'?s |it is |this is |log |as )?(?:a |an )?(?:bug|error)(?: report)?(?: task)?)\b(?=\s*(?:in|on|for|at|with|where|that|:|,|\.|$|-))/],
  ['feature', /\b(?:(?:it'?s |it is |this is |as )?(?:a |an )?(?:new )?feature(?: request)?)\b/],
  ['change', /\b(?:(?:it'?s |it is |this is |as )?(?:a |an )?change request)\b/],
  ['update', /\b(?:(?:it'?s |it is |this is |as )?(?:a |an )?software update)\b/],
  ['content', /\b(?:(?:it'?s |it is |this is |as )?(?:a |an )?content (?:task|work|update|issue|fix))\b/],
];

const TYPE_HINTS: [TaskType, RegExp][] = [
  ['bug', /\b(?:fix(?:es|ing)?|bugs?|errors?|issues?|crash(?:es|ing)?|broken|not (?:working|loading|opening|showing|saving|coming)|doesn'?t (?:work|load|open|show|save)|does not (?:work|load|open|show|save)|isn'?t (?:working|loading|showing)|fails?|failing|failed|problem|glitch|wrong|incorrect|exception|stuck|freez(?:e|es|ing)|blank (?:page|screen)|slow|lag(?:ging)?|404|500)\b/],
  ['feature', /\b(?:feature|implement|introduce|integrate|support for|new (?:option|button|page|section|screen|report|filter|tab|feature)|add (?:a |an )?(?:new )?(?:option|button|page|section|screen|filter|tab|export|download|toggle))\b/],
  ['update', /\b(?:upgrade|update (?:the )?(?:library|libraries|package|packages|dependenc(?:y|ies)|version|node|react|vite|tailwind|supabase)|new version|dependenc(?:y|ies)|patch|security update)\b/],
  ['change', /\b(?:change|modify|tweak|adjust|rename|replace|redesign|improve|move|reorder|update|polish|refactor)\b/],
  ['content', /\b(?:questions?|papers?|syllabus|chapters?|typos?|spelling|answer keys?|solutions?|explanations?|upload (?:the )?(?:\w+ )?(?:papers?|tests?|questions?)|content)\b/],
];

/** Area tags mentioned (longest alias first so "question bank" beats "question"). */
export function findAreas(s: string, areas: AreaTag[]): Found<string>[] {
  const phrases = areas
    .flatMap(area => [area.label.toLowerCase(), ...(area.aliases || [])].map(alias => ({ slug: area.slug, alias: alias.toLowerCase() })))
    .sort((a, b) => b.alias.length - a.alias.length);
  const taken: [number, number][] = [];
  const found: Found<string>[] = [];

  for (const { slug, alias } of phrases) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    const pattern = new RegExp(`(?:^|[^a-z0-9])(${escaped})(?:s)?(?=$|[^a-z0-9])`, 'g');
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(s))) {
      const start = match.index + match[0].indexOf(match[1]);
      const end = start + match[1].length;
      if (taken.some(([a, b]) => start < b && end > a)) continue;
      taken.push([start, end]);
      if (!found.some(item => item.value === slug)) found.push({ value: slug, start, end });
    }
  }

  return found.sort((a, b) => a.start - b.start);
}

const levenshtein = (a: string, b: string) => {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
};

/** An admin named in the request ("assign it to Ravi", "for me"). */
export function findAdmin(name: string, ctx: Pick<UnderstandContext, 'admins' | 'me'>): string | null {
  const wanted = name.trim().toLowerCase().replace(/[^a-z\s]/g, '').trim();
  if (!wanted) return null;
  if (/^(me|myself|mine|i|self)$/.test(wanted)) return ctx.me;

  let best: { id: string; score: number } | null = null;

  for (const admin of ctx.admins) {
    const full = (admin.name || '').toLowerCase().trim();
    const parts = full.split(/\s+/).filter(Boolean);
    const local = (admin.email || '').toLowerCase().split('@')[0].replace(/[^a-z]/g, ' ').trim();
    const candidates = [full, ...parts, local, ...local.split(/\s+/)].filter(word => word.length >= 2);

    for (const candidate of candidates) {
      const distance = levenshtein(wanted, candidate);
      const score = wanted === candidate ? 3 : distance <= (candidate.length >= 5 ? 1 : 0) ? 2 : candidate.startsWith(wanted) && wanted.length >= 3 ? 1 : 0;
      if (score && (!best || score > best.score)) best = { id: admin.id, score };
    }
  }

  return best?.id ?? null;
}

const ASSIGN_RE = /\b(?:and )?(?:(?:please )?(?:assign(?:ed)?|give|hand)(?: it| this| that| the task)?(?: over)? to|for|owner is|owned by|(?:should be )?handled by|to be done by)\s+([a-z]+(?: [a-z]+)?)\b/g;

function findAssignee(s: string, ctx: UnderstandContext): Found<string> | null {
  ASSIGN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ASSIGN_RE.exec(s))) {
    const words = match[1].split(' ');
    // "for ravi kumar" / "for ravi" / "for me"
    for (const take of [2, 1]) {
      const name = words.slice(0, take).join(' ');
      if (!name || take > words.length) continue;
      const id = findAdmin(name, ctx);
      if (id) {
        const end = match.index + match[0].length - (words.length - take > 0 ? words.slice(take).join(' ').length + 1 : 0);
        return { value: id, start: match.index, end };
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Finding the task an update is about
// ---------------------------------------------------------------------------
const STOPWORDS = new Set([
  'the', 'a', 'an', 'my', 'our', 'task', 'tasks', 'one', 'item', 'ticket', 'about', 'called', 'named', 'regarding', 'related',
  'to', 'on', 'in', 'of', 'for', 'with', 'and', 'that', 'this', 'is', 'it', 'its', 'please', 'from', 'at', 'as', 'be', 'we',
  'which', 'where', 'was', 'were', 'are', 'there', 'issue', 'thing', 'work', 'wala', 'vala', 'waala', 'ka', 'ki', 'ke',
]);

const tokens = (text: string) =>
  normalise(text)
    .replace(/[^a-z0-9ऀ-ॿఀ-౿\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word && !STOPWORDS.has(word))
    .map(word => (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word));

const similar = (a: string, b: string) =>
  a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) || (a.length >= 5 && b.length >= 5 && levenshtein(a, b) <= 1);

const PRONOUN_TARGET = /^(?:it|this|that|this one|that one|the last one|last one|the last task|last task|the previous task|previous task|the same|same task|the task|the one i just added)$/;

/** Tasks that best match the words used, best first; several only when it's a close call. */
export function findTask(target: string, ctx: UnderstandContext, prefer: 'open' | 'closed' | 'any' = 'open'): Task[] {
  const cleaned = target.trim().replace(/^(?:the|my|our)\s+/, '').trim();

  if (!cleaned || PRONOUN_TARGET.test(cleaned)) {
    const last = ctx.lastTaskId ? ctx.tasks.find(task => task.id === ctx.lastTaskId) : null;
    if (last) return [last];
    const recent = [...ctx.tasks].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))[0];
    return recent ? [recent] : [];
  }

  const wanted = tokens(cleaned);
  if (!wanted.length) return [];

  const scored = ctx.tasks
    .map(task => {
      const titleWords = tokens(task.title);
      const otherWords = tokens(`${task.details} ${task.areas.join(' ').replace(/-/g, ' ')}`);
      let hits = 0;
      for (const word of wanted) {
        if (titleWords.some(other => similar(word, other))) hits += 1;
        else if (otherWords.some(other => similar(word, other))) hits += 0.5;
      }
      let score = hits / wanted.length;
      if (score > 0 && titleWords.length) score += 0.15 * (hits / Math.max(titleWords.length, wanted.length));
      const open = OPEN_STATUSES.includes(task.status);
      if (prefer === 'open' && open) score += 0.05;
      if (prefer === 'closed' && !open) score += 0.05;
      return { task, score };
    })
    .filter(item => item.score >= 0.55)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return [];
  const close = scored.filter(item => scored[0].score - item.score < 0.12);
  return (close.length > 1 ? close : [scored[0]]).slice(0, 4).map(item => item.task);
}

// ---------------------------------------------------------------------------
// Intent
// ---------------------------------------------------------------------------
const PREFIX_RE = /^(?:(?:hey|hi|ok|okay|hello)\s+atlas|atlas|please|kindly|ok|okay|so|um+|uh+|hmm+|right|now|can you|could you|would you|will you|i want you to|i want to|i would like to|i'd like to|let'?s)\b[\s,]*/;

const stripPrefix = (s: string) => {
  let out = s.trim();
  for (let i = 0; i < 6; i++) {
    const next = out.replace(PREFIX_RE, '').replace(/^[,.\s]+/, '');
    if (next === out) break;
    out = next;
  }
  return out;
};

const QUERY_START_RE = /^(?:what|what'?s|whats|which|show|list|tell me|how many|how much|any|anything|do i|do we|are there|is there|give me|read out|read|read me|display|find|search|get me|status of)\b/;

const DONE_WORDS = '(?:done|completed?|finished|resolved|fixed|closed|sorted|over)';
const PROGRESS_WORDS = '(?:in progress|inprogress|in process|processing|ongoing|started|working|being worked on|underway|wip)';
const TODO_WORDS = '(?:todo|to do|pending|not started|open|not done|incomplete|undone)';
const CANCEL_WORDS = '(?:cancell?ed|not needed|no longer needed|dropped|scrapped|discarded|won\'?t do)';
const PRIORITY_WORD = '(urgent|high|medium|normal|low|top|critical|important)';

const toPriority = (word: string): TaskPriority =>
  /urgent|top|critical/.test(word) ? 'urgent' : /high|important/.test(word) ? 'high' : /low/.test(word) ? 'low' : 'medium';

interface UpdateIntent {
  target: string;
  changes: TaskChanges;
  rest: string;
  /** Leading verb could also start a new task ("complete the filters page") — fall back to create if nothing matches. */
  couldBeNew: boolean;
  prefer: 'open' | 'closed' | 'any';
}

function updateIntent(s: string): UpdateIntent | null {
  const verbs = '(?:mark|set|move|change|update|put|make|turn)';
  const as = '(?:as|to|into|in|it as|it to|status to|status as)';
  let m: RegExpExecArray | null;

  // Mark X as done / in progress / to do / cancelled / postponed
  const statusForms: [string, TaskStatus][] = [
    [DONE_WORDS, 'completed'], [PROGRESS_WORDS, 'in_progress'], [TODO_WORDS, 'todo'], [CANCEL_WORDS, 'cancelled'], ['(?:postponed|on hold|later|paused)', 'postponed'],
  ];
  for (const [words, status] of statusForms) {
    m = new RegExp(`^${verbs}\\s+(.+?)\\s+${as}\\s+${words}\\b(.*)$`).exec(s);
    if (m) return { target: m[1], changes: { status }, rest: m[2], couldBeNew: false, prefer: status === 'todo' ? 'closed' : 'open' };
  }

  // Priority / due date / assignee changes
  m = new RegExp(`^(?:set|change|update|make|mark|raise|lower|bump)\\s+(?:the\\s+)?priority\\s+(?:of|for|on)\\s+(.+?)\\s+(?:to|as)\\s+${PRIORITY_WORD}\\b(.*)$`).exec(s);
  if (m) return { target: m[1], changes: { priority: toPriority(m[2]) }, rest: m[3], couldBeNew: false, prefer: 'open' };
  m = new RegExp(`^(?:make|mark|set)\\s+(.+?)\\s+(?:as\\s+)?(?:an?\\s+)?${PRIORITY_WORD}(?:\\s+priority)?\\b(.*)$`).exec(s);
  if (m && !/^(?:a|an|new)\b/.test(m[1])) return { target: m[1], changes: { priority: toPriority(m[2]) }, rest: m[3], couldBeNew: false, prefer: 'open' };
  m = /^(?:set|change|move|update|push|extend)\s+(?:the\s+)?(?:due date|deadline|due)\s+(?:of|for|on)\s+(.+?)\s+(?:to|till|until|as)\s+(.+)$/.exec(s);
  if (m) return { target: m[1], changes: { due_date: undefined }, rest: m[2], couldBeNew: false, prefer: 'open' };
  m = /^(?:assign|reassign|give|hand(?: over)?)\s+(.+?)\s+to\s+([a-z]+(?: [a-z]+)?)$/.exec(s);
  if (m) return { target: m[1], changes: { assignee_id: undefined }, rest: `assign to ${m[2]}`, couldBeNew: false, prefer: 'open' };
  m = /^(?:assign|reassign)\s+to\s+([a-z]+(?: [a-z]+)?)$/.exec(s);
  if (m) return { target: 'it', changes: { assignee_id: undefined }, rest: `assign to ${m[1]}`, couldBeNew: false, prefer: 'open' };

  // Postpone X to/till Y because Z
  m = /^(?:postpone|delay|defer|push(?: back)?|reschedule|hold|park|put off|move)\s+(.+?)(\s+(?:to|till|until|untill|by|for|till the|after|on)\s+.+)?$/.exec(s);
  if (m && (!/^move\b/.test(s) || m[2])) {
    let target = m[1];
    let rest = m[2] || '';
    const reason = /\s+(?:because|as|since|due to|reason is|reason being|waiting for|waiting on|till we get|until we get)\s+.+$/.exec(target);
    if (reason) { rest = `${reason[0]} ${rest}`; target = target.slice(0, reason.index); }
    return { target, changes: { status: 'postponed' }, rest, couldBeNew: /^(?:move|push|hold|park)\b/.test(s), prefer: 'open' };
  }

  // Verb-first status changes
  m = /^(?:cancel|drop|scrap|discard|abandon|delete|remove)\s+(.+)$/.exec(s);
  if (m) return { target: m[1], changes: { status: 'cancelled' }, rest: '', couldBeNew: false, prefer: 'open' };
  m = /^(?:reopen|re-open|re open|undo|restore|bring back)\s+(.+)$/.exec(s);
  if (m) return { target: m[1], changes: { status: 'todo' }, rest: '', couldBeNew: false, prefer: 'closed' };
  m = /^(?:complete|finish|close|resolve|wrap up|tick off|check off)\s+(.+)$/.exec(s);
  if (m) return { target: m[1], changes: { status: 'completed' }, rest: '', couldBeNew: true, prefer: 'open' };
  m = /^(?:start|begin|pick up|take up|resume)\s+(?:working on\s+|work on\s+|on\s+)?(.+)$/.exec(s);
  if (m) return { target: m[1], changes: { status: 'in_progress' }, rest: '', couldBeNew: true, prefer: 'open' };
  m = /^(?:i am|i'm|im|we are|we're|i have started|we have started|i started|we started)\s+(?:working on|starting|doing|on)\s+(.+)$/.exec(s);
  if (m) return { target: m[1], changes: { status: 'in_progress' }, rest: '', couldBeNew: false, prefer: 'open' };

  // Verb last (Hindi / Telugu word order): "filters task postpone, december 5", "footer task cancel"
  m = /^(.+?)\s+(?:task\s+|ko\s+|ni\s+)*(postpone|cancel|start)(?:\s+(?:karo|kar do|kardo|cheyyi|cheyyandi|chey))?\b[\s,]*(.*)$/.exec(s);
  if (m && !/^(?:add|create|new|log)\b/.test(s)) {
    const status: TaskStatus = m[2] === 'postpone' ? 'postponed' : m[2] === 'cancel' ? 'cancelled' : 'in_progress';
    return { target: m[1], changes: { status }, rest: m[3] ? ` to ${m[3]}` : '', couldBeNew: false, prefer: 'open' };
  }

  // "the login error (task) is done / fixed"
  m = new RegExp(`^(.+?)\\s+(?:task\\s+)?(?:is|are|has been|have been|got|was|is now|now)?\\s*${DONE_WORDS}(?:\\s+now)?$`).exec(s);
  if (m && !/^(?:add|create|new|log)\b/.test(s)) return { target: m[1], changes: { status: 'completed' }, rest: '', couldBeNew: false, prefer: 'open' };
  m = new RegExp(`^(.+?)\\s+(?:task\\s+)?(?:is|are)\\s+(?:now\\s+)?${PROGRESS_WORDS}$`).exec(s);
  if (m && !/^(?:add|create|new|log)\b/.test(s)) return { target: m[1], changes: { status: 'in_progress' }, rest: '', couldBeNew: false, prefer: 'open' };

  return null;
}

const cleanTarget = (target: string) =>
  target
    .replace(/^(?:the|my|our|that|this)\s+/, '')
    .replace(/\s+(?:task|bug|issue|item|ticket|one|work)$/, '')
    .replace(/^(?:task|bug|issue)\s+(?:about|for|on|called|named)\s+/, '')
    .replace(/\s+(?:task|bug|issue)$/, '')
    .trim();

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------
const SPLIT_RE = /\s*(?:;|\.\s+(?=(?:and\s+)?(?:also|another|next|second|third|then|one more)\b)|,?\s*\b(?:and\s+)?also\s+(?:add\s+|create\s+|log\s+)?|,?\s*\b(?:and\s+)?(?:another|one more|the next|next|a second|second|a third|third|fourth|last)\s+(?:task|one|bug|item|thing)\b\s*(?:is|:|,|-|to|for|about)?\s*|,?\s*\b(?:and\s+)?then\s+(?:add|create|log)\b\s*|\b(?:task|number|no\.?)\s+(?:one|two|three|four|five|1|2|3|4|5)\b\s*(?:is|:|,|-)?\s*|\b(?:firstly|secondly|thirdly|fourthly)\b\s*,?\s*|^\s*first(?:ly)?\b\s*,?\s*)/;

const COMMAND_RE = new RegExp(
  '^(?:(?:please|kindly|also|and|then|now|ok|okay)\\s+)*' +
    '(?:(?:add|create|log|make|put|record|register|raise|open|note(?: down)?|write(?: down)?|track|remember|remind me|set up|new)\\b' +
    '(?:\\s+(?:a|an|one|two|three|four|five|some|few|couple of|the|new|following|more))*' +
    '(?:\\s+(?:high[- ]priority|low[- ]priority|urgent|important|critical))?' +
    '(?:\\s+(?:tasks?|bugs?|issues?|tickets?|items?|todos?|to dos?|reminders?|feature requests?|change requests?|content tasks?|software updates?|features?|changes?|updates?|errors?|things?|notes?))?' +
    '(?:\\s+(?:to|for|about|that|saying|called|named|regarding|on|in))?' +
    '\\s*[:,-]?\\s*)' +
    '|^(?:there\\s+(?:is|are|was)\\s+(?:a|an|some)?\\s*|we\\s+(?:need|have)\\s+to\\s+|i\\s+(?:need|have)\\s+to\\s+|need\\s+to\\s+|have\\s+to\\s+|remind\\s+me\\s+to\\s+|remember\\s+to\\s+)',
);

function splitTasks(s: string): string[] {
  const count = /\b(two|three|four|five|2|3|4|5)\s+(?:new\s+)?(?:tasks|bugs|issues|items|things|todos)\b/.exec(s);
  const parts = s.split(new RegExp(SPLIT_RE.source, 'g')).map(part => part.trim()).filter(part => part && part.split(/\s+/).length >= 2);

  if (count) {
    const wanted = numberValue(count[1]) ?? parts.length;
    // "add two tasks: fix the login and update the footer" — split on "and" only when asked for N tasks.
    while (parts.length < wanted) {
      const index = parts.findIndex(part => /\s(?:and|,)\s/.test(part.replace(/^.*?(?:tasks|bugs|issues|items|things|todos)\b\s*[:,-]?/, '')));
      if (index < 0) break;
      const part = parts[index];
      const headMatch = /^.*?(?:tasks|bugs|issues|items|things|todos)\b\s*[:,-]?\s*/.exec(part);
      const head = headMatch ? headMatch[0] : '';
      const body = part.slice(head.length);
      const pieces = body.split(/\s*(?:,\s*and|,|\band)\s+/);
      if (pieces.length < 2) break;
      const need = wanted - parts.length + 1;
      const first = pieces.slice(0, pieces.length - need + 1).join(' and ');
      parts.splice(index, 1, `${head}${first}`, ...pieces.slice(pieces.length - need + 1));
    }
  }

  return parts.length ? parts : [s];
}

function removeSpans(text: string, spans: { start: number; end: number }[]) {
  let out = text;
  for (const span of [...spans].sort((a, b) => b.start - a.start)) out = `${out.slice(0, span.start)} ${out.slice(span.end)}`;
  return out;
}

function tidyTitle(text: string) {
  let out = text.replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 6; i++) {
    const next = out
      .replace(COMMAND_RE, '')
      .replace(/^(?:to|that|and|so|the task|about|for|with|which|is|it'?s|it is|this is|there is|as|a task|task)\s+/, '')
      .replace(/\s+(?:and|with|by|on|for|at|it|is|as|priority|the|to|please|task|due|deadline|before|in|of|which|that|so|also)$/, '')
      .replace(/^[,.:;\-\s]+|[,:;\-\s]+$/g, '')
      .trim();
    if (next === out) break;
    out = next;
  }
  return out.replace(/\s+([,.])/g, '$1').replace(/\.$/, '').trim();
}

function draftFrom(segment: string, ctx: UnderstandContext, transcript: string): TaskDraft & { notes: DraftNote } {
  const notes: DraftNote = {};
  const spans: { start: number; end: number }[] = [];

  const priority = findPriority(segment);
  if (priority) { spans.push(priority); notes.heardPriority = true; }

  const date = findDate(segment, ctx.today);
  if (date) { spans.push(date); notes.heardDate = true; }

  const assignee = findAssignee(segment, ctx);
  if (assignee) { spans.push(assignee); notes.heardAssignee = true; }

  let type: TaskType | null = null;
  for (const [kind, pattern] of EXPLICIT_TYPES) {
    const match = pattern.exec(segment);
    if (match) {
      type = kind;
      // Only drop a type phrase that isn't part of the sentence itself ("this is a bug").
      if (/^(?:it'?s |it is |this is |log |as )/.test(match[0]) || /^(?:a |an )?(?:new )?(?:feature request|change request|software update|content task)/.test(match[0])) spans.push({ start: match.index, end: match.index + match[0].length });
      break;
    }
  }

  // Explicit "tag it X" / "in the X section" phrases are tags, not title text.
  const areaFound = findAreas(segment, ctx.areas);
  const tagPhrase = /\b(?:tag(?:ged)?(?: it)?(?: as| with| under)?|under(?: the)?|category|section|area)\s+([a-z0-9 &/-]+?)(?:\s+(?:section|tab|page|area))?(?=$|[,.;])/g;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = tagPhrase.exec(segment))) {
    if (findAreas(tagMatch[1], ctx.areas).length) spans.push({ start: tagMatch.index, end: tagMatch.index + tagMatch[0].length });
  }

  const typeText = removeSpans(segment, areaFound);
  if (!type) for (const [kind, pattern] of TYPE_HINTS) if (pattern.test(typeText)) { type = kind; break; }

  let areas = areaFound.map(area => area.value);
  if (areas.length) notes.heardAreas = true;
  else if (ctx.currentArea && ctx.areas.some(area => area.slug === ctx.currentArea)) { areas = [ctx.currentArea]; notes.usedCurrentArea = true; }

  let body = tidyTitle(removeSpans(segment, spans));
  if (!body) body = tidyTitle(segment);

  // "the student portal, login fails after OTP" → the area is already a tag; keep the actual problem.
  for (const area of areaFound) {
    const alias = segment.slice(area.start, area.end).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lead = new RegExp(`^(?:in |on |for |at )?(?:the )?${alias}s?(?: (?:section|page|tab|screen|module|portal))?\\s*[,:;\\-–]\\s*(.{6,})$`, 'i');
    const match = lead.exec(body);
    if (match) { body = tidyTitle(match[1]) || match[1]; break; }
  }

  // First sentence is the title; the rest are details.
  let title = body;
  let details = '';
  const sentence = /^(.{8,}?[.;])\s+(.+)$/.exec(body);
  if (sentence) { title = sentence[1].replace(/[.;]$/, ''); details = sentence[2]; }
  if (title.length > 120) {
    const cut = title.slice(0, 120).replace(/[\s,]+\S*$/, '');
    details = [title, details].filter(Boolean).join(' ');
    title = `${cut}…`;
  }

  return {
    title: restoreCase(title).slice(0, 200),
    details: details ? restoreCase(details) : '',
    type: type || 'other',
    priority: priority?.value || 'medium',
    areas,
    assignee_id: assignee?.value ?? null,
    due_date: date?.value ?? null,
    source: 'voice',
    voice_transcript: transcript,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------
function answerQuery(s: string, ctx: UnderstandContext, heard: string): Understanding {
  let statuses: TaskStatus[] = [...OPEN_STATUSES];
  let label = 'open';
  let overdueOnly = false;

  if (/\b(?:completed?|done|finished|closed|resolved)\b/.test(s)) { statuses = ['completed']; label = 'completed'; }
  else if (/\b(?:postponed|on hold|delayed|parked)\b/.test(s)) { statuses = ['postponed']; label = 'postponed'; }
  else if (/\b(?:in progress|ongoing|being worked on|started|processing)\b/.test(s)) { statuses = ['in_progress']; label = 'in-progress'; }
  else if (/\b(?:cancell?ed|dropped)\b/.test(s)) { statuses = ['cancelled']; label = 'cancelled'; }
  else if (/\b(?:not started|todo|to do)\b/.test(s)) { statuses = ['todo']; label = 'not-started'; }
  if (/\b(?:overdue|late|missed|past due|delayed deadline)\b/.test(s)) { overdueOnly = true; label = 'overdue'; statuses = [...OPEN_STATUSES]; }

  const areas = findAreas(s, ctx.areas).map(area => area.value);
  const priority = /\burgent|critical\b/.test(s) ? 'urgent' : /\bhigh priority|important\b/.test(s) ? 'high' : null;
  let assignee: string | null | undefined;
  if (/\b(?:my|mine|me|i have|assigned to me|for me)\b/.test(s)) assignee = ctx.me;
  else {
    const named = /\b(?:for|of|assigned to|with)\s+([a-z]+)\b/.exec(s);
    const id = named ? findAdmin(named[1], ctx) : null;
    if (id) assignee = id;
  }
  const due = findDate(s.replace(/\boverdue\b/, ''), ctx.today);
  const dueWindow = /\bthis week\b/.test(s) ? 'week' : due ? 'day' : null;

  const matches = ctx.tasks
    .filter(task => statuses.includes(task.status))
    .filter(task => !overdueOnly || isOverdue(task, ctx.today))
    .filter(task => !areas.length || areas.some(area => task.areas.includes(area)))
    .filter(task => !priority || task.priority === priority || (priority === 'high' && task.priority === 'urgent'))
    .filter(task => assignee === undefined || task.assignee_id === assignee)
    .filter(task => {
      if (!dueWindow || !due) return true;
      if (dueWindow === 'day') return task.due_date === due.value;
      return !!task.due_date && task.due_date >= ctx.today && task.due_date <= due.value;
    })
    .sort((a, b) => compareTasks(a, b, ctx.today));

  const where = areas.length ? ` in ${areas.map(slug => ctx.areas.find(area => area.slug === slug)?.label || slug).join(' and ')}` : '';
  const whose = assignee === undefined ? '' : assignee === ctx.me ? ' assigned to you' : ` assigned to ${ctx.admins.find(a => a.id === assignee)?.name || 'them'}`;
  const pri = priority ? ` ${priority}` : '';
  const noun = matches.length === 1 ? 'task' : 'tasks';

  if (!matches.length) return { kind: 'query', heard, tasks: [], answer: `There are no ${label}${pri} tasks${where}${whose}.` };

  const names = matches.slice(0, 5).map(task => task.title);
  const list = names.length > 1 ? `${names.slice(0, -1).join('; ')}; and ${names[names.length - 1]}` : names[0];
  const more = matches.length > 5 ? `, plus ${matches.length - 5} more` : '';
  return { kind: 'query', heard, tasks: matches, answer: `${matches.length} ${label}${pri} ${noun}${where}${whose}: ${list}${more}.` };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
export function understand(transcript: string, ctx: UnderstandContext): Understanding {
  const heard = String(transcript || '').trim();
  const s = stripPrefix(normalise(heard));

  if (!s || s.split(/\s+/).length < 2 && !/^(?:help)$/.test(s)) {
    return { kind: 'none', heard, message: "I didn't catch a task there. Try: “Add a bug in Question Bank — filters reset after search, high priority, due Friday.”" };
  }

  if (QUERY_START_RE.test(s) || (/\?\s*$/.test(s) && !/^(?:add|create|log|new)\b/.test(s))) {
    return answerQuery(s, ctx, heard);
  }

  const intent = updateIntent(s.replace(/\s*\.\s*$/, ''));
  if (intent) {
    const target = cleanTarget(intent.target);
    const candidates = findTask(target, ctx, intent.prefer);

    if (candidates.length) {
      const changes: TaskChanges = { ...intent.changes };
      let note: string | null = null;
      const rest = ` ${intent.rest} `;

      if ('due_date' in changes || changes.status === 'postponed') {
        const date = findDate(rest, ctx.today);
        if ('due_date' in changes) changes.due_date = date?.value ?? null;
        if (changes.status === 'postponed') changes.postponed_until = date?.value ?? null;
        const reason = /\b(?:because|as|since|due to|reason is|reason being|waiting for|waiting on|till we get|until we get)\b\s*(.+)$/.exec(rest.trim());
        if (reason) {
          const why = reason[0].replace(/^(?:because|as|since|reason is|reason being)\s+/, '').trim();
          if (changes.status === 'postponed') changes.postpone_reason = restoreCase(why).slice(0, 500);
          note = restoreCase(why);
        }
      }
      if ('assignee_id' in changes) {
        const name = /assign to (.+)$/.exec(intent.rest)?.[1] || '';
        const id = findAdmin(name, ctx);
        if (!id) return { kind: 'none', heard, message: `I couldn't find an admin called “${name}”.` };
        changes.assignee_id = id;
      }
      if (changes.status && changes.status !== 'postponed') {
        const extra = findDate(rest, ctx.today);
        if (extra && changes.status === 'todo') changes.due_date = extra.value;
      }

      const parts: string[] = [];
      if (changes.status) parts.push(`mark as ${STATUS_META[changes.status].label.toLowerCase()}`);
      if (changes.postponed_until) parts.push(`until ${friendlyDay(changes.postponed_until, ctx.today)}`);
      if (changes.postpone_reason) parts.push(`(${changes.postpone_reason})`);
      if (changes.priority) parts.push(`set priority to ${PRIORITY_META[changes.priority].label.toLowerCase()}`);
      if ('due_date' in changes && !changes.status) parts.push(changes.due_date ? `set due date to ${friendlyDay(changes.due_date, ctx.today)}` : 'clear the due date');
      if (changes.assignee_id) parts.push(`assign to ${ctx.admins.find(a => a.id === changes.assignee_id)?.name || 'admin'}`);

      return { kind: 'update', heard, target, candidates, changes, note, summary: parts.join(' ') };
    }

    if (!intent.couldBeNew) {
      return { kind: 'none', heard, message: `I couldn't find a task matching “${target}”. Say a few words from its title, e.g. “mark the login error task as done”.` };
    }
  }

  const drafts = splitTasks(s).map(segment => draftFrom(segment, ctx, heard)).filter(draft => draft.title.length >= 2);
  if (!drafts.length) return { kind: 'none', heard, message: "I didn't catch what the task is. Please say it again." };
  return { kind: 'create', heard, drafts };
}

// ---------------------------------------------------------------------------
// Follow-ups while a draft is on screen: "yes" / "no" / spoken corrections
// ---------------------------------------------------------------------------
const YES_RE = /^(?:yes|yeah|yep|yup|ya|sure|ok|okay|save|saved|confirm|confirmed|do it|go ahead|correct|right|perfect|looks good|that'?s right|done|add it|add them|haan|han|ha|haa|theek hai|thik hai|sahi hai|avunu|avnu|sare|save cheyyi|save karo|हाँ|हां|ठीक है|सही है|అవును|సరే)(?=\s|$)/;
const NO_RE = /^(?:no|nope|nah|cancel|discard|stop|don'?t|do not|never mind|nevermind|leave it|forget it|scrap it|nahi|nahin|nai|mat karo|rehne do|vaddu|kaadu|వద్దు|కాదు|नहीं|नही|रहने दो)(?=\s|$)/;

/** "yes" → save, "no" → discard, anything else → null (maybe a correction). */
export function confirmWord(text: string): 'yes' | 'no' | null {
  const s = ` ${String(text || '').toLowerCase().replace(/[.,!?।]/g, ' ')} `
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:(?:please|hey atlas|atlas|um+|uh+)\s+)+/, '');
  if (NO_RE.test(s)) return 'no';
  if (YES_RE.test(s) && s.split(' ').length <= 4) return 'yes';
  return null;
}

type Draft = TaskDraft & { notes: DraftNote };

/** Applies a spoken correction to the drafts on screen. Null when nothing in it was understood. */
export function refineDrafts(drafts: Draft[], text: string, ctx: UnderstandContext): { drafts: Draft[]; changed: string[] } | null {
  const s = stripPrefix(normalise(text));
  if (!s || !drafts.length) return null;

  const ordinal = /\b(first|second|third|fourth|fifth|last)\s+(?:one|task|item|bug)\b/.exec(s);
  let targets: number[];
  if (ordinal) {
    const index = ordinal[1] === 'last' ? drafts.length - 1 : (ORDINAL_WORDS[ordinal[1]] ?? 1) - 1;
    if (index < 0 || index >= drafts.length) return null;
    targets = [index];
  } else if (/\b(?:them|all|both|every|each|everything)\b/.test(s) || drafts.length === 1) {
    targets = drafts.map((_, i) => i);
  } else {
    targets = [drafts.length - 1];
  }

  const patch: Partial<Draft> = {};
  const changed: string[] = [];
  let addAreas: string[] = [];
  let removeAreas: string[] = [];

  const title = /\b(?:call it|name it|title is|title should be|rename it to|rename to|change the title to|change title to|set the title to)\s+(.+)$/.exec(s);
  if (title) {
    patch.title = restoreCase(title[1]).slice(0, 200);
    changed.push(`title “${patch.title}”`);
  }

  const details = /\b(?:add details?|details are|details:|description is|add a note|note:)\s*(.+)$/.exec(s);
  if (details && !title) {
    patch.details = restoreCase(details[1]);
    changed.push('details');
  }

  const rest = title ? s.slice(0, title.index) : details ? s.slice(0, details.index) : s;

  const priority = findPriority(rest) || (() => {
    const m = new RegExp(`\\b(?:make|set|mark|change)\\s+(?:it|them|this|that|the priority|priority)?\\s*(?:to\\s+|as\\s+)?${PRIORITY_WORD}\\b`).exec(rest);
    return m ? { value: toPriority(m[1]), start: m.index, end: m.index + m[0].length } : null;
  })();
  if (priority) {
    patch.priority = priority.value;
    changed.push(`${PRIORITY_META[priority.value].label.toLowerCase()} priority`);
  }

  if (/\b(?:no|remove the|remove|clear the|clear|without(?: a)?)\s+(?:due date|deadline|date)\b/.test(rest)) {
    patch.due_date = null;
    changed.push('no due date');
  } else {
    const date = findDate(rest, ctx.today);
    if (date) {
      patch.due_date = date.value;
      changed.push(`due ${date.value}`);
    }
  }

  if (/\b(?:unassign|nobody|no one|no assignee|don'?t assign)\b/.test(rest)) {
    patch.assignee_id = null;
    changed.push('unassigned');
  } else {
    const assign = /\b(?:assign(?:ed)?(?: it| them| this)? to|give (?:it|them) to|for)\s+([a-z]+(?: [a-z]+)?)\b/.exec(rest);
    const id = assign ? findAdmin(assign[1], ctx) || findAdmin(assign[1].split(' ')[0], ctx) : null;
    if (id) {
      patch.assignee_id = id;
      changed.push(`assigned to ${ctx.admins.find(a => a.id === id)?.name || 'admin'}`);
    }
  }

  const typeMatch = /\b(?:it'?s|it is|this is|make it|change it to|type is|type to|mark it as|they are|these are)\s+(?:a |an )?(bug|error|feature(?: request)?|change(?: request)?|software update|update|content(?: task| work)?|other)\b/.exec(rest);
  if (typeMatch) {
    const word = typeMatch[1];
    patch.type = /bug|error/.test(word) ? 'bug' : /feature/.test(word) ? 'feature' : /change/.test(word) ? 'change' : /update/.test(word) ? 'update' : /content/.test(word) ? 'content' : 'other';
    changed.push(`type ${patch.type}`);
  }

  const removeMatch = /\b(?:remove|drop|untag|take out)\s+(?:the\s+)?(?:tag|area|section)?\s*(.+?)(?:\s+(?:tag|area|section))?$/.exec(rest);
  if (removeMatch && !/\b(?:due date|deadline|date)\b/.test(removeMatch[1])) removeAreas = findAreas(removeMatch[1], ctx.areas).map(a => a.value);
  const setMatch = /\b(?:(?:the )?(?:area|section|tag|category) (?:is|should be)|tag (?:it|them) (?:as|with|under)?|move (?:it|them) to|it'?s (?:in|for|under))\s+(.+)$/.exec(rest);
  const addMatch = /\b(?:add|also|plus|and)\s+(?:the\s+)?(?:tag|area|section)?\s*(.+?)(?:\s+(?:tag|area|section|too|also))?$/.exec(rest);
  if (setMatch) {
    const found = findAreas(setMatch[1], ctx.areas).map(a => a.value);
    if (found.length) { patch.areas = found; changed.push('areas'); }
  } else if (addMatch && !removeMatch) {
    addAreas = findAreas(addMatch[1], ctx.areas).map(a => a.value);
  }

  if (!changed.length && !addAreas.length && !removeAreas.length) return null;
  if (addAreas.length) changed.push('added tags');
  if (removeAreas.length) changed.push('removed tags');

  const next = drafts.map((draft, index) => {
    if (!targets.includes(index)) return draft;
    let areas = patch.areas ?? draft.areas;
    if (addAreas.length) areas = [...new Set([...areas, ...addAreas])];
    if (removeAreas.length) areas = areas.filter(a => !removeAreas.includes(a));
    return { ...draft, ...patch, areas, notes: { ...draft.notes } };
  });

  return { drafts: next, changed };
}
