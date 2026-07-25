-- ============================================================================
-- Give wfh_jobs and abroad_jobs the same ownership + provenance + moderation
-- lifecycle that jobs (private) already has, so employers can post WFH and
-- Abroad jobs through the same admin-approval-gated flow.
--
-- Mirrors, for each table:
--   - jobs.employer_id            (20250603000001_initial_schema.sql)
--   - jobs.provenance             (20260707000001_jobs_provenance.sql)
--   - jobs.status lifecycle widen (20260706000001_jobs_status_lifecycle.sql)
--
-- Existing wfh_jobs/abroad_jobs rows are untouched: employer_id stays NULL
-- (no existing row is employer-owned), provenance defaults to UNCLASSIFIED
-- (fail-closed — these rows were seeded/ingested, not evidence of genuine
-- employer ownership), and existing 'active'/'closed' status values remain
-- valid under the widened CHECK.
--
-- ADDITIVE · IDEMPOTENT · REVERSIBLE · preserves all existing rows.
-- ============================================================================

BEGIN;

-- ── wfh_jobs ────────────────────────────────────────────────────────────
ALTER TABLE public.wfh_jobs
  ADD COLUMN IF NOT EXISTS employer_id UUID REFERENCES public.employers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provenance TEXT;

UPDATE public.wfh_jobs SET provenance = 'UNCLASSIFIED' WHERE provenance IS NULL;
ALTER TABLE public.wfh_jobs ALTER COLUMN provenance SET DEFAULT 'UNCLASSIFIED';

ALTER TABLE public.wfh_jobs DROP CONSTRAINT IF EXISTS wfh_jobs_provenance_check;
ALTER TABLE public.wfh_jobs ADD  CONSTRAINT wfh_jobs_provenance_check
  CHECK (provenance IN ('EMPLOYER','AGGREGATED','CURATED','OFFICIAL','SYNTHETIC','UNCLASSIFIED'));

ALTER TABLE public.wfh_jobs DROP CONSTRAINT IF EXISTS wfh_jobs_status_check;
ALTER TABLE public.wfh_jobs ADD  CONSTRAINT wfh_jobs_status_check
  CHECK (status IN ('draft','pending','active','paused','rejected','closed','archived'));

CREATE INDEX IF NOT EXISTS idx_wfh_jobs_employer_id ON public.wfh_jobs(employer_id);
CREATE INDEX IF NOT EXISTS idx_wfh_jobs_provenance ON public.wfh_jobs(provenance);

-- ── abroad_jobs ─────────────────────────────────────────────────────────
ALTER TABLE public.abroad_jobs
  ADD COLUMN IF NOT EXISTS employer_id UUID REFERENCES public.employers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provenance TEXT;

UPDATE public.abroad_jobs SET provenance = 'UNCLASSIFIED' WHERE provenance IS NULL;
ALTER TABLE public.abroad_jobs ALTER COLUMN provenance SET DEFAULT 'UNCLASSIFIED';

ALTER TABLE public.abroad_jobs DROP CONSTRAINT IF EXISTS abroad_jobs_provenance_check;
ALTER TABLE public.abroad_jobs ADD  CONSTRAINT abroad_jobs_provenance_check
  CHECK (provenance IN ('EMPLOYER','AGGREGATED','CURATED','OFFICIAL','SYNTHETIC','UNCLASSIFIED'));

ALTER TABLE public.abroad_jobs DROP CONSTRAINT IF EXISTS abroad_jobs_status_check;
ALTER TABLE public.abroad_jobs ADD  CONSTRAINT abroad_jobs_status_check
  CHECK (status IN ('draft','pending','active','paused','rejected','closed','archived'));

CREATE INDEX IF NOT EXISTS idx_abroad_jobs_employer_id ON public.abroad_jobs(employer_id);
CREATE INDEX IF NOT EXISTS idx_abroad_jobs_provenance ON public.abroad_jobs(provenance);

COMMIT;
