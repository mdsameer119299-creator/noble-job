-- ==========================================================================
-- Migration 006_rls_complete: Complete Row Level Security (supplements 002)
-- Run after 001–005. Also run 006_storage_resumes.sql for private resumes.
-- ==========================================================================

-- Admin helper for policies
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- --------------------------------------------------------------------------
-- Enable RLS on tables not covered in 002
-- --------------------------------------------------------------------------
ALTER TABLE contact_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_tokens              ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_experience    ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_education     ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_tests             ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_test_results  ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_modules       ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_resources        ENABLE ROW LEVEL SECURITY;
ALTER TABLE employer_plans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE employer_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_content            ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings          ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- Replace incomplete policies from 002
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS notif_own ON notifications;
DROP POLICY IF EXISTS msg_own ON messages;

CREATE POLICY notif_select ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY notif_update ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY notif_insert ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.candidates c
      INNER JOIN public.applications a ON a.candidate_id = c.id
      INNER JOIN public.employers e ON e.id = a.employer_id
      WHERE c.user_id = notifications.user_id
        AND e.user_id = auth.uid()
    )
  );

CREATE POLICY msg_select ON messages
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid() OR public.is_admin());

CREATE POLICY msg_insert ON messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY msg_update ON messages
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid() OR sender_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid() OR sender_id = auth.uid());

-- Applications: writes
CREATE POLICY app_candidate_insert ON applications
  FOR INSERT TO authenticated
  WITH CHECK (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
  );

CREATE POLICY app_employer_update ON applications
  FOR UPDATE TO authenticated
  USING (
    employer_id IN (SELECT id FROM public.employers WHERE user_id = auth.uid())
  )
  WITH CHECK (
    employer_id IN (SELECT id FROM public.employers WHERE user_id = auth.uid())
  );

-- Candidates: employers may read applicants
CREATE POLICY candidate_employer_applicant_select ON candidates
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.applications a
      INNER JOIN public.employers e ON e.id = a.employer_id
      WHERE a.candidate_id = candidates.id AND e.user_id = auth.uid()
    )
  );

CREATE POLICY candidates_update_own ON candidates
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Himalayas cache: public read
CREATE POLICY himalayas_public_read ON himalayas_jobs_cache
  FOR SELECT USING (true);

-- --------------------------------------------------------------------------
-- saved_jobs
-- --------------------------------------------------------------------------
CREATE POLICY saved_jobs_select ON saved_jobs
  FOR SELECT TO authenticated
  USING (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
    OR public.is_admin()
  );

CREATE POLICY saved_jobs_insert ON saved_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
  );

CREATE POLICY saved_jobs_update ON saved_jobs
  FOR UPDATE TO authenticated
  USING (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
  )
  WITH CHECK (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
  );

CREATE POLICY saved_jobs_delete ON saved_jobs
  FOR DELETE TO authenticated
  USING (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
  );

-- --------------------------------------------------------------------------
-- bookmarks
-- --------------------------------------------------------------------------
CREATE POLICY bookmarks_select ON bookmarks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY bookmarks_insert ON bookmarks
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY bookmarks_delete ON bookmarks
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- --------------------------------------------------------------------------
-- job_alerts
-- --------------------------------------------------------------------------
CREATE POLICY job_alerts_select ON job_alerts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY job_alerts_insert ON job_alerts
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY job_alerts_insert_anon ON job_alerts
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

CREATE POLICY job_alerts_update ON job_alerts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- --------------------------------------------------------------------------
-- interviews
-- --------------------------------------------------------------------------
CREATE POLICY interviews_select ON interviews
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR employer_id IN (SELECT id FROM public.employers WHERE user_id = auth.uid())
    OR candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
  );

CREATE POLICY interviews_insert ON interviews
  FOR INSERT TO authenticated
  WITH CHECK (
    employer_id IN (SELECT id FROM public.employers WHERE user_id = auth.uid())
    OR public.is_admin()
  );

CREATE POLICY interviews_update ON interviews
  FOR UPDATE TO authenticated
  USING (
    employer_id IN (SELECT id FROM public.employers WHERE user_id = auth.uid())
    OR candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
    OR public.is_admin()
  )
  WITH CHECK (
    employer_id IN (SELECT id FROM public.employers WHERE user_id = auth.uid())
    OR public.is_admin()
  );

-- --------------------------------------------------------------------------
-- employer_settings
-- --------------------------------------------------------------------------
CREATE POLICY employer_settings_select ON employer_settings
  FOR SELECT TO authenticated
  USING (
    employer_id IN (SELECT id FROM public.employers WHERE user_id = auth.uid())
    OR public.is_admin()
  );

CREATE POLICY employer_settings_insert ON employer_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    employer_id IN (SELECT id FROM public.employers WHERE user_id = auth.uid())
    OR public.is_admin()
  );

CREATE POLICY employer_settings_update ON employer_settings
  FOR UPDATE TO authenticated
  USING (
    employer_id IN (SELECT id FROM public.employers WHERE user_id = auth.uid())
    OR public.is_admin()
  )
  WITH CHECK (
    employer_id IN (SELECT id FROM public.employers WHERE user_id = auth.uid())
    OR public.is_admin()
  );

-- --------------------------------------------------------------------------
-- employer_plans
-- --------------------------------------------------------------------------
CREATE POLICY employer_plans_select ON employer_plans
  FOR SELECT TO authenticated
  USING (
    employer_id IN (SELECT id FROM public.employers WHERE user_id = auth.uid())
    OR public.is_admin()
  );

