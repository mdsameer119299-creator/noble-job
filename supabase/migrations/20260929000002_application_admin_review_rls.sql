-- Enforce the application-release gate at the database/RLS layer too.
-- Application submission remains candidate-owned; employer visibility starts only after admin approval.

DROP POLICY IF EXISTS app_employer ON public.applications;
CREATE POLICY app_employer ON public.applications
  FOR SELECT TO authenticated
  USING (
    admin_review_status IN ('approved','shared')
    AND employer_id IN (SELECT id FROM public.employers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS candidate_employer_applicant_select ON public.candidates;
CREATE POLICY candidate_employer_applicant_select ON public.candidates
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.applications a
      INNER JOIN public.employers e ON e.id = a.employer_id
      WHERE a.candidate_id = candidates.id
        AND a.admin_review_status IN ('approved','shared')
        AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS candidate_experience_select ON public.candidate_experience;
CREATE POLICY candidate_experience_select ON public.candidate_experience
  FOR SELECT TO authenticated
  USING (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.applications a
      INNER JOIN public.employers e ON e.id = a.employer_id
      WHERE a.candidate_id = candidate_experience.candidate_id
        AND a.admin_review_status IN ('approved','shared')
        AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS candidate_education_select ON public.candidate_education;
CREATE POLICY candidate_education_select ON public.candidate_education
  FOR SELECT TO authenticated
  USING (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.applications a
      INNER JOIN public.employers e ON e.id = a.employer_id
      WHERE a.candidate_id = candidate_education.candidate_id
        AND a.admin_review_status IN ('approved','shared')
        AND e.user_id = auth.uid()
    )
  );

-- Storage must enforce the same release gate. This prevents a direct storage request
-- from bypassing the application service's approval check.
CREATE OR REPLACE FUNCTION public.storage_resume_employer_applicant(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.applications a
    INNER JOIN public.employers e ON e.id = a.employer_id
    INNER JOIN public.candidates c ON c.id = a.candidate_id
    WHERE e.user_id = auth.uid()
      AND e.verified = true
      AND a.admin_review_status IN ('approved','shared')
      AND c.id::text = split_part(object_name, '/', 1)
  );
$$;
