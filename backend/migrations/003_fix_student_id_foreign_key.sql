-- =====================================================================
-- Migration 003: Fix test_attempts.student_id foreign key target
-- =====================================================================
-- test_attempts already had a student_id column + FK before migration 001 ran,
-- pointing at an unused "profiles" table (0 rows, not used anywhere else in this
-- app -- all real student/institute accounts live in public.users). Migration
-- 001's "IF NOT EXISTS" guard saw a constraint with that name already existed
-- and skipped adding the correct one, so every real student's test submission
-- has been silently failing with a foreign-key violation since. This drops the
-- stale constraint and points it at the right table. Purely additive/corrective
-- -- it does not touch any existing row data.
-- =====================================================================

ALTER TABLE public.test_attempts DROP CONSTRAINT IF EXISTS test_attempts_student_id_fkey;

ALTER TABLE public.test_attempts
    ADD CONSTRAINT test_attempts_student_id_fkey FOREIGN KEY (student_id)
    REFERENCES public.users(id) ON DELETE SET NULL;
