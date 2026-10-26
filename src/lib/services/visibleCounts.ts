/**
 * visibleCounts.ts — every candidate-facing job COUNT, computed by the very same
 * pipeline that produces the job lists.
 *
 * NO EMPTY JOBS / count integrity: a counter must never describe more jobs than a
 * candidate can open. So each number here comes from the list services themselves
 * (`getJobs`, `getWfhJobsPaginated`, `getAbroadJobsPaginated`) which
 *   1. drop non-renderable records,
 *   2. honour the admin "synthetic jobs visible" switch and the data-source switch,
 *   3. and only THEN count and paginate.
 * A hero, stats strip, category card, country card or public stats endpoint that reads
 * from here can therefore never disagree with the list it links to — and never counts
 * a hidden sample listing when the switch hides them.
 *
 * Trust-worded counters ("live", "verified") are a different question: those are the
 * GENUINE counts (`genuineCounts.ts`: genuine + open + renderable, the same predicate the
 * sitemap uses). Sample listings are countable only as "roles to explore".
 *
 * Server-only.
 */
import { getJobs } from "@/lib/services/jobService"
import { getWfhJobsPaginated } from "@/lib/services/wfhJobService"
import { getAbroadJobsPaginated, getAbroadCountryCounts } from "@/lib/services/abroadJobService"
import { ABROAD_COUNTRY_TARGETS } from "@/lib/data/jobInventory"
import { withLiveListingCounts } from "@/lib/jobs/mergePrivateListing"
import type { JobFilter } from "@/types/job"
import type { WfhJobFilters } from "@/lib/services/wfhJobLocal"
import type { AbroadJobFilters } from "@/lib/services/abroadJobLocal"

export interface StatusCounts {
  all: number
  live: number
  verified: number
  archived: number
}

const ZERO: StatusCounts = { all: 0, live: 0, verified: 0, archived: 0 }

const sum = (...c: StatusCounts[]): StatusCounts => ({
  all: c.reduce((n, x) => n + x.all, 0),
  live: c.reduce((n, x) => n + x.live, 0),
  verified: c.reduce((n, x) => n + x.verified, 0),
  archived: c.reduce((n, x) => n + x.archived, 0),
})

/** Status counts of the private list a filter produces (what its tabs show). */
export async function getPrivateVisibleCounts(filter: JobFilter = {}): Promise<StatusCounts> {
  try {
    return (await getJobs({ ...filter, page: 1, limit: 1 })).counts ?? ZERO
  } catch {
    return ZERO
  }
}

/**
 * Status counts of the Private board exactly as its UNFILTERED list presents them: the employer-table
 * counts (`getPrivateVisibleCounts`) PLUS the live third-party jobs the list merges in on page 1
 * (`mergePrivateListing`, fed by the same `getHimalayasJobsForDisplay(100)` read the page uses).
 * Without the live part, the hero said "0 Roles to Explore" while the list showed those jobs.
 * A live-cache failure degrades to the employer counts only (as the page degrades to no live jobs).
 */
export async function getPrivateListingCounts(): Promise<StatusCounts> {
  const base = await getPrivateVisibleCounts()
  try {
    const { getHimalayasJobsForDisplay } = await import("@/lib/services/himalayasCache")
    return withLiveListingCounts(base, await getHimalayasJobsForDisplay(100))
  } catch {
    return base
  }
}

export async function getWfhVisibleCounts(filters: WfhJobFilters = {}): Promise<StatusCounts> {
  try {
    return (await getWfhJobsPaginated({ ...filters, page: 1, limit: 1 })).counts ?? ZERO
  } catch {
    return ZERO
  }
}

export async function getAbroadVisibleCounts(filters: AbroadJobFilters = {}): Promise<StatusCounts> {
  try {
    return (await getAbroadJobsPaginated({ ...filters, page: 1, limit: 1 })).counts ?? ZERO
  } catch {
    return ZERO
  }
}

export interface VisibleBoardCounts {
  private: StatusCounts
  wfh: StatusCounts
  abroad: StatusCounts
  /** private + wfh + abroad. */
  total: StatusCounts
}

/** Counts of the three job boards exactly as their lists show them. */
export async function getVisibleBoardCounts(): Promise<VisibleBoardCounts> {
  const [p, w, a] = await Promise.all([getPrivateListingCounts(), getWfhVisibleCounts(), getAbroadVisibleCounts()])
  return { private: p, wfh: w, abroad: a, total: sum(p, w, a) }
}

/**
 * Per-country counts for the abroad country cards: the size of the list each card opens
 * (`?country=`), never the marketing target when a country has no visible jobs.
 *
 * ONE shared, paginated read of the Abroad pool (`getAbroadCountryCounts`), not one full list query per
 * country: the stored rows come from the very loader `getAbroadJobsPaginated` uses — same active /
 * renderable / provenance / synthetic-visibility / source rules — and are narrowed per country in
 * memory with each source's own country filter. A read failure reports 0 for every card.
 */
export async function getVisibleAbroadCountryCounts() {
  const counts = await getAbroadCountryCounts(ABROAD_COUNTRY_TARGETS.map(c => c.country))
  return ABROAD_COUNTRY_TARGETS.map(c => ({ name: c.country, flag: c.flag, jobs: counts[c.country] ?? 0, desc: c.desc }))
}
