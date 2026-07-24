-- Rollback for 20260725000001_wfh_abroad_featured.sql
BEGIN;
DROP INDEX IF EXISTS idx_wfh_jobs_featured;
DROP INDEX IF EXISTS idx_abroad_jobs_featured;
ALTER TABLE public.wfh_jobs DROP COLUMN IF EXISTS is_featured;
ALTER TABLE public.abroad_jobs DROP COLUMN IF EXISTS is_featured;
COMMIT;
