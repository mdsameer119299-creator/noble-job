-- Rollback for 20260707000001_jobs_provenance.sql
-- Non-destructive to other data: drops only the added column + its index/constraint.
BEGIN;
DROP INDEX IF EXISTS idx_jobs_provenance;
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_provenance_check;
ALTER TABLE jobs DROP COLUMN IF EXISTS provenance;
COMMIT;
