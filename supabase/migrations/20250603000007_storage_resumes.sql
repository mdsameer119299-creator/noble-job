-- ==========================================================================
-- Migration 006: Private resume storage bucket + RLS on storage.objects
-- Run in Supabase SQL Editor after 001–005.
-- ==========================================================================

-- 1. Private bucket (never public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resumes',
  'resumes',
  false,
  5242880,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Candidate: own folder only ({candidate_id}/resume.*)
CREATE POLICY resumes_candidate_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'resumes'
    AND EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.user_id = auth.uid()
        AND c.id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY resumes_candidate_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'resumes'
    AND EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.user_id = auth.uid()
        AND c.id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY resumes_candidate_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'resumes'
    AND EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.user_id = auth.uid()
        AND c.id::text = (storage.foldername(name))[1]
    )
  )
  WITH CHECK (
    bucket_id = 'resumes'
    AND EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.user_id = auth.uid()
        AND c.id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY resumes_candidate_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'resumes'
    AND EXISTS (
      SELECT 1 FROM public.candidates c
      WHERE c.user_id = auth.uid()
        AND c.id::text = (storage.foldername(name))[1]
    )
  );

-- 3. Employer: read applicant resume only after application exists
CREATE POLICY resumes_employer_select_applicant ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'resumes'
    AND EXISTS (
      SELECT 1
      FROM public.applications a
      INNER JOIN public.employers e ON e.id = a.employer_id
      INNER JOIN public.candidates c ON c.id = a.candidate_id
      WHERE e.user_id = auth.uid()
        AND c.id::text = (storage.foldername(name))[1]
    )
  );

COMMENT ON POLICY resumes_candidate_select ON storage.objects IS
  'Candidates read/write only objects under their own candidate_id folder';
COMMENT ON POLICY resumes_employer_select_applicant ON storage.objects IS
  'Employers read resume objects only for candidates who applied to them';
