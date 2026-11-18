-- =====================================================================
-- Migration 006: Admin Tasks (the "Tasks" section of the admin console)
-- =====================================================================
-- A shared to-do list for admins: bugs, change requests, software updates,
-- new features and content work, tagged by the part of Atlas they concern,
-- with status (to do / in progress / postponed / completed / cancelled),
-- priority, assignee, due date and a full history of every change.
--
--   admin_tasks        one row per task
--   admin_task_events  history + comments (who changed what, when)
--   admin_task_tags    custom area tags admins add beyond the built-in ones
--
-- Security: the tables are reachable ONLY through the backend
-- (/api/tasks, admin login + two-step verification required), which uses the
-- service role. Row Level Security is on with no policies, and the anon /
-- authenticated roles have no grants, so the browser can't read or change
-- them directly. Purely additive; safe to run more than once.
--
-- Run once in Supabase → SQL Editor → New query → paste → Run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.admin_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
    details text NOT NULL DEFAULT '' CHECK (char_length(details) <= 5000),
    type text NOT NULL DEFAULT 'bug'
        CHECK (type IN ('bug', 'change', 'update', 'feature', 'content', 'other')),
    status text NOT NULL DEFAULT 'todo'
        CHECK (status IN ('todo', 'in_progress', 'postponed', 'completed', 'cancelled')),
    priority text NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    areas text[] NOT NULL DEFAULT '{}',
    assignee_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    due_date date,
    postponed_until date,
    postpone_reason text CHECK (postpone_reason IS NULL OR char_length(postpone_reason) <= 500),
    completed_at timestamptz,
    source text NOT NULL DEFAULT 'typed' CHECK (source IN ('typed', 'voice')),
    voice_transcript text CHECK (voice_transcript IS NULL OR char_length(voice_transcript) <= 4000),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_tasks_status_idx ON public.admin_tasks (status);
CREATE INDEX IF NOT EXISTS admin_tasks_assignee_idx ON public.admin_tasks (assignee_id);
CREATE INDEX IF NOT EXISTS admin_tasks_updated_idx ON public.admin_tasks (updated_at DESC);
CREATE INDEX IF NOT EXISTS admin_tasks_areas_idx ON public.admin_tasks USING gin (areas);

CREATE TABLE IF NOT EXISTS public.admin_task_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES public.admin_tasks(id) ON DELETE CASCADE,
    actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    kind text NOT NULL CHECK (kind IN ('created', 'updated', 'status', 'comment')),
    changes jsonb NOT NULL DEFAULT '{}'::jsonb,
    comment text CHECK (comment IS NULL OR char_length(comment) <= 2000),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_task_events_task_idx ON public.admin_task_events (task_id, created_at);

CREATE TABLE IF NOT EXISTS public.admin_task_tags (
    slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
    label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 40),
    created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Keep updated_at current on every change.
CREATE OR REPLACE FUNCTION public.admin_tasks_touch() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_tasks_touch ON public.admin_tasks;
CREATE TRIGGER admin_tasks_touch BEFORE UPDATE ON public.admin_tasks
    FOR EACH ROW EXECUTE FUNCTION public.admin_tasks_touch();

-- Backend only: no direct browser access.
ALTER TABLE public.admin_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_task_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_task_tags ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_tasks, public.admin_task_events, public.admin_task_tags FROM anon, authenticated;
GRANT ALL ON public.admin_tasks, public.admin_task_events, public.admin_task_tags TO service_role;
