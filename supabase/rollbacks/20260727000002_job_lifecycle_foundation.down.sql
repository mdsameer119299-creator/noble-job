-- Rollback for 20260727000002_job_lifecycle_foundation.sql
BEGIN;
DROP INDEX IF EXISTS public.idx_jobs_lifecycle;
DROP INDEX IF EXISTS public.idx_wfh_jobs_lifecycle;
DROP INDEX IF EXISTS public.idx_abroad_jobs_lifecycle;
DROP INDEX IF EXISTS public.idx_jobs_deadline;
DROP INDEX IF EXISTS public.idx_wfh_jobs_deadline;
DROP INDEX IF EXISTS public.idx_abroad_jobs_deadline;
ALTER TABLE public.jobs
  DROP COLUMN IF EXISTS closed_at,
  DROP COLUMN IF EXISTS last_confirmed_open_at,
  DROP COLUMN IF EXISTS review_due_at,
  DROP COLUMN IF EXISTS application_deadline;
ALTER TABLE public.wfh_jobs
  DROP COLUMN IF EXISTS closed_at,
  DROP COLUMN IF EXISTS last_confirmed_open_at,
  DROP COLUMN IF EXISTS review_due_at,
  DROP COLUMN IF EXISTS application_deadline;
ALTER TABLE public.abroad_jobs
  DROP COLUMN IF EXISTS closed_at,
  DROP COLUMN IF EXISTS last_confirmed_open_at,
  DROP COLUMN IF EXISTS review_due_at,
  DROP COLUMN IF EXISTS application_deadline;
COMMIT;
