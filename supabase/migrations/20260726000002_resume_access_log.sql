-- ============================================================================
-- resume_access_log — audit trail of every resume signed-URL grant (admin or
-- employer), so "who viewed this candidate's resume, and when" is always
-- answerable. Distinct from analytics_events (candidate-acquisition funnel
-- metrics) — this is a security/audit log, server-write-only.
--
-- ADDITIVE · IDEMPOTENT · REVERSIBLE.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.resume_access_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id        UUID        NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  accessed_by_user_id UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  accessor_role       TEXT        NOT NULL CHECK (accessor_role IN ('admin', 'employer')),
  employer_id         UUID        REFERENCES public.employers(id) ON DELETE SET NULL,
  application_id      UUID        REFERENCES public.applications(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resume_access_log_candidate ON public.resume_access_log(candidate_id);
CREATE INDEX IF NOT EXISTS idx_resume_access_log_employer  ON public.resume_access_log(employer_id);
CREATE INDEX IF NOT EXISTS idx_resume_access_log_created   ON public.resume_access_log(created_at);

-- Server-only writes via service role / server client; no anon/client access.
ALTER TABLE public.resume_access_log ENABLE ROW LEVEL SECURITY;

COMMIT;
