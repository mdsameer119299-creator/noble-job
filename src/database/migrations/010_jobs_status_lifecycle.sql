-- Mirror of supabase/migrations/20260706000001_jobs_status_lifecycle.sql
-- Extends jobs.status to the full lifecycle: draft/pending/active/paused/rejected/closed/archived.
-- ADDITIVE · IDEMPOTENT · REVERSIBLE.
BEGIN;

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs ADD  CONSTRAINT jobs_status_check
  CHECK (status IN ('draft','pending','active','paused','rejected','closed','archived'));

COMMIT;
