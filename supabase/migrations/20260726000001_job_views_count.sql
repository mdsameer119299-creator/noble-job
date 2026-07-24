-- ============================================================================
-- Add views_count to jobs, wfh_jobs and abroad_jobs so the employer dashboard
-- can show a real (not fabricated) view count per posting, plus a board-aware
-- increment function called from each job detail page.
--
-- ADDITIVE · IDEMPOTENT · REVERSIBLE · preserves all existing rows.
-- ============================================================================

BEGIN;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS views_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.wfh_jobs
  ADD COLUMN IF NOT EXISTS views_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.abroad_jobs
  ADD COLUMN IF NOT EXISTS views_count INTEGER NOT NULL DEFAULT 0;

-- Explicit per-board branches (no dynamic SQL / table-name injection surface).
CREATE OR REPLACE FUNCTION public.increment_job_views(p_board TEXT, p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_board = 'private' THEN
    UPDATE public.jobs SET views_count = views_count + 1 WHERE id = p_id;
  ELSIF p_board = 'wfh' THEN
    UPDATE public.wfh_jobs SET views_count = views_count + 1 WHERE id = p_id;
  ELSIF p_board = 'abroad' THEN
    UPDATE public.abroad_jobs SET views_count = views_count + 1 WHERE id = p_id;
  END IF;
END;
$$;

COMMIT;
