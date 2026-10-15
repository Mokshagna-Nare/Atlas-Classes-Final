-- =====================================================================
-- Migration 005: Row-level security for every table the app uses
-- =====================================================================
-- Before this migration, anyone holding the public (anon) key — which ships inside the
-- website — could read every user row (including stored plain-text passwords), every
-- question with its answer, every test attempt, and could insert attempts, classes and
-- test assignments. This migration makes each role see and change only what it should:
--
--   anon (not signed in) .... nothing. Public-link tests are served by the backend.
--   student ................. own profile + own institute's name/logo; own class; tests
--                             assigned to their class; own attempts; questions of tests
--                             they have already submitted (for their results page).
--   institute ............... own institute's students, classes, tests, attempts and
--                             the questions in those tests; manages own classes/tests.
--   admin (2-step done) ..... everything.
--
-- Test attempts are written only by the backend (service role), which checks who may take
-- a test and grades it. The service role bypasses RLS, so the backend keeps working.
--
-- Also: removes stored plain-text passwords (users.password). Logins are unaffected —
-- Supabase Auth keeps its own encrypted copy. Institutes now see a password only when they
-- create or reset it.
--
-- Run in the Supabase SQL editor. Undo with 005_security_rules_rollback.sql.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Who is asking? (SECURITY DEFINER so the rules on `users` don't recurse)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role::text FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.app_institute() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT institute_id FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.app_class() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT class_id FROM public.users WHERE id = auth.uid()
$$;

-- Admins count only after two-step verification (token at assurance level aal2).
CREATE OR REPLACE FUNCTION public.app_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT role = 'admin' FROM public.users WHERE id = auth.uid()), false)
     AND COALESCE(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

-- Tests an institute may see: its own, or assigned to one of its classes.
CREATE OR REPLACE FUNCTION public.app_institute_sees_test(p_test uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tests t
    WHERE t.id = p_test
      AND (t.institute_id = public.app_institute()
           OR EXISTS (SELECT 1 FROM public.test_assignments ta JOIN public.classes c ON c.id = ta.class_id
                      WHERE ta.test_id = t.id AND c.institute_id = public.app_institute()))
  )
$$;

-- Questions a non-admin may read (answers included, so never during a test):
--   institute → questions of its tests; student → questions of tests they already submitted.
CREATE OR REPLACE FUNCTION public.app_can_read_question(p_question uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE public.app_role()
    WHEN 'institute' THEN EXISTS (
      SELECT 1 FROM public.tests t
      WHERE p_question = ANY (t.question_ids) AND public.app_institute_sees_test(t.id))
    WHEN 'student' THEN EXISTS (
      SELECT 1 FROM public.test_attempts a JOIN public.tests t ON t.id = a.test_id
      WHERE a.student_id = auth.uid() AND p_question = ANY (t.question_ids))
    ELSE false
  END
$$;

REVOKE ALL ON FUNCTION public.app_role(), public.app_institute(), public.app_class(), public.app_is_admin(),
  public.app_institute_sees_test(uuid), public.app_can_read_question(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_role(), public.app_institute(), public.app_class(), public.app_is_admin(),
  public.app_institute_sees_test(uuid), public.app_can_read_question(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- Start clean: drop every existing policy on the tables managed here
-- ---------------------------------------------------------------------
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('users', 'institutes', 'mcqs', 'tests', 'test_assignments', 'classes', 'test_attempts', 'offline_papers')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

ALTER TABLE public.users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcqs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_attempts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_papers   ENABLE ROW LEVEL SECURITY;

-- Not signed in = no direct table access at all.
REVOKE ALL ON public.users, public.institutes, public.mcqs, public.tests, public.test_assignments,
  public.classes, public.test_attempts, public.offline_papers FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users, public.institutes, public.mcqs, public.tests,
  public.test_assignments, public.classes, public.test_attempts, public.offline_papers TO authenticated;

-- ---------------------------------------------------------------------
-- users — profiles are created/changed only by the backend
-- ---------------------------------------------------------------------
CREATE POLICY users_read ON public.users FOR SELECT TO authenticated USING (
  id = (SELECT auth.uid())
  OR (SELECT public.app_is_admin())
  OR ((SELECT public.app_role()) = 'institute' AND institute_id = (SELECT public.app_institute()))
  OR (role = 'institute' AND id = (SELECT public.app_institute()))   -- a student's own institute
);

-- ---------------------------------------------------------------------
-- institutes — names and logos for pickers; written by the backend
-- ---------------------------------------------------------------------
CREATE POLICY institutes_read ON public.institutes FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------
-- mcqs — question bank
-- ---------------------------------------------------------------------
CREATE POLICY mcqs_read ON public.mcqs FOR SELECT TO authenticated USING (
  (SELECT public.app_is_admin()) OR public.app_can_read_question(id)
);
CREATE POLICY mcqs_admin_write ON public.mcqs FOR ALL TO authenticated
  USING ((SELECT public.app_is_admin())) WITH CHECK ((SELECT public.app_is_admin()));

-- ---------------------------------------------------------------------
-- tests
-- ---------------------------------------------------------------------
CREATE POLICY tests_read ON public.tests FOR SELECT TO authenticated USING (
  (SELECT public.app_is_admin())
  OR ((SELECT public.app_role()) = 'institute' AND public.app_institute_sees_test(id))
  OR ((SELECT public.app_role()) = 'student' AND (
        EXISTS (SELECT 1 FROM public.test_assignments ta WHERE ta.test_id = tests.id AND ta.class_id = (SELECT public.app_class()))
     OR EXISTS (SELECT 1 FROM public.test_attempts a WHERE a.test_id = tests.id AND a.student_id = (SELECT auth.uid()))))
);
CREATE POLICY tests_admin_write ON public.tests FOR ALL TO authenticated
  USING ((SELECT public.app_is_admin())) WITH CHECK ((SELECT public.app_is_admin()));
-- Institutes keep their own (offline) test records.
CREATE POLICY tests_institute_write ON public.tests FOR ALL TO authenticated
  USING ((SELECT public.app_role()) = 'institute' AND institute_id = (SELECT public.app_institute()))
  WITH CHECK ((SELECT public.app_role()) = 'institute' AND institute_id = (SELECT public.app_institute()));

-- ---------------------------------------------------------------------
-- test_assignments — which classes may take a test
-- ---------------------------------------------------------------------
CREATE POLICY assignments_read ON public.test_assignments FOR SELECT TO authenticated USING (
  (SELECT public.app_is_admin())
  OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = test_assignments.class_id AND c.institute_id = (SELECT public.app_institute()))
);
CREATE POLICY assignments_admin_write ON public.test_assignments FOR ALL TO authenticated
  USING ((SELECT public.app_is_admin())) WITH CHECK ((SELECT public.app_is_admin()));

-- ---------------------------------------------------------------------
-- classes
-- ---------------------------------------------------------------------
CREATE POLICY classes_read ON public.classes FOR SELECT TO authenticated USING (
  (SELECT public.app_is_admin()) OR institute_id = (SELECT public.app_institute())
);
CREATE POLICY classes_write ON public.classes FOR ALL TO authenticated
  USING ((SELECT public.app_is_admin()) OR ((SELECT public.app_role()) = 'institute' AND institute_id = (SELECT public.app_institute())))
  WITH CHECK ((SELECT public.app_is_admin()) OR ((SELECT public.app_role()) = 'institute' AND institute_id = (SELECT public.app_institute())));

-- ---------------------------------------------------------------------
-- test_attempts — inserted only by the backend; admins can review/clear flags
-- ---------------------------------------------------------------------
CREATE POLICY attempts_read ON public.test_attempts FOR SELECT TO authenticated USING (
  (SELECT public.app_is_admin())
  OR student_id = (SELECT auth.uid())
  OR ((SELECT public.app_role()) = 'institute' AND (
        public.app_institute_sees_test(test_id)
     OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = test_attempts.student_id AND u.institute_id = (SELECT public.app_institute()))))
);
CREATE POLICY attempts_admin_update ON public.test_attempts FOR UPDATE TO authenticated
  USING ((SELECT public.app_is_admin())) WITH CHECK ((SELECT public.app_is_admin()));
CREATE POLICY attempts_admin_delete ON public.test_attempts FOR DELETE TO authenticated
  USING ((SELECT public.app_is_admin()));

-- ---------------------------------------------------------------------
-- offline_papers — admin only
-- ---------------------------------------------------------------------
CREATE POLICY papers_admin ON public.offline_papers FOR ALL TO authenticated
  USING ((SELECT public.app_is_admin())) WITH CHECK ((SELECT public.app_is_admin()));

-- ---------------------------------------------------------------------
-- Views: run with the caller's permissions, never for anon
-- ---------------------------------------------------------------------
DO $$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY['student_results', 'institutes_with_users'] LOOP
    IF to_regclass('public.' || v) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', v);
      BEGIN
        EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v);  -- Postgres 15+
      EXCEPTION WHEN others THEN
        EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', v);       -- older Postgres: close it instead
      END;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- Old, unused tables and database functions: closed to the public API
-- ---------------------------------------------------------------------
DO $$
DECLARE t text; f record;
BEGIN
  FOREACH t IN ARRAY ARRAY['questions', 'profiles', 'test_questions', 'attempt_answers', 'question_papers'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    END IF;
  END LOOP;
  FOR f IN
    SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('start_student_test', 'finish_student_test', 'generate_random_test', 'get_user_role', 'get_user_institute_id')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- Stored plain-text passwords: removed (Supabase Auth keeps the real, encrypted one)
-- ---------------------------------------------------------------------
UPDATE public.users SET password = NULL WHERE password IS NOT NULL;

COMMIT;
