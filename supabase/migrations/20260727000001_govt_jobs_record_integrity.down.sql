-- Rollback for 20260727000001_govt_jobs_record_integrity.sql
BEGIN;
DROP TRIGGER  IF EXISTS trg_govt_jobs_content_changed_ins ON govt_jobs;
DROP TRIGGER  IF EXISTS trg_govt_jobs_content_changed     ON govt_jobs;
DROP FUNCTION IF EXISTS set_govt_jobs_content_changed_at_insert();
DROP FUNCTION IF EXISTS set_govt_jobs_content_changed_at();
DROP INDEX    IF EXISTS idx_govt_jobs_record_type;
ALTER TABLE govt_jobs DROP CONSTRAINT IF EXISTS govt_jobs_record_type_check;
ALTER TABLE govt_jobs
  DROP COLUMN IF EXISTS verified_by,
  DROP COLUMN IF EXISTS verified_at,
  DROP COLUMN IF EXISTS content_changed_at,
  DROP COLUMN IF EXISTS source_published_at,
  DROP COLUMN IF EXISTS record_type;
COMMIT;
