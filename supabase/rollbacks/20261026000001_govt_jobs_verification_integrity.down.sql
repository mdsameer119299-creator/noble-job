-- Rollback for 20261026000001_govt_jobs_verification_integrity.sql
-- Restores the function bodies and column comments exactly as 20260727000001_govt_jobs_record_integrity.sql defined
-- them (the triggers stay attached; that earlier migration is untouched and still owns them).
BEGIN;

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

CREATE OR REPLACE FUNCTION set_govt_jobs_content_changed_at_insert() RETURNS trigger AS $$
BEGIN
  IF NEW.content_changed_at IS NULL THEN NEW.content_changed_at := COALESCE(NEW.created_at, NOW()); END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN govt_jobs.content_changed_at IS 'When NobleJob''s public content last changed. Drives sitemap lastmod. NOT updated_at.';
COMMENT ON COLUMN govt_jobs.verified_at        IS 'When the record was last confirmed against the official source.';
COMMENT ON COLUMN govt_jobs.verified_by        IS 'Admin user id, or ingestion:<adapter>.';

COMMIT;
