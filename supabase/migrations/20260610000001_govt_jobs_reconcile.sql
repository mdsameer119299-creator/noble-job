-- ============================================================================
-- Phase 0 — govt_jobs schema reconciliation
--
-- Aligns the live govt_jobs table with what persist() (govtAutoUpdate.ts) writes
-- and with the upcoming admin review workflow. Purely ADDITIVE + idempotent:
-- no column is dropped, no type is changed, the id stays TEXT. The status CHECK
-- is widened to a superset so no existing row can be invalidated, and the public
-- RLS policy is tightened so pending/unpublished rows never leak.
--
-- Safe to re-run. Verified against migrations 20250603000001 (table),
-- 20250603000002 (RLS), 20250603000003 (indexes).
-- ============================================================================

BEGIN;

-- 1. Columns persist() already writes but the live table lacks ---------------
ALTER TABLE govt_jobs
  ADD COLUMN IF NOT EXISTS slug               TEXT,
  ADD COLUMN IF NOT EXISTS state_slug         TEXT,
  ADD COLUMN IF NOT EXISTS department         TEXT,
  ADD COLUMN IF NOT EXISTS experience         TEXT,
  ADD COLUMN IF NOT EXISTS category_tags      TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS qualification_tags TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS selection_process  TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS job_status         TEXT,
  ADD COLUMN IF NOT EXISTS notification_pdf   TEXT,
  ADD COLUMN IF NOT EXISTS apply_url          TEXT,
  ADD COLUMN IF NOT EXISTS overview           TEXT,
  ADD COLUMN IF NOT EXISTS eligibility        TEXT,
  ADD COLUMN IF NOT EXISTS age_limit          TEXT,
  ADD COLUMN IF NOT EXISTS salary_details     TEXT,
  ADD COLUMN IF NOT EXISTS exam_pattern       TEXT,
  ADD COLUMN IF NOT EXISTS syllabus_content   TEXT,
  ADD COLUMN IF NOT EXISTS article            TEXT,
  ADD COLUMN IF NOT EXISTS vacancy_breakup    JSONB,
  ADD COLUMN IF NOT EXISTS fee_details        JSONB,
  ADD COLUMN IF NOT EXISTS important_dates    JSONB,
  ADD COLUMN IF NOT EXISTS faqs               JSONB;

-- 2. Ingestion + review-workflow columns -------------------------------------
ALTER TABLE govt_jobs
  ADD COLUMN IF NOT EXISTS source_id     TEXT,
  ADD COLUMN IF NOT EXISTS content_hash  TEXT,
  ADD COLUMN IF NOT EXISTS published     BOOLEAN     DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS review_status TEXT        DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT NOW();

-- 3. Fix the status constraint mismatch --------------------------------------
--    Live allowed ('active','closed'); code writes 'expired' (expireStaleJobs).
--    Widen to a superset so existing rows stay valid and expiry writes succeed.
ALTER TABLE govt_jobs DROP CONSTRAINT IF EXISTS govt_jobs_status_check;
ALTER TABLE govt_jobs ADD  CONSTRAINT govt_jobs_status_check
  CHECK (status IN ('active','expired','closed'));

ALTER TABLE govt_jobs DROP CONSTRAINT IF EXISTS govt_jobs_review_status_check;
ALTER TABLE govt_jobs ADD  CONSTRAINT govt_jobs_review_status_check
  CHECK (review_status IN ('pending','approved','rejected'));

-- 4. Tighten public RLS so pending/unpublished rows are never exposed --------
--    Previous policy exposed any status='active' row; pending review rows would
--    also be active, so add review_status + published gates.
DROP POLICY IF EXISTS govt_public ON govt_jobs;
CREATE POLICY govt_public ON govt_jobs FOR SELECT
  USING (status = 'active' AND review_status = 'approved' AND published = TRUE);

-- 5. Backfill existing rows so current public visibility is preserved --------
UPDATE govt_jobs
   SET review_status = COALESCE(review_status, 'approved'),
       published     = COALESCE(published, TRUE),
       updated_at    = COALESCE(updated_at, NOW()),
       slug          = COALESCE(NULLIF(slug, ''),
                                lower(regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g')));

-- 6. Indexes for the new access paths ----------------------------------------
CREATE INDEX IF NOT EXISTS idx_govt_jobs_source ON govt_jobs(source_id);
CREATE INDEX IF NOT EXISTS idx_govt_jobs_review ON govt_jobs(review_status, published);
CREATE INDEX IF NOT EXISTS idx_govt_jobs_slug   ON govt_jobs(slug);

-- 7. Keep updated_at fresh on every change -----------------------------------
CREATE OR REPLACE FUNCTION set_govt_jobs_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_govt_jobs_updated_at ON govt_jobs;
CREATE TRIGGER trg_govt_jobs_updated_at
  BEFORE UPDATE ON govt_jobs
  FOR EACH ROW EXECUTE FUNCTION set_govt_jobs_updated_at();

COMMIT;
