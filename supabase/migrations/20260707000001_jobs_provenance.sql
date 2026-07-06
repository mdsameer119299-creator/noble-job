-- ============================================================================
-- Add jobs.provenance — the PROVENANCE axis, orthogonal to job_status.
--
-- job_status answers "is this role open?" (LIVE/VERIFIED/ARCHIVED). provenance
-- answers "is this a real sourced opportunity, or generated demo content?":
--
--   EMPLOYER   → posted by a verified employer via the portal
--   AGGREGATED → pulled from a real external API (e.g. Himalayas)
--   CURATED    → a real opening entered by an admin with a real source
--   OFFICIAL   → a government notification (govt tables; not this table)
--   SYNTHETIC  → generated demo/showcase content (lives in code inventory, not
--                the DB) — populates browsing but is NEVER genuine/indexable.
--
-- The application classifier (src/lib/jobs/provenance.ts) is the runtime source
-- of truth and falls back to inference; this column persists the decision so
-- reads are gate-ready and the publication gate never treats a DB row as
-- synthetic by accident.
--
-- ADDITIVE · IDEMPOTENT · REVERSIBLE · preserves all existing rows · no URLs change.
-- ============================================================================

BEGIN;

-- Add the column WITHOUT a default first so existing rows stay NULL and can be
-- classified by the backfill below (adding it WITH a default would stamp every
-- existing row identically and defeat the backfill).
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS provenance TEXT;

-- Backfill only unclassified rows (idempotent: re-runs match nothing because
-- new rows receive the default set below and any admin-set value is preserved).
--   • employer-owned rows      → EMPLOYER
--   • rows sourced from an API → AGGREGATED (source names the aggregator)
--   • everything else          → CURATED (admin-entered real openings)
-- DB rows are genuine by construction, so nothing is backfilled to SYNTHETIC.
UPDATE jobs
   SET provenance = CASE
     WHEN employer_id IS NOT NULL THEN 'EMPLOYER'
     WHEN source ILIKE '%himalayas%' OR source ILIKE '%api%' OR source ILIKE '%aggregat%' THEN 'AGGREGATED'
     ELSE 'CURATED'
   END
 WHERE provenance IS NULL;

-- Default for future inserts. Employer-submitted jobs are the common insert path.
ALTER TABLE jobs ALTER COLUMN provenance SET DEFAULT 'EMPLOYER';

-- Constraint added separately so re-runs never fail on an existing constraint.
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_provenance_check;
ALTER TABLE jobs ADD  CONSTRAINT jobs_provenance_check
  CHECK (provenance IN ('EMPLOYER','AGGREGATED','CURATED','OFFICIAL','SYNTHETIC'));

CREATE INDEX IF NOT EXISTS idx_jobs_provenance ON jobs(provenance);

COMMIT;
