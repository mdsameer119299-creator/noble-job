-- ==========================================================================
-- Migration 007: Fix auth signup triggers (search_path + qualified tables)
-- Run after 005_triggers.sql on existing projects.
-- See: https://supabase.com/docs/guides/troubleshooting/dashboard-errors-when-managing-users-N1ls4A
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'candidate'),
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_employer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'employer' THEN
    INSERT INTO public.employers (user_id, company_name, designation)
    VALUES (
      NEW.id,
      COALESCE(
        (SELECT raw_user_meta_data->>'company_name' FROM auth.users WHERE id = NEW.id),
        'My Company'
      ),
      COALESCE(
        (SELECT raw_user_meta_data->>'designation' FROM auth.users WHERE id = NEW.id),
        ''
      )
    )
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.employer_plans (employer_id, plan_type, jobs_limit)
    SELECT e.id, 'free', 3
    FROM public.employers e
    WHERE e.user_id = NEW.id
    ON CONFLICT (employer_id) DO NOTHING;

    INSERT INTO public.employer_settings (employer_id)
    SELECT e.id
    FROM public.employers e
    WHERE e.user_id = NEW.id
    ON CONFLICT (employer_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_candidate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'candidate' THEN
    INSERT INTO public.candidates (user_id, first_name, last_name)
    VALUES (
      NEW.id,
      COALESCE(
        (SELECT raw_user_meta_data->>'first_name' FROM auth.users WHERE id = NEW.id),
        ''
      ),
      COALESCE(
        (SELECT raw_user_meta_data->>'last_name' FROM auth.users WHERE id = NEW.id),
        ''
      )
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
