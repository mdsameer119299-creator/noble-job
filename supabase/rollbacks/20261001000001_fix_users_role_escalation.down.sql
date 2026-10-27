-- Reverts 20261001000001_fix_users_role_escalation.sql.
--
-- WARNING: running this reopens the privilege-escalation hole it fixed
-- (any authenticated user would again be able to self-promote to
-- role='admin'). Provided for completeness / rollback symmetry only —
-- there is no good reason to run this against a real deployment.

DROP TRIGGER IF EXISTS freeze_moderation_columns ON public.users;

-- Restore freeze_moderation_columns() to its pre-fix body (no 'users' branch).
CREATE OR REPLACE FUNCTION public.freeze_moderation_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  col text;
  protected_cols text[];
BEGIN
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
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS users_select_own ON public.users;

CREATE POLICY users_own ON public.users
  USING (auth.uid() = id);
