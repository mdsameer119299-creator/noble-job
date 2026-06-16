-- Rollback for 20260616000002_jobs_job_status.sql
-- Non-destructive to other data: drops only the added column + its index/constraint.
BEGIN;
DROP INDEX IF EXISTS idx_jobs_job_status;
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_job_status_check;
ALTER TABLE jobs DROP COLUMN IF EXISTS job_status;
COMMIT;
