-- Rollback for 20260724000001_wfh_abroad_employer_ownership.sql
BEGIN;

ALTER TABLE public.wfh_jobs DROP CONSTRAINT IF EXISTS wfh_jobs_status_check;
ALTER TABLE public.wfh_jobs ADD  CONSTRAINT wfh_jobs_status_check
  CHECK (status IN ('active','closed'));
ALTER TABLE public.wfh_jobs DROP CONSTRAINT IF EXISTS wfh_jobs_provenance_check;
DROP INDEX IF EXISTS idx_wfh_jobs_provenance;
DROP INDEX IF EXISTS idx_wfh_jobs_employer_id;
ALTER TABLE public.wfh_jobs DROP COLUMN IF EXISTS provenance;
ALTER TABLE public.wfh_jobs DROP COLUMN IF EXISTS employer_id;

ALTER TABLE public.abroad_jobs DROP CONSTRAINT IF EXISTS abroad_jobs_status_check;
ALTER TABLE public.abroad_jobs ADD  CONSTRAINT abroad_jobs_status_check
  CHECK (status IN ('active','closed'));
ALTER TABLE public.abroad_jobs DROP CONSTRAINT IF EXISTS abroad_jobs_provenance_check;
DROP INDEX IF EXISTS idx_abroad_jobs_provenance;
DROP INDEX IF EXISTS idx_abroad_jobs_employer_id;
ALTER TABLE public.abroad_jobs DROP COLUMN IF EXISTS provenance;
ALTER TABLE public.abroad_jobs DROP COLUMN IF EXISTS employer_id;

COMMIT;
