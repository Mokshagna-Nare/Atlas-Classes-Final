-- =====================================================================
-- Migration 001: Student & Class Management + Test Assignment Foundation
-- =====================================================================
-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query).
-- Safe to re-run: every statement is additive (IF NOT EXISTS / OR REPLACE),
-- nothing here drops or rewrites existing data in institutes/users/tests/mcqs/test_attempts.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. CLASSES (a grade/section that belongs to one institute)
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
-- 2. EXTEND public.users so a 'student' row can carry class + roll info
--    (students already log in through public.users with role='student';
--    this just adds the missing columns, it does not create a new table)
-- ---------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS class_id uuid;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS roll_no text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_by uuid;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'users_class_id_fkey'
    ) THEN
        ALTER TABLE public.users
            ADD CONSTRAINT users_class_id_fkey FOREIGN KEY (class_id)
            REFERENCES public.classes(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3. TEST ASSIGNMENTS (which class a given test is released to)
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
-- 4. EXTEND public.test_attempts with real student identity + proctoring signals
--    (existing guest_name/guest_email columns are untouched, so the public
--    guest test-taking link keeps working exactly as it does today)
-- ---------------------------------------------------------------------
ALTER TABLE public.test_attempts ADD COLUMN IF NOT EXISTS student_id uuid;
ALTER TABLE public.test_attempts ADD COLUMN IF NOT EXISTS tab_switch_count integer DEFAULT 0;
ALTER TABLE public.test_attempts ADD COLUMN IF NOT EXISTS fullscreen_exit_count integer DEFAULT 0;
ALTER TABLE public.test_attempts ADD COLUMN IF NOT EXISTS flagged boolean DEFAULT false;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'test_attempts_student_id_fkey'
    ) THEN
        ALTER TABLE public.test_attempts
            ADD CONSTRAINT test_attempts_student_id_fkey FOREIGN KEY (student_id)
            REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Prevent a logged-in student from creating two attempts for the same test
CREATE UNIQUE INDEX IF NOT EXISTS test_attempts_one_per_student
    ON public.test_attempts (test_id, student_id)
    WHERE student_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 5. VIEW: a student's results in the shape the dashboard needs
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
-- 6. Grants (matches the permissive access pattern already used by the
--    other tables in this project -- see institutes_with_users in schema.sql)
-- ---------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO postgres, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_assignments TO postgres, anon, authenticated, service_role;
GRANT SELECT ON public.student_results TO postgres, anon, authenticated, service_role;
