-- =====================================================================
-- Migration 004: Proctoring violation log + one attempt per public-link email
-- =====================================================================
-- The test portal now treats right-click, keyboard use, leaving the window,
-- switching tabs and exiting fullscreen as violations. On the 3rd violation
-- the attempt is closed automatically (status = 'terminated'). Until this
-- migration runs, the portal saves such attempts as 'finished' + flagged, with
-- the violation log omitted.
--
--   violation_count  total violations recorded on the attempt
--   violations       ordered log: [{ "type": "tab_switch", "at": "<iso time>" }, ...]
--
-- Public-link (guest) attempts get the same "one attempt per test" rule that
-- logged-in students already have, keyed on the email they entered.
-- Purely additive: existing rows keep their data (verified: no duplicate
-- guest emails per test exist, so the unique index builds cleanly).
-- =====================================================================

ALTER TABLE public.test_attempts ADD COLUMN IF NOT EXISTS violation_count integer DEFAULT 0;
ALTER TABLE public.test_attempts ADD COLUMN IF NOT EXISTS violations jsonb DEFAULT '[]'::jsonb;

-- The live table has a status check constraint that predates this repo's schema
-- file and rejects 'terminated'. Recreate it as a superset of the statuses the app
-- has used (every existing row is 'finished', so nothing is invalidated).
ALTER TABLE public.test_attempts DROP CONSTRAINT IF EXISTS test_attempts_status_check;
ALTER TABLE public.test_attempts ADD CONSTRAINT test_attempts_status_check
    CHECK (status IS NULL OR status IN ('started', 'in_progress', 'finished', 'completed', 'abandoned', 'terminated'));

CREATE UNIQUE INDEX IF NOT EXISTS test_attempts_one_per_guest_email
    ON public.test_attempts (test_id, lower(btrim(guest_email)))
    WHERE student_id IS NULL AND guest_email IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_attempts TO postgres, anon, authenticated, service_role;
