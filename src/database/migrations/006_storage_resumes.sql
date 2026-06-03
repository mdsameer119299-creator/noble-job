-- ==========================================================================
-- Migration 006: Private resume storage bucket + RLS on storage.objects
-- Hosted Supabase: policies require brief supabase_storage_admin grant to postgres.
-- ==========================================================================

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

-- Policies use SECURITY DEFINER helpers (see 008_storage_rls_helpers.sql) to avoid RLS recursion.
-- Fresh installs: run 008 after this file, or apply 008 alone on existing projects.
