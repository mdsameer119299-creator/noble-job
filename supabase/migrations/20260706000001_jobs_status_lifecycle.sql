-- ============================================================================
-- Extend jobs.status to support the full employer/admin lifecycle.
--
-- Before: CHECK (status IN ('active','pending','rejected','closed'))
-- After : adds 'draft' (saved, not submitted), 'paused' (approved but hidden)
--         and 'archived' (soft-removed). 'active' == Approved/Live.
--
-- ADDITIVE · IDEMPOTENT · REVERSIBLE · preserves all existing rows.
-- ============================================================================

BEGIN;

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs ADD  CONSTRAINT jobs_status_check
  CHECK (status IN ('draft','pending','active','paused','rejected','closed','archived'));

COMMIT;
