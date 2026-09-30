-- Production readiness audit (2026-09-30): close a real RLS gap.
--
-- app_employer_update (20250603000006_rls_complete.sql), jobs_employer_write
-- and employer_own (20250603000002_rls_policies.sql) are all ROW-scoped only
-- (`USING (employer_id IN (own employers))` / `USING (auth.uid() = user_id)`),
-- with no WITH CHECK restricting which COLUMNS an employer's own session may
-- write. Every write path the Next.js API exposes goes through the correct
-- gate (stripProtectedJobFields / canEmployerTransition in
-- src/lib/services/jobLifecycle.ts; applications PATCH in
-- src/app/api/applications/[[...params]]/route.ts) — but nothing stops an
-- authenticated employer from bypassing the API entirely and calling
-- Supabase directly with their own session, e.g.:
--
--   supabase.from('applications').update({ admin_review_status: 'approved' }).eq('id', appId)
--   supabase.from('jobs').update({ status: 'active', is_verified: true }).eq('id', jobId)
--   supabase.from('employers').update({ verified: true }).eq('id', employerId)
--
-- The first two are CRITICAL: `admin_review_status` also gates resume access
-- (storage_resume_employer_applicant(), 20260929000002_application_admin_review_rls.sql)
-- and job visibility, so a self-approval directly unlocks a candidate's
-- resume with no admin action at all. The third lets an employer clear the
-- `verified` check that resume access separately requires.
--
-- Fix: freeze these specific moderation columns at the database layer for
-- any caller that is not the service-role connection (the Next.js admin API
-- — see supabaseAdmin in src/lib/supabase/admin.ts, used exclusively by
-- src/lib/services/adminService.ts) or an admin user (public.is_admin()).
-- This does NOT alter any existing RLS policy (all confirmed correctly
-- row-scoped) and does NOT touch any column an employer legitimately edits
-- (title, description, salary, application_deadline, etc.) — it only blocks
-- changes to the specific columns listed below, and only for a non-admin,
-- non-service-role UPDATE.
--
-- IMPORTANT: this could not be exercised against a live Supabase instance
-- from the audit environment (no database credentials available there).
-- Apply to a staging project first and run through the employer job-edit,
-- employer application-review, and admin-approval flows end-to-end before
-- applying to production.

CREATE OR REPLACE FUNCTION public.freeze_moderation_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  col text;
  protected_cols text[];
BEGIN
  -- auth.role() is Supabase's built-in function reading the request JWT's
  -- role claim; PostgREST sets it to 'service_role' for calls made with the
  -- Supabase service-role key (never exposed to the browser, used only by
  -- adminService.ts / cron routes), so this never blocks the admin API.
  IF auth.role() = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'applications' THEN
    protected_cols := ARRAY['admin_review_status', 'admin_reviewed_at', 'admin_reviewed_by'];
  ELSIF TG_TABLE_NAME = 'jobs' THEN
    protected_cols := ARRAY['status', 'job_status', 'is_verified', 'is_featured', 'provenance', 'board', 'employer_id'];
  ELSIF TG_TABLE_NAME = 'employers' THEN
    protected_cols := ARRAY['verified', 'status'];
  ELSE
    RETURN NEW;
  END IF;

  FOREACH col IN ARRAY protected_cols LOOP
    IF (to_jsonb(NEW) -> col) IS DISTINCT FROM (to_jsonb(OLD) -> col) THEN
      RAISE EXCEPTION 'column "%" on table "%" can only be changed by an admin or the service role', col, TG_TABLE_NAME
        USING ERRCODE = '42501'; -- insufficient_privilege
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.freeze_moderation_columns() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.freeze_moderation_columns() TO authenticated, service_role;

DROP TRIGGER IF EXISTS freeze_moderation_columns ON public.applications;
CREATE TRIGGER freeze_moderation_columns
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.freeze_moderation_columns();

DROP TRIGGER IF EXISTS freeze_moderation_columns ON public.jobs;
CREATE TRIGGER freeze_moderation_columns
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.freeze_moderation_columns();

DROP TRIGGER IF EXISTS freeze_moderation_columns ON public.employers;
CREATE TRIGGER freeze_moderation_columns
  BEFORE UPDATE ON public.employers
  FOR EACH ROW EXECUTE FUNCTION public.freeze_moderation_columns();
