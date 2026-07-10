-- Rollback for 20260710000001_candidate_intelligence.sql
BEGIN;
DROP TABLE IF EXISTS public.candidate_activity;
ALTER TABLE public.candidates DROP CONSTRAINT IF EXISTS candidates_availability_status_check;
ALTER TABLE public.candidates
  DROP COLUMN IF EXISTS career_score,
  DROP COLUMN IF EXISTS career_score_updated_at,
  DROP COLUMN IF EXISTS availability_status;
COMMIT;
