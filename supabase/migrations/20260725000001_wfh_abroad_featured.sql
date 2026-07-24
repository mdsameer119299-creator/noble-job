-- ============================================================================
-- Add is_featured to wfh_jobs and abroad_jobs, mirroring jobs.is_featured, so
-- Featured Jobs can pull a genuine mix across all three employer-postable
-- boards instead of private-only.
--
-- ADDITIVE · IDEMPOTENT · REVERSIBLE · preserves all existing rows.
-- ============================================================================

BEGIN;

ALTER TABLE public.wfh_jobs
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.abroad_jobs
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_wfh_jobs_featured ON public.wfh_jobs(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_abroad_jobs_featured ON public.abroad_jobs(is_featured) WHERE is_featured = TRUE;

COMMIT;
