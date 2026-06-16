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

-- Add the column WITHOUT a default first, so existing rows stay NULL and can be
-- correctly classified by the backfill below. (Adding it WITH a default would
-- immediately fill every existing row with 'LIVE_JOB', making the is_verified
-- backfill a no-op and leaving verified jobs mislabelled.)
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS job_status TEXT;

-- Backfill only unclassified rows (idempotent: re-runs match nothing because new
-- rows get the default set below and admin-set values are preserved).
UPDATE jobs
   SET job_status = CASE WHEN is_verified THEN 'VERIFIED_JOB' ELSE 'LIVE_JOB' END
 WHERE job_status IS NULL;

-- Default for future inserts (mirrors the app's fallback for brand-new jobs).
ALTER TABLE jobs ALTER COLUMN job_status SET DEFAULT 'LIVE_JOB';

-- Constraint added separately so re-runs never fail on an existing constraint.
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_job_status_check;
ALTER TABLE jobs ADD  CONSTRAINT jobs_job_status_check
  CHECK (job_status IN ('LIVE_JOB','VERIFIED_JOB','ARCHIVED_JOB'));

CREATE INDEX IF NOT EXISTS idx_jobs_job_status ON jobs(job_status);

COMMIT;
