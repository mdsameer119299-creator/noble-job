-- ==========================================================================
-- Migration 005: Triggers
-- Run after 004_functions.sql
-- ==========================================================================

-- Auto update updated_at on all tables that have the column
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updated_at'
      AND table_schema = 'public'
      AND table_name IN ('users','employers','candidates','jobs','applications','employer_settings','employer_plans','site_content','admin_settings')
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I;
      CREATE TRIGGER trg_%I_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    ', t, t, t, t);
  END LOOP;
END;
$$;

-- When a new user signs up via Supabase Auth → insert into public.users
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- When a new employer user is created → seed their employer profile
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

DROP TRIGGER IF EXISTS on_employer_user_created ON public.users;
CREATE TRIGGER on_employer_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_employer();

-- When a new candidate user is created → seed their candidate profile
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

DROP TRIGGER IF EXISTS on_candidate_user_created ON public.users;
CREATE TRIGGER on_candidate_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_candidate();

-- Recalculate candidate profile score when profile is updated
CREATE OR REPLACE FUNCTION recalculate_profile_score_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.profile_score := calculate_profile_score(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_candidates_profile_score ON candidates;
CREATE TRIGGER trg_candidates_profile_score
  BEFORE UPDATE ON candidates
  FOR EACH ROW
  WHEN (
    OLD.first_name IS DISTINCT FROM NEW.first_name OR
    OLD.last_name  IS DISTINCT FROM NEW.last_name  OR
    OLD.phone      IS DISTINCT FROM NEW.phone      OR
    OLD.resume_url IS DISTINCT FROM NEW.resume_url OR
    OLD.skills     IS DISTINCT FROM NEW.skills
  )
  EXECUTE FUNCTION recalculate_profile_score_trigger();

-- When an application status changes to 'hired' → create notification
CREATE OR REPLACE FUNCTION notify_on_hired()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE cand_user_id UUID;
BEGIN
  IF NEW.status = 'hired' AND OLD.status != 'hired' THEN
    SELECT u.id INTO cand_user_id FROM candidates c JOIN users u ON u.id = c.user_id WHERE c.id = NEW.candidate_id;
    IF cand_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message)
      VALUES (cand_user_id, 'hired', '🎉 Congratulations! You are hired!', 'The employer has marked your application as Hired. Check your messages for next steps.');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_application_hired_notify ON applications;
CREATE TRIGGER trg_application_hired_notify
  AFTER UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION notify_on_hired();
