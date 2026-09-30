-- ============================================================================
-- Phase 2 (strategy/internal-applications-admin-gate) — WFH sourced-inventory
-- columns needed to represent genuine AGGREGATED remote jobs honestly.
--
--   source              free-text attribution of where a sourced row came from
--                       (e.g. "Himalayas"). Mirrors public.jobs.source, which
--                       already carries this for the private board. NULL for
--                       employer-authored rows (they need no source label).
--                       `classifyProvenance()` (src/lib/jobs/provenance.ts)
--                       already treats any source containing "himalayas" as a
--                       trusted aggregator once a real apply_url is present —
--                       this column is what makes that evidence honest and
--                       queryable instead of inferred from nothing.
--
--   applicant_country   the country a fully-remote role is explicitly open to
--                       (ISO alpha-2 or name), ONLY when the source record
--                       itself states one. NULL = unknown/unstated. Never
--                       defaulted or inferred from board membership — a WFH
--                       row with no stated country gets no JobPosting
--                       `applicantLocationRequirements` (see
--                       resolveApplicantCountry in src/lib/seo/jobPostingRules.ts
--                       and buildWfhJobPosting in src/lib/seo/jobPostingBuilders.ts,
--                       both unchanged by this migration — they already read
--                       this exact column name from src/types/wfhJob.ts, which
--                       had no backing column until now).
--
-- ADDITIVE · IDEMPOTENT · REVERSIBLE.
-- ============================================================================

BEGIN;

ALTER TABLE public.wfh_jobs ADD COLUMN IF NOT EXISTS source             TEXT;
ALTER TABLE public.wfh_jobs ADD COLUMN IF NOT EXISTS applicant_country  TEXT;

COMMENT ON COLUMN public.wfh_jobs.source
  IS 'Free-text attribution for a sourced/aggregated row (e.g. "Himalayas"). NULL for employer-authored rows. classifyProvenance() reads this to recognize trusted aggregators.';
COMMENT ON COLUMN public.wfh_jobs.applicant_country
  IS 'Country a fully-remote role is explicitly open to, ONLY when the source states one (ISO alpha-2 or name). NULL = unknown — never defaulted. No JobPosting applicantLocationRequirements without it.';

CREATE INDEX IF NOT EXISTS idx_wfh_jobs_source ON public.wfh_jobs(source);

COMMIT;
