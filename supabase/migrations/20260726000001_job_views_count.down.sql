-- Rollback for 20260726000001_job_views_count.sql
BEGIN;
DROP FUNCTION IF EXISTS public.increment_job_views(TEXT, UUID);
ALTER TABLE public.jobs DROP COLUMN IF EXISTS views_count;
ALTER TABLE public.wfh_jobs DROP COLUMN IF EXISTS views_count;
ALTER TABLE public.abroad_jobs DROP COLUMN IF EXISTS views_count;
COMMIT;
