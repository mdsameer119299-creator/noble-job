-- Revert jobs.status to the original four-value CHECK. Any rows using the new
-- states are first mapped back to the closest legacy value so the constraint holds.
BEGIN;

UPDATE public.jobs SET status = 'pending' WHERE status = 'draft';
UPDATE public.jobs SET status = 'active'  WHERE status = 'paused';
UPDATE public.jobs SET status = 'closed'  WHERE status = 'archived';

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs ADD  CONSTRAINT jobs_status_check
  CHECK (status IN ('active','pending','rejected','closed'));

COMMIT;
