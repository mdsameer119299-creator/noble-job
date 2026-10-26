/**
 * hubCounts.ts — government counters that describe the SAME inventory the government pages list.
 *
 * Two counters used to promise more than the page behind them showed:
 *   • the homepage "Government Jobs" card read "61,352 Roles to Explore" — a vacancy total summed over EVERY active row
 *     (stale and non-notification rows included), labelled as roles, while /jobs/govt itself listed the
 *     current notifications only (42,566 posts in 132 notices);
 *   • "36 States Covered" was `INDIAN_STATES.length` — the size of the state taxonomy, not a statement about any
 *     listing (the state grid on the same page has state-specific notices for only a handful of them).
 *
 * Both now come from the current-notification pool (`isCurrentGovtNotification`, the final gate of the real listings)
 * and are plain counts of what a candidate can open. Pure — no I/O — so the numbers are unit-testable.
 */
import { isCurrentGovtNotification } from "@/lib/govt/recordType"
import { jobMatchesCategorySlug } from "@/lib/services/govtNavStats"
import { INDIAN_STATES } from "@/lib/config/govtTaxonomy"
import { aggregateVacancies, sumRealVacancies, isVacancyBearingJob } from "@/lib/data/govtVacancies"
import type { GovtJob } from "@/types/govtJob"

/**
 * The rows the government listings actually show. The predicate is wrapped in an arrow function on purpose:
 * handing it straight to Array.filter would pass the element index as its second (`now`) argument.
 */
export function currentNotifications<T extends GovtJob>(rows: readonly T[]): T[] {
  return rows.filter(j => isCurrentGovtNotification(j))
}

/** Notifications a category card opens: current notifications of the category (all of them when no slug is given). */
export function notificationCountFor(rows: readonly GovtJob[], categorySlug?: string): number {
  const current = currentNotifications(rows)
  return categorySlug ? current.filter(j => jobMatchesCategorySlug(j, categorySlug)).length : current.length
}

/** States / UTs that have at least one state-specific current notification (national notices are not attributed to any state). */
export function countStatesWithListings(rows: readonly GovtJob[]): number {
  const known = new Set(INDIAN_STATES.map(s => s.slug))
  const seen = new Set<string>()
  for (const j of currentNotifications(rows)) if (j.stateSlug && known.has(j.stateSlug)) seen.add(j.stateSlug)
  return seen.size
}

/* ------------------------------------------------------------------ */
/* Vacancy aggregates — every rendered total goes through ONE gate      */
/* ------------------------------------------------------------------ */

export interface GovtHubStatItem {
  key: string
  icon: string
  num: number
  label: string
}

/**
 * The government hub / hero counters for a pool of rows (optionally one category). The vacancy total exists only when
 * every figure feeding it is affirmatively verified (see govtVacancies.ts); otherwise the item is OMITTED, never "0".
 * Notification, department and state counts do not depend on vacancy figures and are always present.
 */
export function buildGovtHubStats(rows: readonly GovtJob[], categorySlug?: string): GovtHubStatItem[] {
  const all = currentNotifications(rows)
  const jobs = categorySlug ? all.filter(j => jobMatchesCategorySlug(j, categorySlug)) : all
  const vacancies = sumRealVacancies(jobs.filter(isVacancyBearingJob))
  return [
    ...(vacancies > 0 ? [{ key: "vacancies", icon: "👥", num: vacancies, label: "Vacancies" }] : []),
    { key: "notifications", icon: "📋", num: jobs.length, label: "Notifications" },
    { key: "departments", icon: "🏛", num: new Set(jobs.map(j => j.org)).size, label: "Departments" },
    // States / UTs that have a state-specific notice in THIS pool — not the size of the state taxonomy.
    { key: "states", icon: "🗺️", num: countStatesWithListings(jobs), label: "States & UTs with Listings" },
  ]
}

/** Total shown in a listing hero for the (already filtered) list; 0 = withheld / none, and the hero omits it. */
export function listingVacanciesTotal(list: readonly GovtJob[]): number {
  return sumRealVacancies(list.filter(isVacancyBearingJob))
}

/** The public stats payload. `totalVacancies` is null — not 0 — when the total is withheld. */
export function buildGovtStats(source: readonly GovtJob[]) {
  return {
    totalVacancies: aggregateVacancies(source.filter(isVacancyBearingJob)),
    departments: new Set(source.map(j => j.org)).size,
    locations: new Set(source.map(j => j.location)).size,
    totalExams: source.length,
  }
}
