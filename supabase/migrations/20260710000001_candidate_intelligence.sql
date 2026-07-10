-- ============================================================================
-- Candidate Intelligence Engine (PR #21) — persisted Career Score, availability
-- status, and an activity timeline.
--
--   candidates.career_score           → last computed resume/ATS score (0–100)
--   candidates.career_score_updated_at→ when it was last computed
--   candidates.availability_status    → self-declared status shown to recruiters
--   candidate_activity                → per-candidate event timeline
--
-- Extracted resume skills continue to use the existing candidates.skills column.
--
-- ADDITIVE · IDEMPOTENT · REVERSIBLE. The app reads defensively (SELECT * and
-- best-effort writes) so it keeps working whether or not this is applied; this
-- migration only turns on persistence. NOT applied to production by this change.
-- ============================================================================

BEGIN;

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS career_score            INTEGER,
  ADD COLUMN IF NOT EXISTS career_score_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS availability_status     TEXT;

-- Constraint added separately so re-runs never fail on an existing constraint.
ALTER TABLE public.candidates DROP CONSTRAINT IF EXISTS candidates_availability_status_check;
ALTER TABLE public.candidates ADD  CONSTRAINT candidates_availability_status_check
  CHECK (availability_status IS NULL OR availability_status IN
    ('available','looking','open','interviewing','hired','not_looking'));

CREATE TABLE IF NOT EXISTS public.candidate_activity (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID        NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL,
  title        TEXT        NOT NULL,
  meta         JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidate_activity_cand ON public.candidate_activity(candidate_id, created_at DESC);

ALTER TABLE public.candidate_activity ENABLE ROW LEVEL SECURITY;

-- A candidate may read AND append ONLY their own activity. No UPDATE/DELETE
-- policies exist, so rows are immutable and undeletable by candidates. Another
-- candidate can neither read nor write these rows (both policies are scoped to
-- auth.uid()'s own candidate row).
DROP POLICY IF EXISTS candidate_activity_select_own ON public.candidate_activity;
CREATE POLICY candidate_activity_select_own ON public.candidate_activity
  FOR SELECT TO authenticated USING (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS candidate_activity_insert_own ON public.candidate_activity;
CREATE POLICY candidate_activity_insert_own ON public.candidate_activity
  FOR INSERT TO authenticated WITH CHECK (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
  );

COMMIT;
