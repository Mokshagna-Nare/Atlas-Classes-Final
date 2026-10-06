-- =====================================================================
-- Migration 002: Store per-question answers on each test attempt
-- =====================================================================
-- Needed for the student "Review Details" screen (Results.tsx) to show which
-- option a student picked per question. Previously only the aggregate score
-- was saved, so per-question review was impossible. Purely additive.
-- =====================================================================

ALTER TABLE public.test_attempts ADD COLUMN IF NOT EXISTS answers jsonb DEFAULT '{}'::jsonb;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_attempts TO postgres, anon, authenticated, service_role;
