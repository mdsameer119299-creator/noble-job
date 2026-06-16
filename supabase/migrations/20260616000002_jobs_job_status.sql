-- ============================================================================
-- Add jobs.job_status (hybrid LIVE/VERIFIED/ARCHIVED status used by the admin
-- dashboard + job mapper). The application code (jobMapper, jobService,
-- adminService.getAdminStats/setJobStatus, /api/admin/job-status, generated
-- types/supabase.ts) already expects this column, but production never received
-- it — so the admin "Live/Verified/Archived Jobs" cards read 0 and setJobStatus
-- errors. This migration adds the column and backfills it to match the existing
-- fallback rule in jobService.ts (is_verified ? VERIFIED_JOB : LIVE_JOB).
--
-- ADDITIVE · IDEMPOTENT · REVERSIBLE · preserves all existing rows.
-- ============================================================================

BEGIN;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS job_status TEXT DEFAULT 'LIVE_JOB';

-- Constraint added separately so re-runs never fail on an existing constraint.
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_job_status_check;
ALTER TABLE jobs ADD  CONSTRAINT jobs_job_status_check
  CHECK (job_status IN ('LIVE_JOB','VERIFIED_JOB','ARCHIVED_JOB'));

-- Backfill only rows that have no hybrid status yet (idempotent: re-runs are no-ops
-- because subsequent rows already have a non-null value).
UPDATE jobs
   SET job_status = CASE WHEN is_verified THEN 'VERIFIED_JOB' ELSE 'LIVE_JOB' END
 WHERE job_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_job_status ON jobs(job_status);

COMMIT;
