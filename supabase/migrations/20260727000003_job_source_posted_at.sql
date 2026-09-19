-- ============================================================================
-- Phase 1 (SEO foundation) — original publication date for JobPosting.datePosted
--
-- Google defines `datePosted` as the ORIGINAL date the employer / source posted
-- the job. NobleJob's `posted_at` is NOT that: it is `DEFAULT NOW()`, i.e. the
-- moment the row was created here (for a sourced job, the ingestion time).
--
--   source_posted_at   the employer's / source's own publication date. The ONLY
--                      column JobPosting `datePosted` may be built from. NULL =
--                      unknown → the job page carries NO JobPosting.
--
-- Deliberately NOT backfilled: there is no honest way to derive it from
-- `posted_at`, `created_at`, `updated_at` or `last_confirmed_open_at`, so existing
-- rows stay NULL until a real source date is captured (adapter-supplied feed date,
-- or an explicit editorial/employer entry).
--
-- Who writes it (never a default, never a trigger, never derived from another column):
--   • sourced / aggregated / curated jobs → the SOURCE's own publication date, captured
--     by an adapter or an explicit editorial entry;
--   • employer-authored jobs (EMPLOYER provenance + employer_id) → stamped ONCE by the
--     application (adminService.approveJob) at first approval = first public availability.
--
-- Counterpart of govt_jobs.source_published_at (migration 20260727000001).
--
-- ADDITIVE · IDEMPOTENT · REVERSIBLE. Not applied to any database by this change;
-- the code tolerates the column being absent.
-- ============================================================================

BEGIN;

ALTER TABLE public.jobs        ADD COLUMN IF NOT EXISTS source_posted_at TIMESTAMPTZ;
ALTER TABLE public.wfh_jobs    ADD COLUMN IF NOT EXISTS source_posted_at TIMESTAMPTZ;
ALTER TABLE public.abroad_jobs ADD COLUMN IF NOT EXISTS source_posted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.jobs.source_posted_at
  IS 'ORIGINAL employer/source publication date (JobPosting.datePosted). NULL = unknown. Never backfilled from posted_at/created_at. Sourced jobs: the date the source published the job. Employer-authored jobs: stamped once by the app at FIRST admin approval (first public availability).';
COMMENT ON COLUMN public.wfh_jobs.source_posted_at
  IS 'ORIGINAL employer/source publication date (JobPosting.datePosted). NULL = unknown. Never backfilled from posted_at/created_at. Sourced jobs: the date the source published the job. Employer-authored jobs: stamped once by the app at FIRST admin approval (first public availability).';
COMMENT ON COLUMN public.abroad_jobs.source_posted_at
  IS 'ORIGINAL employer/source publication date (JobPosting.datePosted). NULL = unknown. Never backfilled from posted_at/created_at. Sourced jobs: the date the source published the job. Employer-authored jobs: stamped once by the app at FIRST admin approval (first public availability).';

COMMIT;
