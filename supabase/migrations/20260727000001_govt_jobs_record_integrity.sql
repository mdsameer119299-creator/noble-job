-- ============================================================================
-- Phase 1 (SEO foundation) — govt_jobs record integrity
--
-- Adds the MINIMUM fields needed to (a) stop emitting JobPosting for results /
-- answer keys / admit cards, (b) stop inventing posting dates, and (c) give the
-- sitemap a real `lastmod`:
--
--   record_type          what kind of record the row is (see CHECK below)
--   source_published_at  when the SOURCE published it — NEVER fabricated; NULL
--                        until an adapter or an editor supplies the real date
--   content_changed_at   when NobleJob's PUBLIC content for the row last changed
--   verified_at          when the record was last confirmed against the source
--   verified_by          who/what confirmed it (admin user id, or 'ingestion:<adapter>')
--
-- Deliberately NOT added (equivalents already exist):
--   created_at  – row creation time (kept; used as the floor for content_changed_at)
--   updated_at  – bumped by trg_govt_jobs_updated_at on EVERY write, including the
--                 ingestion upsert that rewrites unchanged rows, so it is NOT a
--                 usable "content changed" signal — that is what content_changed_at is for
--   content_hash / source_id – already present (20260610000001); ingestion now
--                 COMPARES content_hash before writing.
--
-- ADDITIVE · IDEMPOTENT · REVERSIBLE (see the .down.sql). No row is deleted or
-- hidden. Not applied to production by this change — review, then apply with
-- `npm run db:apply`. The application code works both before and after this
-- migration (it retries without the new columns when they do not exist yet).
-- ============================================================================

BEGIN;

-- 1. Columns -----------------------------------------------------------------
ALTER TABLE govt_jobs
  ADD COLUMN IF NOT EXISTS record_type         TEXT,
  ADD COLUMN IF NOT EXISTS source_published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS content_changed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by         TEXT;

-- 2. record_type domain (NULL allowed: unmigrated writers; the app derives it) --
ALTER TABLE govt_jobs DROP CONSTRAINT IF EXISTS govt_jobs_record_type_check;
ALTER TABLE govt_jobs ADD  CONSTRAINT govt_jobs_record_type_check
  CHECK (record_type IS NULL OR record_type IN
    ('notification','admit_card','result','answer_key','cutoff','syllabus','previous_paper','other'));

-- 3. Backfill record_type from tab + title (mirrors src/lib/govt/recordType.ts) --
--    Only rows still NULL are touched. Only 'notification' may ever emit JobPosting;
--    anything uncertain falls to a non-notification type (fail closed).
UPDATE govt_jobs SET record_type = CASE
  WHEN tab = 'results'   THEN 'result'
  WHEN tab = 'admit'     THEN 'admit_card'
  WHEN tab = 'answer'    THEN 'answer_key'
  WHEN tab = 'syllabus'  THEN 'syllabus'
  WHEN title ~* '\manswer\s*keys?\M'                                  THEN 'answer_key'
  WHEN title ~* '\m(admit\s*card|hall\s*ticket|call\s*letter)\M'      THEN 'admit_card'
  WHEN title ~* '\mcut[\s-]?off\M'                                    THEN 'cutoff'
  WHEN title ~* '\m(result|merit\s*list|score\s*card|scorecard)\M'    THEN 'result'
  WHEN title ~* '\mprevious\s+(year\s+)?(question\s+)?papers?\M'      THEN 'previous_paper'
  WHEN title ~* '\msyllabus\M' AND title !~* '\m(recruitment|vacanc\w*|apply|notification)\M' THEN 'syllabus'
  WHEN tab IN ('latest','railway','banking','ssc','upsc','state','psu') THEN 'notification'
  ELSE 'other'
END
WHERE record_type IS NULL;

-- 4. content_changed_at floor ------------------------------------------------
--    We do not know when existing rows last changed. The row's own creation time
--    is a true lower bound (it never postdates a change), unlike NOW(), which
--    would tell crawlers every page changed today. source_published_at is
--    intentionally NOT backfilled — no fake source dates.
UPDATE govt_jobs SET content_changed_at = created_at WHERE content_changed_at IS NULL;

