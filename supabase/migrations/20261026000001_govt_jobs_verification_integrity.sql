-- ============================================================================
-- govt_jobs — make a verification impossible to forge, back-date or carry over an edit
--
-- FORWARD migration on top of 20260727000001_govt_jobs_record_integrity.sql (which is
-- already applied and is NOT edited). NOT applied to any database by this change: review,
-- then apply with the normal migration flow.
--
-- WHY. The site shows a vacancy total only when a stored figure is backed by a verification:
--   verified_by  = the administrator's auth.users.id,   verified_at = when they confirmed it,
--   and the figure was not changed afterwards:          content_changed_at < verified_at.
-- Migration 20260727000001 left three ways around that last condition:
--   1. its trigger stamped content_changed_at only when the writer left that column UNCHANGED, so a
--      writer that SUPPLIED a different value (older, or any value) bypassed the stamp, and could
--      move it backwards to make a stale verification look current again;
--   2. NOW() is transaction-stable, so a public edit and a verification written in the same
--      statement/transaction both carried the same instant, and an "equal timestamps" comparison
--      accepted them as verified;
--   3. nothing stopped one mutation from editing public content AND recording a verification.
--
-- THE FIX (all inside the existing BEFORE UPDATE / BEFORE INSERT triggers; no new column, no data change):
--   • content_changed_at is OWNED BY THE TRIGGER. On UPDATE the caller-supplied value is ignored:
--     if a public column changed it becomes clock_timestamp() — and is forced to be strictly later
--     than both the previous content_changed_at and any existing verified_at — otherwise it is
--     kept exactly as it was (it can never be moved backwards or forwards by a writer).
--   • A statement that edits public content cannot also set a verification (verified_by non-null with
--     a changed verified_by/verified_at): it fails with check_violation. The editor saves the edit, and the
--     verifier records the verification as a SEPARATE, later statement.
--   • Whenever a verification is recorded, verified_at is stamped from clock_timestamp(); the
--     caller-supplied verified_at is ignored, so it cannot be back-dated or forward-dated.
--   • A row cannot be INSERTed already verified (an ingested/created row always starts unverified).
--   Because clock_timestamp() advances inside a transaction, "edit then verify" yields
--   content_changed_at < verified_at and "verify then edit" yields verified_at < content_changed_at,
--   with no equal instants — and the application gate (data/govtVacancies.ts) additionally treats
--   equality as NOT verified.
--
-- "Public content" is exactly the column list migration 20260727000001 defined (unchanged here):
-- title, org, short, post, vacancies, qualification, age_range, fee, last_date, start_date, exam_date,
-- salary, location, state, tab, status, the *_url columns, notification_pdf, overview, eligibility,
-- age_limit, salary_details, exam_pattern, syllabus_content, article, vacancy_breakup, fee_details,
-- important_dates, faqs, selection_process, published, review_status.
-- verified_*, content_changed_at, updated_at, record_type and source_published_at are not content.
--
-- CONSEQUENCES worth knowing:
--   • The ingestion upsert still sends content_changed_at; it is now ignored in favour of the
--     database clock on a real change. A rewrite that changes NO public column (for example the
--     one-off write that establishes a missing content_hash) no longer moves content_changed_at.
--   • To RE-verify an already verified row, write a new verified_at (any value; it is replaced by the
--     database clock) together with verified_by. Writing identical values changes nothing.
--   • Un-verifying (verified_by = NULL) is allowed alongside an edit.
--   • Changing `published`, `status` or `review_status` is a content change and makes an earlier
--     verification stale: verify last.
--   • LIMITS: a database owner/superuser can still disable the triggers or set
--     session_replication_role = replica; a restore that loads rows with verified_* needs the triggers
--     disabled. Service-role application code is bound by the triggers like any other writer.
--
-- ADDITIVE in effect · IDEMPOTENT (CREATE OR REPLACE) · REVERSIBLE (see the .down.sql, which restores
-- the 20260727000001 function bodies). No row is read, changed or deleted.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION set_govt_jobs_content_changed_at() RETURNS trigger AS $$
DECLARE
  content_changed      boolean;
  verification_changed boolean;
BEGIN
  content_changed :=
    ROW(NEW.title, NEW.org, NEW.short, NEW.post, NEW.vacancies, NEW.qualification, NEW.age_range,
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
        OLD.published, OLD.review_status);

  -- A verification is being RECORDED: a verifier is named and the verifier or the time changed.
  verification_changed :=
    NEW.verified_by IS NOT NULL
    AND (NEW.verified_by IS DISTINCT FROM OLD.verified_by OR NEW.verified_at IS DISTINCT FROM OLD.verified_at);

  IF content_changed AND verification_changed THEN
    RAISE EXCEPTION 'govt_jobs %: public content and a verification cannot change in the same statement; save the edit first, then record the verification', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  IF content_changed THEN
    -- The caller-supplied content_changed_at is ignored. Strictly later than the previous stamp and
    -- than any verification, whatever the clocks say.
    NEW.content_changed_at := GREATEST(
      clock_timestamp(),
      COALESCE(OLD.content_changed_at, '-infinity'::timestamptz) + interval '1 microsecond',
      COALESCE(OLD.verified_at,        '-infinity'::timestamptz) + interval '1 microsecond');
  ELSE
    -- No public change: the stamp cannot be moved by a writer (a legacy NULL may still be filled in).
    NEW.content_changed_at := COALESCE(OLD.content_changed_at, NEW.content_changed_at, NEW.created_at);
  END IF;

  IF verification_changed THEN
    -- Recorded by the database clock; a supplied verified_at can be neither back-dated nor forward-dated.
    NEW.verified_at := clock_timestamp();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- New rows: default content_changed_at to creation time when the writer omits it, and never accept a row
-- that arrives already verified (verification is a separate, later act by an administrator).
CREATE OR REPLACE FUNCTION set_govt_jobs_content_changed_at_insert() RETURNS trigger AS $$
BEGIN
  IF NEW.verified_at IS NOT NULL OR NEW.verified_by IS NOT NULL THEN
    RAISE EXCEPTION 'govt_jobs %: a row cannot be created already verified; record the verification in a later statement', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.content_changed_at IS NULL THEN NEW.content_changed_at := COALESCE(NEW.created_at, NOW()); END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- The triggers themselves (trg_govt_jobs_content_changed / trg_govt_jobs_content_changed_ins) were created by
-- 20260727000001 and call these functions by name, so replacing the function bodies is the whole change.

COMMENT ON COLUMN govt_jobs.content_changed_at IS 'When NobleJob''s public content last changed. Maintained by trigger only (a caller-supplied value is ignored). Drives sitemap lastmod. NOT updated_at.';
COMMENT ON COLUMN govt_jobs.verified_at        IS 'When an administrator confirmed the record against the official source. Stamped from the database clock when verified_by is written.';
COMMENT ON COLUMN govt_jobs.verified_by        IS 'The confirming administrator''s auth.users.id (UUID), written by an admin-gated server route. A figure counts as verified only when content_changed_at < verified_at.';

COMMIT;