CREATE POLICY employer_plans_admin_write ON employer_plans
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- --------------------------------------------------------------------------
-- candidate_experience
-- --------------------------------------------------------------------------
CREATE POLICY candidate_experience_select ON candidate_experience
  FOR SELECT TO authenticated
  USING (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.applications a
      INNER JOIN public.employers e ON e.id = a.employer_id
      WHERE a.candidate_id = candidate_experience.candidate_id AND e.user_id = auth.uid()
    )
  );

CREATE POLICY candidate_experience_write ON candidate_experience
  FOR ALL TO authenticated
  USING (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
  )
  WITH CHECK (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
  );

-- --------------------------------------------------------------------------
-- candidate_education
-- --------------------------------------------------------------------------
CREATE POLICY candidate_education_select ON candidate_education
  FOR SELECT TO authenticated
  USING (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.applications a
      INNER JOIN public.employers e ON e.id = a.employer_id
      WHERE a.candidate_id = candidate_education.candidate_id AND e.user_id = auth.uid()
    )
  );

CREATE POLICY candidate_education_write ON candidate_education
  FOR ALL TO authenticated
  USING (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
  )
  WITH CHECK (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
  );

-- --------------------------------------------------------------------------
-- ratings
-- --------------------------------------------------------------------------
CREATE POLICY ratings_insert ON ratings
  FOR INSERT TO authenticated, anon
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY ratings_select_own ON ratings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- --------------------------------------------------------------------------
-- site_content
-- --------------------------------------------------------------------------
CREATE POLICY site_content_public_read ON site_content
  FOR SELECT USING (true);

CREATE POLICY site_content_admin_write ON site_content
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- --------------------------------------------------------------------------
-- admin_settings (admin only)
-- --------------------------------------------------------------------------
CREATE POLICY admin_settings_admin ON admin_settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- --------------------------------------------------------------------------
-- contact_messages
-- --------------------------------------------------------------------------
CREATE POLICY contact_messages_insert ON contact_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY contact_messages_admin ON contact_messages
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- --------------------------------------------------------------------------
-- otp_tokens: RLS on, no policies — service role only
-- --------------------------------------------------------------------------

-- --------------------------------------------------------------------------
-- Public catalogue tables
-- --------------------------------------------------------------------------
CREATE POLICY skill_tests_public_read ON skill_tests
  FOR SELECT USING (true);

CREATE POLICY interview_modules_public_read ON interview_modules
  FOR SELECT USING (true);

CREATE POLICY career_resources_public_read ON career_resources
  FOR SELECT USING (true);

CREATE POLICY candidate_test_results_select ON candidate_test_results
  FOR SELECT TO authenticated
  USING (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
    OR public.is_admin()
  );

CREATE POLICY candidate_test_results_insert ON candidate_test_results
  FOR INSERT TO authenticated
  WITH CHECK (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
  );

CREATE POLICY candidate_test_results_update ON candidate_test_results
  FOR UPDATE TO authenticated
  USING (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
  )
  WITH CHECK (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
  );

-- --------------------------------------------------------------------------
-- Admin overrides on core tables
-- --------------------------------------------------------------------------
CREATE POLICY users_admin ON users
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY employers_admin ON employers
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY candidates_admin ON candidates
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY jobs_admin ON jobs
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY applications_admin ON applications
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- --------------------------------------------------------------------------
-- RLS verification RPC (service role / SQL editor)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_rls_audit()
RETURNS TABLE (
  table_name text,
  rls_enabled boolean,
  policy_count bigint,
  expected_min_policies int,
  test_result text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expectations jsonb := '{
    "users": 2,
    "employers": 2,
    "candidates": 4,
    "jobs": 3,
    "govt_jobs": 1,
    "wfh_jobs": 1,
    "abroad_jobs": 1,
    "himalayas_jobs_cache": 1,
    "applications": 5,
    "saved_jobs": 4,
    "bookmarks": 3,
    "job_alerts": 4,
    "messages": 3,
    "contact_messages": 2,
    "notifications": 3,
    "ratings": 2,
    "otp_tokens": 0,
    "interviews": 3,
    "candidate_experience": 2,
    "candidate_education": 2,
    "skill_tests": 1,
    "candidate_test_results": 3,
    "interview_modules": 1,
    "career_resources": 1,
    "employer_plans": 2,
    "employer_settings": 3,
    "site_content": 2,
    "admin_settings": 1
  }'::jsonb;
BEGIN
  RETURN QUERY
  SELECT
    c.relname::text AS table_name,
    c.relrowsecurity AS rls_enabled,
    (
      SELECT count(*)::bigint
      FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = c.relname
    ) AS policy_count,
    COALESCE((expectations ->> c.relname)::int, 1) AS expected_min_policies,
    CASE
      WHEN NOT c.relrowsecurity THEN 'FAIL: RLS disabled'
      WHEN c.relname = 'otp_tokens' AND (
        SELECT count(*) FROM pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = c.relname
      ) > 0 THEN 'FAIL: otp_tokens must have no policies'
      WHEN c.relname = 'otp_tokens' THEN 'PASS'
      WHEN (
        SELECT count(*) FROM pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = c.relname
      ) < COALESCE((expectations ->> c.relname)::int, 1) THEN 'FAIL: insufficient policies'
      ELSE 'PASS'
    END::text AS test_result
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname = ANY (ARRAY(
      SELECT jsonb_object_keys(expectations)
    ))
  ORDER BY c.relname;
END;
$$;

REVOKE ALL ON FUNCTION public.get_rls_audit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_rls_audit() TO service_role;
