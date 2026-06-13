-- ============================================================================
-- ingest_runs — monitoring/audit log for the government-job ingestion engine.
-- One row per run (and optionally per source). Service-role only (no public RLS).
--
-- Mirror of supabase/migrations/20260611000001_ingest_runs.sql, placed here so the
-- repo's apply tooling (scripts/apply-migration.mjs) can install it directly:
--   node scripts/apply-migration.mjs 009_ingest_runs.sql
-- Idempotent (CREATE ... IF NOT EXISTS) — safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ingest_runs (
  id          BIGSERIAL   PRIMARY KEY,
  source_id   TEXT        NOT NULL DEFAULT 'all',
  trigger     TEXT        NOT NULL DEFAULT 'cron'    CHECK (trigger IN ('cron','manual','dry-run')),
  status      TEXT        NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','partial','error')),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  fetched     INTEGER     NOT NULL DEFAULT 0,
  inserted    INTEGER     NOT NULL DEFAULT 0,
  updated     INTEGER     NOT NULL DEFAULT 0,
  skipped     INTEGER     NOT NULL DEFAULT 0,
  expired     INTEGER     NOT NULL DEFAULT 0,
  error       TEXT
);

CREATE INDEX IF NOT EXISTS ingest_runs_source_idx ON ingest_runs(source_id, started_at DESC);
CREATE INDEX IF NOT EXISTS ingest_runs_started_idx ON ingest_runs(started_at DESC);

ALTER TABLE ingest_runs ENABLE ROW LEVEL SECURITY;  -- no public policy: service-role only
