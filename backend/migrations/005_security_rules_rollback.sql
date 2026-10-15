-- =====================================================================
-- Rollback for 005_security_rules.sql — ONLY if something breaks after running it.
-- Re-opens the tables to signed-in users (anon stays closed) so the app works while the
-- problem is fixed. Deleted plain-text passwords are not restored (logins don't need them).
-- =====================================================================
BEGIN;

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

CREATE POLICY rollback_open ON public.users            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY rollback_open ON public.institutes       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY rollback_open ON public.mcqs             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY rollback_open ON public.tests            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY rollback_open ON public.test_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY rollback_open ON public.classes          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY rollback_open ON public.test_attempts    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY rollback_open ON public.offline_papers   FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMIT;
