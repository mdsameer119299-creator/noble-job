-- ============================================================================
-- auth_failures — audit log for authentication failures, rate-limit violations,
-- and account lockouts. Powers the persistent OTP/login lockout policy.
--
-- Service-role only: RLS enabled with NO policy, so the anon/authenticated keys
-- (candidate/employer UI) can never read or write it. Same pattern as ingest_runs.
--
-- ADDITIVE · IDEMPOTENT · REVERSIBLE · no impact on existing tables/data.
-- ============================================================================

CREATE TABLE IF NOT EXISTS auth_failures (
  id           BIGSERIAL   PRIMARY KEY,
  email        TEXT,
  user_id      UUID,
  ip           TEXT,
  user_agent   TEXT,
  failure_type TEXT        NOT NULL DEFAULT 'login'
               CHECK (failure_type IN ('login','otp_verify','password_reset','rate_limit','lockout')),
  is_lockout   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_failures_email_type_idx ON auth_failures(email, failure_type, created_at DESC);
CREATE INDEX IF NOT EXISTS auth_failures_ip_idx         ON auth_failures(ip, created_at DESC);
CREATE INDEX IF NOT EXISTS auth_failures_created_idx     ON auth_failures(created_at DESC);

ALTER TABLE auth_failures ENABLE ROW LEVEL SECURITY;  -- no public policy: service-role only
