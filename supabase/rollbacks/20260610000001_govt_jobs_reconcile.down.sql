-- ============================================================================
-- Rollback for 20260610000001_govt_jobs_reconcile.sql
--
-- Reverses the additive reconciliation. Run only if Phase 0 must be undone.
-- NOTE: any 'expired' rows written after the up-migration must be normalised
-- before the narrow status CHECK can be restored, otherwise the constraint
-- re-add fails.
-- ============================================================================

BEGIN;

-- Restore the original public RLS policy
DROP POLICY IF EXISTS govt_public ON govt_jobs;
CREATE POLICY govt_public ON govt_jobs FOR SELECT USING (status = 'active');

-- Remove the updated_at trigger + function
DROP TRIGGER  IF EXISTS trg_govt_jobs_updated_at ON govt_jobs;
DROP FUNCTION IF EXISTS set_govt_jobs_updated_at();

-- Normalise 'expired' rows, then restore the original narrow status CHECK
UPDATE govt_jobs SET status = 'closed' WHERE status = 'expired';
ALTER TABLE govt_jobs DROP CONSTRAINT IF EXISTS govt_jobs_status_check;
ALTER TABLE govt_jobs ADD  CONSTRAINT govt_jobs_status_check
  CHECK (status IN ('active','closed'));
ALTER TABLE govt_jobs DROP CONSTRAINT IF EXISTS govt_jobs_review_status_check;

-- Drop the indexes added by the up-migration
DROP INDEX IF EXISTS idx_govt_jobs_source;
DROP INDEX IF EXISTS idx_govt_jobs_review;
DROP INDEX IF EXISTS idx_govt_jobs_slug;

-- Drop the added columns
ALTER TABLE govt_jobs
  DROP COLUMN IF EXISTS slug,               DROP COLUMN IF EXISTS state_slug,
  DROP COLUMN IF EXISTS department,         DROP COLUMN IF EXISTS experience,
  DROP COLUMN IF EXISTS category_tags,      DROP COLUMN IF EXISTS qualification_tags,
  DROP COLUMN IF EXISTS selection_process,  DROP COLUMN IF EXISTS job_status,
  DROP COLUMN IF EXISTS notification_pdf,   DROP COLUMN IF EXISTS apply_url,
  DROP COLUMN IF EXISTS overview,           DROP COLUMN IF EXISTS eligibility,
  DROP COLUMN IF EXISTS age_limit,          DROP COLUMN IF EXISTS salary_details,
  DROP COLUMN IF EXISTS exam_pattern,       DROP COLUMN IF EXISTS syllabus_content,
  DROP COLUMN IF EXISTS article,            DROP COLUMN IF EXISTS vacancy_breakup,
  DROP COLUMN IF EXISTS fee_details,        DROP COLUMN IF EXISTS important_dates,
  DROP COLUMN IF EXISTS faqs,               DROP COLUMN IF EXISTS source_id,
  DROP COLUMN IF EXISTS content_hash,       DROP COLUMN IF EXISTS published,
  DROP COLUMN IF EXISTS review_status,      DROP COLUMN IF EXISTS updated_at;

COMMIT;
