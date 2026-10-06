-- =====================================================================
-- Atlas Classes — Reference Schema (synced against the live Supabase project)
-- =====================================================================
-- This file is a REFERENCE SNAPSHOT for developers, not a setup/deploy script.
-- Do NOT run this against the live database — it exists so you can read what
-- the real schema looks like without needing dashboard access. Actual schema
-- changes are made through the numbered files in backend/migrations/, each of
-- which is additive-only (CREATE ... IF NOT EXISTS / ALTER ... ADD COLUMN IF
-- NOT EXISTS) and safe to run against the live project.
--
-- IMPORTANT: an earlier version of this file started with DROP TABLE ... CASCADE
-- statements for institutes/users/mcqs/tests. That was a landmine — running it
-- against the live project would have destroyed all production data. Those
-- statements have been removed entirely; nothing below is destructive.
--
-- Column types below are a best-effort match to the live project (introspected
-- via the Supabase client, which doesn't expose exact Postgres types) — treat
-- exact types as approximate, the column *names* and *relationships* are what's
-- been verified against the real project.
-- =====================================================================

-- ---------------------------------------------------------------------
-- institutes — one row per partner school (auth.users.id === institutes.id)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.institutes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name character varying NOT NULL,
    email character varying,
    logo_url text,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT institutes_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------
-- users — profile row for every account (admin/institute/student), keyed by
-- the Supabase Auth user id. Students are role='student' rows here, not a
-- separate table — see backend/routes/auth.js create-student/bulk-create-students.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id uuid NOT NULL,
    name character varying,
    email character varying,
    role character varying, -- 'admin' | 'institute' | 'student'
    institute_id uuid,
    class_id uuid,          -- students only; which class they belong to
    roll_no text,           -- students only
    password text,          -- plaintext mirror for admin-panel credential display (pre-existing pattern; not this app's password check — Supabase Auth handles real auth)
    created_by uuid,        -- which admin/institute account provisioned this user
    logo_url text,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE SET NULL,
    CONSTRAINT users_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
-- classes — a grade/section belonging to one institute (migrations/001)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.classes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    institute_id uuid NOT NULL,
    name text NOT NULL,
    subjects text[] DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    CONSTRAINT classes_pkey PRIMARY KEY (id),
    CONSTRAINT classes_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE,
    CONSTRAINT classes_institute_name_unique UNIQUE (institute_id, name)
);

-- ---------------------------------------------------------------------
-- mcqs — the question bank
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mcqs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    question text NOT NULL,
    type text,
    options jsonb,
    answer text NOT NULL,
    answer_index integer,
    explanation text,
    "diagramDescription" text,
    "diagramSvg" text,
    subject text NOT NULL,
    topic text,
    sub_topic text,
    grade text,
    difficulty text,
    question_type text,
    question_code text,
    skill_type text,
    marks integer,
    imageUrl text,
    inline_images text[],
    option_images text[],
    option_inline_images jsonb,
    source text,
    remarks text,
    parser_meta jsonb,
    "isFlagged" boolean DEFAULT false,
    "flagReason" text,
    "createdAt" timestamptz DEFAULT now(),
    "updatedAt" timestamptz DEFAULT now(),
    CONSTRAINT mcqs_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------
-- tests — an online CBT test (NOTE: total_marks does NOT exist live,
-- despite older frontend code referencing it — do not rely on it)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tests (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    title character varying NOT NULL,
    subject text,
    duration integer,
    duration_minutes integer,
    date timestamptz,       -- stores UTC midnight of the chosen day (verified live — not a plain `date`)
    institute_id uuid,
    question_ids uuid[],
    status text, -- 'Upcoming' | 'scheduled' | 'completed' | 'cancelled' (inconsistent casing historically — check before filtering)
    start_window timestamptz,
    end_window timestamptz,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT tests_pkey PRIMARY KEY (id),
    CONSTRAINT tests_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- test_assignments — which class(es) a test is released to (migrations/001)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.test_assignments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    test_id uuid NOT NULL,
    class_id uuid NOT NULL,
    assigned_at timestamptz DEFAULT now(),
    opens_at timestamptz,
    closes_at timestamptz,
    CONSTRAINT test_assignments_pkey PRIMARY KEY (id),
    CONSTRAINT test_assignments_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE,
    CONSTRAINT test_assignments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE,
    CONSTRAINT test_assignments_unique UNIQUE (test_id, class_id)
);

-- ---------------------------------------------------------------------
-- test_attempts — one row per completed test submission, guest or authenticated.
-- student_id is set for logged-in students (migrations/001, fixed in 003 after
-- it was found pointing at an unused "profiles" table); guest_name/guest_email
-- are set for anonymous public-link test-takers. Never both.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.test_attempts (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    test_id uuid NOT NULL,
    student_id uuid,       -- authenticated students
    guest_name text,       -- anonymous/public-link attempts
    guest_email text,
    start_time timestamptz,
    end_time timestamptz,
    completed_at timestamptz,
    status text,
    score integer,
    total_correct integer,
    total_wrong integer,
    answers jsonb DEFAULT '{}'::jsonb,             -- {questionId: selectedOptionIndex} (migrations/002)
    tab_switch_count integer DEFAULT 0,             -- proctoring (migrations/001)
    fullscreen_exit_count integer DEFAULT 0,        -- proctoring (migrations/001)
    flagged boolean DEFAULT false,                  -- proctoring (migrations/001)
    CONSTRAINT test_attempts_pkey PRIMARY KEY (id),
    CONSTRAINT test_attempts_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE,
    CONSTRAINT test_attempts_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE SET NULL
);

-- One attempt per student per test (migrations/001)
CREATE UNIQUE INDEX IF NOT EXISTS test_attempts_one_per_student
    ON public.test_attempts (test_id, student_id)
    WHERE student_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- student_results — convenience view joining an attempt back to its test title
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.student_results AS
SELECT
    ta.id AS attempt_id,
    ta.student_id,
    ta.test_id,
    t.title,
    ta.score,
    ta.total_correct,
    ta.total_wrong,
    ta.end_time,
    ta.tab_switch_count,
    ta.fullscreen_exit_count,
    ta.flagged
FROM public.test_attempts ta
JOIN public.tests t ON t.id = ta.test_id
WHERE ta.student_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- offline_papers — PDF/generated question papers (used by CreateTest.tsx's
-- "Load from Existing Paper" tab and the paper-generator tools). Columns
-- below are a best-effort snapshot; this table predates this file's sync pass.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.offline_papers (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    title text,
    subject text,
    grade text,
    duration integer,
    total_marks integer,
    question_ids uuid[],
    question_allocations jsonb,
    section text,
    assessment_type text,
    exam_type text,
    exam_date date,
    tracks_enabled boolean,
    subject_config jsonb,
    status text,
    downloads integer DEFAULT 0,
    student_downloads integer DEFAULT 0,
    teacher_downloads integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT offline_papers_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------
-- profiles — EXISTS in the live project but is empty and unused by this
-- app; every real account lives in public.users instead. Left undocumented
-- here on purpose beyond this note — do not build new features against it
-- without first checking whether it's actually meant to replace `users`.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- institutes_with_users — combines institutes + their login email
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.institutes_with_users AS
SELECT
    i.id,
    i.name,
    u.email,
    i.created_at
FROM
    public.institutes i
LEFT JOIN
    public.users u ON i.id = u.institute_id
WHERE
    u.role = 'institute';

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.institutes_with_users TO postgres, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.student_results TO postgres, anon, authenticated, service_role;
