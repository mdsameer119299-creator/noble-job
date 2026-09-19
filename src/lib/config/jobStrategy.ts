/**
 * jobStrategy.ts — the OPENNESS axis of the hybrid job-data strategy.
 *
 * `jobStatus` answers only "is this role currently open?":
 *   LIVE_JOB     → open, currently active. Green badge.
 *   VERIFIED_JOB → open, manually verified opening. Blue badge.
 *   ARCHIVED_JOB → not open ("Position Filled"). Gray badge. Searchable/visible
 *                  for UX but NEVER presented as an open role.
 *
 * IMPORTANT: `jobStatus` is NOT a genuineness signal. Whether a row is a real
 * sourced opportunity or generated demo/showcase content is the separate
 * PROVENANCE axis (see src/lib/jobs/provenance.ts). A row may be LIVE_JOB and
 * still be SYNTHETIC — in which case it is populated for browsing but must never
 * be indexed, schema-bearing, counted as genuine, distributed, or badged
 * "Verified". A "VERIFIED_JOB" label alone does NOT confer verified trust;
 * `hasVerifiedTrust()` requires genuine provenance.
 *
 * Long-term plan:
 *   Phase 1 → seed the catalog with demo inventory + real govt ingestion.
 *   Phase 2 → grow genuine (employer/API/curated) live jobs every month.
 *   Phase 3 → synthetic catalog gradually replaced until the portal is mostly genuine.
 */
import type { JobStatus } from "@/types/job"
import { classifyProvenance, type Classifiable } from "@/lib/jobs/provenance"

export const JOB_STATUS_META: Record<
  JobStatus,
  { label: string; badgeColor: "green" | "blue" | "gray"; isActive: boolean; cta: string }
> = {
  LIVE_JOB: { label: "Live Job", badgeColor: "green", isActive: true, cta: "Apply Now" },
  VERIFIED_JOB: { label: "Verified", badgeColor: "blue", isActive: true, cta: "Apply Now" },
  ARCHIVED_JOB: { label: "Position Filled", badgeColor: "gray", isActive: false, cta: "View Details" },
}

/** Alternate label for archived listings. */
export const ARCHIVED_ALT_LABEL = "Archived Vacancy"

/**
 * Honest label for generated demo (SYNTHETIC) rows. Earlier revisions rotated
 * "Live Vacancy" / "Hiring Now" / "Recently Posted" so demo rows read exactly
 * like real open roles. That implied a confirmed vacancy the employer never
 * posted, so demo inventory is now labelled as what it is. The rows are NOT
 * deleted — they stay browsable local inventory, just not presented as live jobs.
 */
export const SAMPLE_LISTING_LABEL = "Sample listing"
export const UNVERIFIED_LISTING_LABEL = "Unverified listing"

/** Label for a generated open row. (`id` retained for call-site compatibility.) */
export function syntheticOpenLabel(_id?: string): string {
  return SAMPLE_LISTING_LABEL
}

/**
 * Label for any NON-genuine open row: SYNTHETIC → "Sample listing"; UNCLASSIFIED
 * (legacy/insufficient evidence — not proven demo, but not vouched for either)
 * → "Unverified listing".
 */
export function nonGenuineListingLabel(j: Classifiable): string {
  return classifyProvenance(j) === "SYNTHETIC" ? SAMPLE_LISTING_LABEL : UNVERIFIED_LISTING_LABEL
}

/** A status counts as an "active opening" only when not archived. */
export function isActiveStatus(status?: JobStatus): boolean {
  return status ? JOB_STATUS_META[status].isActive : true
}

/**
 * Current rollout phase. Drives the size of the generated archived inventory
 * and the homepage headline counters. Bump these as real inventory grows.
 */
export const JOB_STRATEGY_PHASE = {
  phase: 1 as 1 | 2 | 3,
  targets: {
    /** Private + WFH + Abroad total (excludes govt). */
    opportunities: 19_718,
    /** Active live openings across private, WFH, abroad. */
    liveJobs: 2_010,
    /** Verified employer accounts. */
    verifiedEmployers: 2500,
    /** Archived reference vacancies (private + WFH + abroad). */
    archivedJobs: 17_100,
  },
}

/** Format a counter like 8000 -> "8,000+". */
export function formatCounter(n: number): string {
  return `${n.toLocaleString("en-IN")}+`
}
