-- ============================================================================
-- job_reports — candidate-submitted "Report Job" flags (fake/spam/expired/etc).
--
-- Written by POST /api/jobs/report via the service-role client; read by the
-- admin reports list. No anon access — server-only, matching analytics_events.
--
-- ADDITIVE · IDEMPOTENT · REVERSIBLE. Not applied to production by this change.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.job_reports (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  board            TEXT        NOT NULL,
  job_id           TEXT        NOT NULL,
  job_title        TEXT,
  reason           TEXT        NOT NULL,
  note             TEXT,
  reporter_user_id UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_reports_created ON public.job_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_job_reports_board_job ON public.job_reports(board, job_id);

-- Server-only writes/reads via service role; no anon access.
ALTER TABLE public.job_reports ENABLE ROW LEVEL SECURITY;

COMMIT;
