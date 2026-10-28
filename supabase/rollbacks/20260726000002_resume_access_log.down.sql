-- Rollback for 20260726000002_resume_access_log.sql
BEGIN;
DROP TABLE IF EXISTS public.resume_access_log;
COMMIT;
