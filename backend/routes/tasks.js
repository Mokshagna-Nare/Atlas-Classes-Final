/**
 * Admin Tasks — the shared to-do list in the admin console.
 *
 *   GET    /api/tasks                 tasks + admins (for assigning) + custom tags
 *   POST   /api/tasks                 create one ({...task}) or several ({ tasks: [...] })
 *   PATCH  /api/tasks/:id             change fields / status (optional `note` is logged)
 *   DELETE /api/tasks/:id             delete a task (and its history)
 *   GET    /api/tasks/:id/events      history and comments, oldest first
 *   POST   /api/tasks/:id/comments    add a comment
 *   POST   /api/tasks/tags            add a custom area tag
 *
 * Admins only (with two-step verification), via requireAuth. The tables have no
 * browser access at all (migration 006), so every rule lives here.
 */
const express = require('express');
const { supabaseAdmin } = require('../supabaseClient');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();
router.use(requireAuth('admin'));

const TYPES = ['bug', 'change', 'update', 'feature', 'content', 'other'];
const STATUSES = ['todo', 'in_progress', 'postponed', 'completed', 'cancelled'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const SOURCES = ['typed', 'voice'];
const AREA_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BATCH = 20;
const TRACKED = ['title', 'details', 'type', 'status', 'priority', 'areas', 'assignee_id', 'due_date', 'postponed_until', 'postpone_reason'];

class Invalid extends Error {}

const SETUP_MESSAGE =
  'The Tasks database tables are not set up yet. Run backend/migrations/006_admin_tasks.sql once in Supabase → SQL Editor.';

function isMissingTable(error) {
  return error && (error.code === 'PGRST205' || error.code === '42P01' || /Could not find the table|does not exist/i.test(error.message || ''));
}

function fail(res, error) {
  if (error instanceof Invalid) return res.status(400).json({ message: error.message });
  if (isMissingTable(error)) return res.status(503).json({ message: SETUP_MESSAGE, code: 'tasks_setup' });
  console.error('Tasks error:', error?.message || error);
  return res.status(500).json({ message: 'Something went wrong with Tasks. Please try again.' });
}

function text(value, field, { max, required = false } = {}) {
  if (value === undefined) return undefined;
  if (value === null) {
    if (required) throw new Invalid(`${field} is required.`);
    return null;
  }
  if (typeof value !== 'string') throw new Invalid(`${field} must be text.`);
  const clean = value.replace(/\s+$/g, '').replace(/^\s+/g, '');
  if (required && !clean) throw new Invalid(`${field} is required.`);
  if (clean.length > max) throw new Invalid(`${field} can be at most ${max} characters.`);
  return clean;
}

function oneOf(value, field, allowed) {
  if (value === undefined) return undefined;
  if (!allowed.includes(value)) throw new Invalid(`${field} must be one of: ${allowed.join(', ')}.`);
  return value;
}

function date(value, field) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !DATE_RE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Invalid(`${field} must be a date like 2026-12-31.`);
  }
  return value;
}

function areas(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Invalid('Areas must be a list.');
  const clean = [...new Set(value.map(v => String(v).trim().toLowerCase()))];
  if (clean.length > 12) throw new Invalid('A task can have at most 12 area tags.');
  for (const area of clean) if (!AREA_RE.test(area)) throw new Invalid(`"${area}" isn't a valid area tag.`);
  return clean;
}

async function adminIds() {
  const { data, error } = await supabaseAdmin.from('users').select('id').eq('role', 'admin');
  if (error) throw error;
  return new Set((data || []).map(u => u.id));
}

/** Validated column values from a request body (only the fields present). */
async function readFields(body, { creating }) {
  const fields = {
    title: text(body.title, 'Title', { max: 200, required: creating || body.title !== undefined }),
    details: text(body.details, 'Details', { max: 5000 }),
    type: oneOf(body.type, 'Type', TYPES),
    status: oneOf(body.status, 'Status', STATUSES),
    priority: oneOf(body.priority, 'Priority', PRIORITIES),
    areas: areas(body.areas),
    due_date: date(body.due_date, 'Due date'),
    postponed_until: date(body.postponed_until, 'Postponed until'),
    postpone_reason: text(body.postpone_reason, 'Postpone reason', { max: 500 }),
  };

  if (fields.details === null) fields.details = '';

  if (body.assignee_id !== undefined) {
    if (body.assignee_id === null || body.assignee_id === '') {
      fields.assignee_id = null;
    } else if (!(await adminIds()).has(body.assignee_id)) {
      throw new Invalid('Tasks can only be assigned to an admin.');
    } else {
      fields.assignee_id = body.assignee_id;
    }
  }

  if (creating) {
    fields.source = oneOf(body.source ?? 'typed', 'Source', SOURCES);
    fields.voice_transcript = text(body.voice_transcript, 'Voice transcript', { max: 4000 }) ?? null;
  }

  for (const key of Object.keys(fields)) if (fields[key] === undefined) delete fields[key];
  return fields;
}

