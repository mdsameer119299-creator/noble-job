-- ============================================================================
-- Phase 1 (SEO foundation) — job expiry / freshness lifecycle
--
-- Separates two things that must never be confused:
--
--   application_deadline   the EMPLOYER's real closing date, if one exists. This
--                          (and only this) may become JobPosting `validThrough`.
--                          Employer-editable. NULL = no deadline → no validThrough.
--   review_due_at          NobleJob's INTERNAL "is this still open?" review date.
--                          NEVER exposed as validThrough or shown as a deadline.
--
-- plus the bookkeeping the lifecycle needs:
--
--   last_confirmed_open_at when the employer / source last confirmed it is open
--   closed_at              when the row was closed (by deadline or employer/source)
--
-- Lifecycle: open → review due (review_due_at passed) → employer/source
-- confirmation → still open (review_due_at pushed out) OR closed (closed_at set,
-- status='closed') → JobPosting removed (closed rows fail isOpen()).
-- Nothing here invents a deadline; existing rows keep NULL in every new column.
--
-- Applies to the three employer-postable tables. ADDITIVE · IDEMPOTENT ·
-- REVERSIBLE. Not applied to production by this change. Code tolerates the
-- columns being absent until this is applied.
-- ============================================================================

BEGIN;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS application_deadline   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_due_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_confirmed_open_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at              TIMESTAMPTZ;

ALTER TABLE public.wfh_jobs
  ADD COLUMN IF NOT EXISTS application_deadline   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_due_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_confirmed_open_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at              TIMESTAMPTZ;

ALTER TABLE public.abroad_jobs
  ADD COLUMN IF NOT EXISTS application_deadline   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_due_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_confirmed_open_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at              TIMESTAMPTZ;

-- The lifecycle job scans only rows that are still open.
CREATE INDEX IF NOT EXISTS idx_jobs_lifecycle        ON public.jobs        (review_due_at)        WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_wfh_jobs_lifecycle    ON public.wfh_jobs    (review_due_at)        WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_abroad_jobs_lifecycle ON public.abroad_jobs (review_due_at)        WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_jobs_deadline         ON public.jobs        (application_deadline) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_wfh_jobs_deadline     ON public.wfh_jobs    (application_deadline) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_abroad_jobs_deadline  ON public.abroad_jobs (application_deadline) WHERE status = 'active';

COMMENT ON COLUMN public.jobs.application_deadline IS 'Employer''s REAL closing date (JobPosting validThrough). NULL = none. Never derived from posted_at.';
COMMENT ON COLUMN public.jobs.review_due_at        IS 'NobleJob INTERNAL review date. Never validThrough, never shown as a deadline.';

COMMIT;
