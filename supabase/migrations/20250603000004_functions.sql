-- ==========================================================================
-- Migration 004: Helper Functions & Views
-- Run after 003_indexes.sql
-- ==========================================================================

-- Auto-update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Full-text search function for jobs
CREATE OR REPLACE FUNCTION search_jobs(
  search_query TEXT DEFAULT '',
  p_category   TEXT DEFAULT '',
  p_location   TEXT DEFAULT '',
  p_type       TEXT DEFAULT '',
  p_sort       TEXT DEFAULT 'latest',
  p_page       INTEGER DEFAULT 1,
  p_limit      INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID, title TEXT, company TEXT, logo TEXT, color TEXT, location TEXT,
  salary_min INTEGER, salary_max INTEGER, job_type TEXT, experience_required TEXT,
  category TEXT, skills TEXT[], badge TEXT, apply_url TEXT, posted_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql AS $$
DECLARE
  offset_val INTEGER := (p_page - 1) * p_limit;
BEGIN
  RETURN QUERY
  SELECT
    j.id, j.title, j.company, j.logo, j.color, j.location,
    j.salary_min, j.salary_max, j.job_type, j.experience_required,
    j.category, j.skills, j.badge, j.apply_url, j.posted_at,
    COUNT(*) OVER() AS total_count
  FROM jobs j
  WHERE j.status = 'active'
    AND (search_query = '' OR to_tsvector('english', coalesce(j.title,'') || ' ' || coalesce(j.description,'') || ' ' || coalesce(j.company,'')) @@ plainto_tsquery('english', search_query))
    AND (p_category = '' OR j.category = p_category)
    AND (p_location = '' OR j.location ILIKE '%' || p_location || '%')
    AND (p_type = '' OR j.job_type = p_type)
  ORDER BY
    CASE WHEN p_sort = 'salary_high' THEN j.salary_max END DESC NULLS LAST,
    j.posted_at DESC
  LIMIT p_limit OFFSET offset_val;
END;
$$;

-- Get unread message count for a user
CREATE OR REPLACE FUNCTION get_unread_messages(p_user_id UUID)
RETURNS INTEGER LANGUAGE sql STABLE AS $$
  SELECT COUNT(*)::INTEGER FROM messages WHERE recipient_id = p_user_id AND NOT is_read;
$$;

-- Get profile completion score
CREATE OR REPLACE FUNCTION calculate_profile_score(p_candidate_id UUID)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  score INTEGER := 0;
  cand candidates%ROWTYPE;
  exp_count INTEGER;
  edu_count INTEGER;
BEGIN
  SELECT * INTO cand FROM candidates WHERE id = p_candidate_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF cand.first_name IS NOT NULL AND cand.first_name != '' THEN score := score + 10; END IF;
  IF cand.last_name  IS NOT NULL AND cand.last_name != ''  THEN score := score + 5;  END IF;
  IF cand.phone IS NOT NULL THEN score := score + 10; END IF;
  IF cand.city  IS NOT NULL THEN score := score + 5;  END IF;
  IF cand.experience_years IS NOT NULL THEN score := score + 10; END IF;
  IF cand.category IS NOT NULL THEN score := score + 10; END IF;
  IF cand.expected_salary IS NOT NULL THEN score := score + 5; END IF;
  IF array_length(cand.skills, 1) >= 3 THEN score := score + 15; END IF;
  IF cand.resume_url IS NOT NULL THEN score := score + 20; END IF;
  SELECT COUNT(*) INTO exp_count FROM candidate_experience WHERE candidate_id = p_candidate_id;
  IF exp_count > 0 THEN score := score + 5; END IF;
  SELECT COUNT(*) INTO edu_count FROM candidate_education WHERE candidate_id = p_candidate_id;
  IF edu_count > 0 THEN score := score + 5; END IF;
  RETURN LEAST(score, 100);
END;
$$;

-- Purge expired OTP tokens (run via cron)
CREATE OR REPLACE FUNCTION purge_expired_otps()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE deleted INTEGER;
BEGIN
  DELETE FROM otp_tokens WHERE expires_at < NOW() OR is_used = TRUE;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- Purge expired Himalayas cache entries
CREATE OR REPLACE FUNCTION purge_expired_himalayas_cache()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE deleted INTEGER;
BEGIN
  DELETE FROM himalayas_jobs_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