/** Status side effects: completion time, and postpone details only while postponed. */
function applyStatusRules(fields, previous) {
  const status = fields.status ?? previous?.status ?? 'todo';

  if (fields.status !== undefined && fields.status !== previous?.status) {
    fields.completed_at = status === 'completed' ? new Date().toISOString() : null;
  }

  if (status !== 'postponed') {
    if (previous?.postponed_until || fields.postponed_until) fields.postponed_until = null;
    if (previous?.postpone_reason || fields.postpone_reason) fields.postpone_reason = null;
  }

  return fields;
}

function sameValue(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

// ---------------------------------------------------------------------------

router.get('/', async (req, res) => {
  try {
    const [tasks, admins, tags] = await Promise.all([
      supabaseAdmin.from('admin_tasks').select('*').order('updated_at', { ascending: false }).limit(2000),
      supabaseAdmin.from('users').select('id, name, email').eq('role', 'admin').order('name'),
      supabaseAdmin.from('admin_task_tags').select('slug, label').order('label'),
    ]);
    for (const result of [tasks, admins, tags]) if (result.error) throw result.error;
    res.json({ tasks: tasks.data, admins: admins.data, tags: tags.data, me: req.auth.userId });
  } catch (error) {
    fail(res, error);
  }
});

router.post('/', async (req, res) => {
  try {
    const items = Array.isArray(req.body?.tasks) ? req.body.tasks : [req.body || {}];
    if (!items.length) throw new Invalid('Nothing to add.');
    if (items.length > MAX_BATCH) throw new Invalid(`At most ${MAX_BATCH} tasks can be added at once.`);

    const rows = [];
    for (const item of items) {
      const fields = applyStatusRules(await readFields(item || {}, { creating: true }), null);
      rows.push({ ...fields, created_by: req.auth.userId });
    }

    const { data, error } = await supabaseAdmin.from('admin_tasks').insert(rows).select('*');
    if (error) throw error;

    await supabaseAdmin.from('admin_task_events').insert(
      data.map(task => ({ task_id: task.id, actor_id: req.auth.userId, kind: 'created', changes: { source: task.source } })),
    );

    res.status(201).json({ tasks: data });
  } catch (error) {
    fail(res, error);
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { data: previous, error: readError } = await supabaseAdmin.from('admin_tasks').select('*').eq('id', req.params.id).maybeSingle();
    if (readError) throw readError;
    if (!previous) return res.status(404).json({ message: 'That task no longer exists.' });

    const fields = applyStatusRules(await readFields(req.body || {}, { creating: false }), previous);
    const note = text(req.body?.note, 'Note', { max: 2000 }) || null;
    const changes = {};

    for (const key of TRACKED) {
      if (key in fields && !sameValue(fields[key], previous[key])) changes[key] = [previous[key], fields[key]];
    }

    if (!Object.keys(changes).length && !note) return res.json({ task: previous });

    let task = previous;
    if (Object.keys(changes).length) {
      const { data, error } = await supabaseAdmin.from('admin_tasks').update(fields).eq('id', previous.id).select('*').single();
      if (error) throw error;
      task = data;
    }

    await supabaseAdmin.from('admin_task_events').insert({
      task_id: task.id,
      actor_id: req.auth.userId,
      kind: changes.status ? 'status' : Object.keys(changes).length ? 'updated' : 'comment',
      changes,
      comment: note,
    });

    res.json({ task });
  } catch (error) {
    fail(res, error);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('admin_tasks').delete().eq('id', req.params.id).select('id');
    if (error) throw error;
    if (!data.length) return res.status(404).json({ message: 'That task no longer exists.' });
    res.json({ deleted: data[0].id });
  } catch (error) {
    fail(res, error);
  }
});

router.get('/:id/events', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_task_events')
      .select('id, kind, changes, comment, actor_id, created_at')
      .eq('task_id', req.params.id)
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) throw error;
    res.json({ events: data });
  } catch (error) {
    fail(res, error);
  }
});

router.post('/:id/comments', async (req, res) => {
  try {
    const comment = text(req.body?.comment, 'Comment', { max: 2000, required: true });
    const { data: task, error: readError } = await supabaseAdmin.from('admin_tasks').select('id').eq('id', req.params.id).maybeSingle();
    if (readError) throw readError;
    if (!task) return res.status(404).json({ message: 'That task no longer exists.' });

    const { data, error } = await supabaseAdmin
      .from('admin_task_events')
      .insert({ task_id: task.id, actor_id: req.auth.userId, kind: 'comment', comment })
      .select('id, kind, changes, comment, actor_id, created_at')
      .single();
    if (error) throw error;

    // A comment counts as activity on the task.
    await supabaseAdmin.from('admin_tasks').update({ updated_at: new Date().toISOString() }).eq('id', task.id);
    res.status(201).json({ event: data });
  } catch (error) {
    fail(res, error);
  }
});

router.post('/tags', async (req, res) => {
  try {
    const label = text(req.body?.label, 'Tag name', { max: 40, required: true });
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    if (!AREA_RE.test(slug)) throw new Invalid('Use letters or numbers in the tag name.');

    const { data, error } = await supabaseAdmin
      .from('admin_task_tags')
      .upsert({ slug, label, created_by: req.auth.userId }, { onConflict: 'slug', ignoreDuplicates: true })
      .select('slug, label');
    if (error) throw error;

    res.status(201).json({ tag: data?.[0] || { slug, label } });
  } catch (error) {
    fail(res, error);
  }
});

module.exports = router;
