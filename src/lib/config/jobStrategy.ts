/**
 * jobStrategy.ts — single source of truth for the hybrid job-data strategy.
 *
 * Three job types power the portal:
 *   LIVE_JOB     → real, currently active (APIs, employers, DB). Green badge.
 *   VERIFIED_JOB → manually verified opening. Blue badge.
 *   ARCHIVED_JOB → demo/reference vacancy. Gray badge, shown as "Position Filled".
 *                  Searchable & visible (UX + SEO) but NEVER presented as open.
 *
 * Long-term plan:
 *   Phase 1 → 1,000+ live, 7,000+ archived (current).
 *   Phase 2 → grow live jobs every month.
 *   Phase 3 → archived gradually replaced until the portal is mostly live.
 */
import type { JobStatus } from "@/types/job"

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
