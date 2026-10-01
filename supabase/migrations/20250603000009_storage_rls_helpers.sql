-- Break storage ↔ candidates RLS recursion via SECURITY DEFINER helpers.

CREATE OR REPLACE FUNCTION public.storage_resume_is_candidate_owner(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.user_id = auth.uid()
      AND c.id::text = split_part(object_name, '/', 1)
  );
$$;

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

REVOKE ALL ON FUNCTION public.storage_resume_is_candidate_owner(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.storage_resume_employer_applicant(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_resume_is_candidate_owner(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_resume_employer_applicant(text) TO authenticated;

DROP POLICY IF EXISTS resumes_candidate_select ON storage.objects;
DROP POLICY IF EXISTS resumes_candidate_insert ON storage.objects;
DROP POLICY IF EXISTS resumes_candidate_update ON storage.objects;
DROP POLICY IF EXISTS resumes_candidate_delete ON storage.objects;
DROP POLICY IF EXISTS resumes_employer_select_applicant ON storage.objects;

CREATE POLICY resumes_candidate_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'resumes' AND public.storage_resume_is_candidate_owner(name));

CREATE POLICY resumes_candidate_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resumes' AND public.storage_resume_is_candidate_owner(name));

CREATE POLICY resumes_candidate_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'resumes' AND public.storage_resume_is_candidate_owner(name))
  WITH CHECK (bucket_id = 'resumes' AND public.storage_resume_is_candidate_owner(name));

CREATE POLICY resumes_candidate_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'resumes' AND public.storage_resume_is_candidate_owner(name));

CREATE POLICY resumes_employer_select_applicant ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'resumes' AND public.storage_resume_employer_applicant(name));
