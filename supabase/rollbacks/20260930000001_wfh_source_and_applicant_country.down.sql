-- Reverts 20260930000001_wfh_source_and_applicant_country.sql. Drops only what it added.
BEGIN;

DROP INDEX IF EXISTS public.idx_wfh_jobs_source;
ALTER TABLE public.wfh_jobs DROP COLUMN IF EXISTS applicant_country;
ALTER TABLE public.wfh_jobs DROP COLUMN IF EXISTS source;

COMMIT;
