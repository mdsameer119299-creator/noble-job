-- ============================================================================
-- analytics_events — first-party funnel event sink (candidate acquisition).
--
-- Powers PR #20 (Candidate Acquisition Engine): resume_cta_opened,
-- resume_upload, resume_parsed, resume_score_generated, job_alert_subscribed,
-- first_application. The /api/events route writes here best-effort and no-ops
-- if this table is absent, so applying this migration is OPTIONAL for the app
-- to keep working — it only turns on persistence of the events.
--
-- ADDITIVE · IDEMPOTENT · REVERSIBLE. Not applied to production by this change.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event       TEXT        NOT NULL,
  props       JSONB       NOT NULL DEFAULT '{}',
  path        TEXT,
  session_id  TEXT,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_event    ON public.analytics_events(event);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created  ON public.analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session  ON public.analytics_events(session_id);

-- Server-only writes via service role / server client; no anon access.
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

COMMIT;
