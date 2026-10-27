-- Rollback for 20260723000001_job_reports.sql
BEGIN;
DROP TABLE IF EXISTS public.job_reports;
COMMIT;
