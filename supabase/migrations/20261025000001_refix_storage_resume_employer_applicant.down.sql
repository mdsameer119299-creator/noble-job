-- Reverts storage_resume_employer_applicant to the version currently live in
-- production (no admin_review_status / verified check). Provided for
-- completeness only — there is no good reason to run this; it reopens the
-- resume-exposure gap the .sql migration closes.

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
      AND c.id::text = split_part(object_name, '/', 1)
  );
$$;

REVOKE ALL ON FUNCTION public.storage_resume_employer_applicant(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_resume_employer_applicant(text) TO authenticated;
