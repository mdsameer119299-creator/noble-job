-- Reverts 20260727000003_job_source_posted_at.sql. Drops only the column it added.
BEGIN;

ALTER TABLE public.jobs        DROP COLUMN IF EXISTS source_posted_at;
ALTER TABLE public.wfh_jobs    DROP COLUMN IF EXISTS source_posted_at;
ALTER TABLE public.abroad_jobs DROP COLUMN IF EXISTS source_posted_at;

COMMIT;
