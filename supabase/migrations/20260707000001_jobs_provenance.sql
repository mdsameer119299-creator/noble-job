-- ============================================================================
-- Add jobs.provenance — the PROVENANCE axis, orthogonal to job_status.
--
-- job_status answers "is this role open?" (LIVE/VERIFIED/ARCHIVED). provenance
-- answers "is this a real sourced opportunity, or something we cannot vouch
-- for?":
--
--   EMPLOYER     → posted by an owning employer via the portal
--   AGGREGATED   → pulled from a recognized trusted API + real apply URL
--   CURATED      → admin-entered with explicit source evidence + real apply URL
--   OFFICIAL     → government notification (govt tables; not this table)
--   SYNTHETIC    → generated demo/showcase content (lives in code, not the DB)
--   UNCLASSIFIED → unknown / legacy / insufficient evidence (NON-genuine)
--
-- FAIL CLOSED. Genuineness must be EARNED with evidence; anything we cannot
-- positively justify becomes UNCLASSIFIED and is treated exactly like synthetic
-- (non-genuine, non-indexable, non-schema-eligible, non-distributable). The
-- runtime classifier (src/lib/jobs/provenance.ts) is the source of truth and
-- mirrors these same rules.
--
-- ADDITIVE · IDEMPOTENT · REVERSIBLE · preserves all existing rows · no URLs change.
-- NOTE: Not applied to production by this change. Run the read-only audit first:
--   tsx scripts/audit-jobs-provenance.ts
-- ============================================================================

BEGIN;

-- Add the column WITHOUT a default first so existing rows stay NULL and are
-- classified by the evidence-gated backfill below.
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS provenance TEXT;

-- Backfill only unclassified rows, FAIL CLOSED. A row becomes genuine ONLY with
-- positive evidence; everything else becomes UNCLASSIFIED (never assumed
-- genuine merely because a column is absent):
--   • EMPLOYER    → trusted employer ownership (employer_id) AND verification
--                   evidence (is_verified = true)
--   • AGGREGATED  → recognized trusted source identifier AND a real http(s)
--                   apply URL (not a '#'/example.* placeholder)
--   • CURATED     → explicit editorial/source evidence AND a real apply URL
--   • else        → UNCLASSIFIED
UPDATE jobs
   SET provenance = CASE
     WHEN employer_id IS NOT NULL AND is_verified IS TRUE
       THEN 'EMPLOYER'
     WHEN source ILIKE '%himalayas%'
          AND apply_url IS NOT NULL
          AND apply_url ~* '^https?://'
          AND apply_url !~* '(^|//|\.)example\.(com|org|net)([/:?#]|$)'
       THEN 'AGGREGATED'
     WHEN (source ILIKE '%curated%' OR source ILIKE '%editorial%')
          AND apply_url IS NOT NULL
          AND apply_url ~* '^https?://'
          AND apply_url !~* '(^|//|\.)example\.(com|org|net)([/:?#]|$)'
       THEN 'CURATED'
     ELSE 'UNCLASSIFIED'
   END
 WHERE provenance IS NULL;

-- Default for FUTURE inserts is UNCLASSIFIED — a new row must NOT become genuine
-- merely because the insert path omitted provenance. Write paths assign a
-- genuine value explicitly where justified (see the employer/admin API routes).
ALTER TABLE jobs ALTER COLUMN provenance SET DEFAULT 'UNCLASSIFIED';

-- Constraint added separately so re-runs never fail on an existing constraint.
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_provenance_check;
ALTER TABLE jobs ADD  CONSTRAINT jobs_provenance_check
  CHECK (provenance IN ('EMPLOYER','AGGREGATED','CURATED','OFFICIAL','SYNTHETIC','UNCLASSIFIED'));

CREATE INDEX IF NOT EXISTS idx_jobs_provenance ON jobs(provenance);

COMMIT;