-- 5. Keep content_changed_at truthful for EVERY writer ----------------------------
--    Bump it only when a PUBLIC content column actually changes value. The
--    ingestion upsert rewrites unchanged rows; identical values do not bump it.
--    A writer that sets content_changed_at itself (e.g. ingestion) wins.
--    record_type / verified_* / updated_at are deliberately NOT public content.
CREATE OR REPLACE FUNCTION set_govt_jobs_content_changed_at() RETURNS trigger AS $$
BEGIN
  IF NEW.content_changed_at IS NOT DISTINCT FROM OLD.content_changed_at
     AND ROW(NEW.title, NEW.org, NEW.short, NEW.post, NEW.vacancies, NEW.qualification, NEW.age_range,
             NEW.fee, NEW.last_date, NEW.start_date, NEW.exam_date, NEW.salary, NEW.location, NEW.state,
             NEW.tab, NEW.status, NEW.notification_url, NEW.official_url, NEW.result_url, NEW.admit_url,
             NEW.answer_url, NEW.notification_pdf, NEW.apply_url, NEW.overview, NEW.eligibility,
             NEW.age_limit, NEW.salary_details, NEW.exam_pattern, NEW.syllabus_content, NEW.article,
             NEW.vacancy_breakup, NEW.fee_details, NEW.important_dates, NEW.faqs, NEW.selection_process,
             NEW.published, NEW.review_status)
        IS DISTINCT FROM
        ROW(OLD.title, OLD.org, OLD.short, OLD.post, OLD.vacancies, OLD.qualification, OLD.age_range,
             OLD.fee, OLD.last_date, OLD.start_date, OLD.exam_date, OLD.salary, OLD.location, OLD.state,
             OLD.tab, OLD.status, OLD.notification_url, OLD.official_url, OLD.result_url, OLD.admit_url,
             OLD.answer_url, OLD.notification_pdf, OLD.apply_url, OLD.overview, OLD.eligibility,
             OLD.age_limit, OLD.salary_details, OLD.exam_pattern, OLD.syllabus_content, OLD.article,
             OLD.vacancy_breakup, OLD.fee_details, OLD.important_dates, OLD.faqs, OLD.selection_process,
             OLD.published, OLD.review_status)
  THEN
    NEW.content_changed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_govt_jobs_content_changed ON govt_jobs;
CREATE TRIGGER trg_govt_jobs_content_changed
  BEFORE UPDATE ON govt_jobs
  FOR EACH ROW EXECUTE FUNCTION set_govt_jobs_content_changed_at();

-- New rows: default content_changed_at to creation time when the writer omits it.
CREATE OR REPLACE FUNCTION set_govt_jobs_content_changed_at_insert() RETURNS trigger AS $$
BEGIN
  IF NEW.content_changed_at IS NULL THEN NEW.content_changed_at := COALESCE(NEW.created_at, NOW()); END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_govt_jobs_content_changed_ins ON govt_jobs;
CREATE TRIGGER trg_govt_jobs_content_changed_ins
  BEFORE INSERT ON govt_jobs
  FOR EACH ROW EXECUTE FUNCTION set_govt_jobs_content_changed_at_insert();

-- 6. Index for the sitemap / freshness queries -------------------------------------
CREATE INDEX IF NOT EXISTS idx_govt_jobs_record_type ON govt_jobs(record_type);

COMMENT ON COLUMN govt_jobs.record_type         IS 'notification | admit_card | result | answer_key | cutoff | syllabus | previous_paper | other. Only notification may emit JobPosting.';
COMMENT ON COLUMN govt_jobs.source_published_at IS 'When the SOURCE published the notification. Never fabricated; NULL when unknown (then no JobPosting is emitted).';
COMMENT ON COLUMN govt_jobs.content_changed_at  IS 'When NobleJob''s public content last changed. Drives sitemap lastmod. NOT updated_at.';
COMMENT ON COLUMN govt_jobs.verified_at         IS 'When the record was last confirmed against the official source.';
COMMENT ON COLUMN govt_jobs.verified_by         IS 'Admin user id, or ingestion:<adapter>.';

COMMIT;
