-- SECURITY FIX — ALREADY APPLIED to production; recorded in the live migration history as
-- version 20261025102650 (`refix_storage_resume_employer_applicant`).
--
-- VERSION ALIGNMENT. This file was drafted as 20261025000001 and was applied under the
-- version 20261025102650. It now carries the live version so that the local migration list
-- and the live history agree and `supabase db push` has no unmatched version in either
-- direction. A read-only audit confirmed that the executable SQL recorded live is IDENTICAL
-- to the SQL below (comments and whitespace aside). Only this header and the filename were
-- changed; the SQL from `CREATE OR REPLACE FUNCTION` to the end of the file is byte-for-byte
-- what it was. Do NOT edit that SQL: it is applied.
--
-- The FINDING below describes the state BEFORE this migration was applied: "live",
-- "currently" and "today" refer to 2026-10-25, before the fix.
--
-- FINDING (2026-10-25, read-only audit — no data was written to reach this
-- conclusion, only SELECTs against pg_policies / pg_proc / the migration
-- history): the LIVE `public.storage_resume_employer_applicant(object_name)`
-- function — the Supabase Storage RLS check that decides whether an employer
-- can download a candidate's resume FILE from the private `resumes` bucket —
-- does NOT contain the `a.admin_review_status IN ('approved','shared')`
-- check. It currently reads:
--
--   SELECT EXISTS (
--     SELECT 1 FROM public.applications a
--     INNER JOIN public.employers e ON e.id = a.employer_id
--     INNER JOIN public.candidates c ON c.id = a.candidate_id
--     WHERE e.user_id = auth.uid()
--       AND c.id::text = split_part(object_name, '/', 1)
--   );
--
-- i.e. the ORIGINAL, pre-review-gate definition from
-- 20250603000009_storage_rls_helpers.sql. That means: today, in production,
-- an employer can download ANY candidate's resume FILE the moment that
-- candidate submits an application to one of their jobs — before a Noble Job
-- admin has reviewed or approved anything. This is a direct violation of the
-- "applications and resumes must be stored securely... employer access must
-- be a separate, explicitly disclosed, consented feature" requirement, and it
-- is exploitable with a direct Supabase Storage REST call (the authenticated
-- anon/public key ships in the client bundle) — it does not require going
-- through any Noble Job UI or API route, so hiding the employer-side resume
-- download button in the frontend would not close it.
--
-- This is NOT a new design: 20260929000002_application_admin_review_rls.sql
-- already contains the exact correct replacement below (it adds both the
-- `admin_review_status` check AND `e.verified = true`), and
-- 20260930000003_freeze_moderation_columns.sql's own comment calls this gate
-- "CRITICAL" for exactly this reason. The migration-history table on this
-- project lists `20260929000002` as applied, but the function's LIVE
-- definition does not match that file's content — most likely the file was
-- edited after that version was recorded as applied (Supabase's migration
-- tracking is by filename/version, not by a hash of the file's current
-- contents, so an edit after the fact is silently never re-run). Whatever the
-- exact cause, simply re-running `20260929000002` will be a no-op (its
-- version is already marked applied), so this fix is issued under a fresh
-- version so it actually executes.
--
-- This migration changes ONLY `storage_resume_employer_applicant`'s body; it
-- adds no new table, column, or policy, and does not touch
-- `candidate_visible_to_employer` (the equivalent gate for the `candidates`
-- table), which IS correctly live today with the same check — this fix makes
-- the two consistent.

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

REVOKE ALL ON FUNCTION public.storage_resume_employer_applicant(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_resume_employer_applicant(text) TO authenticated;
