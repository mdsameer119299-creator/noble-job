/**
 * Local-only government job helpers (no Supabase imports).
 * Used by /api/govt-jobs when Supabase is off or JOB_DATA_SOURCE=local.
 */
import { GOVT_JOBS } from "@/lib/data/govtData"
import { sumGovtVacancies } from "@/lib/data/govtVacancies"
import { isGovtJobExpired } from "@/lib/utils/govtJobExpiry"
import type { GovtJob, GovtJobTab } from "@/types/govtJob"

const SECTOR_MATCHERS: Partial<Record<GovtJobTab, (j: GovtJob) => boolean>> = {
  railway: j => /rail|rrb|rrc|metro/i.test(`${j.org} ${j.title}`),
  banking: j => /bank|sbi|ibps|rbi|nabard/i.test(`${j.org} ${j.title}`),
  ssc: j => /\bssc\b/i.test(`${j.org} ${j.short}`),
  upsc: j => /\bupsc\b/i.test(`${j.org} ${j.short}`),
  state: j => j.state !== "All India",
  psu: j => /ongc|ntpc|bhel|gail|sail|iocl|psu|coal india/i.test(`${j.org} ${j.title}`),
}

export function getGovtJobsLocal(tab: GovtJobTab = "latest", state?: string, pool: GovtJob[] = GOVT_JOBS): GovtJob[] {
  const matcher = SECTOR_MATCHERS[tab]
  let list: GovtJob[]
  if (matcher) {
    list = pool.filter(matcher)
  } else if (tab === "latest") {
    list = pool.filter(
      j =>
        j.tab === "latest" ||
        j.tab === "upcoming" ||
        j.categoryTags?.includes("latest-notifications"),
    )
  } else if (tab === "syllabus" || tab === "scholarships") {
    list = []
  } else {
    list = pool.filter(j => j.tab === tab)
  }
  if (state && state !== "All India") {
    list = list.filter(j => j.state === state || j.location === state)
  }
  // Remove jobs whose application window has closed based on lastDate.
  // status === "expired" catches DB-flagged jobs; isGovtJobExpired catches
  // jobs whose date has passed but whose status column hasn't been updated yet.
  return list.filter(j => j.status !== "expired" && !isGovtJobExpired(j.lastDate))
}

export function getGovtJobByIdLocal(idOrSlug: string): GovtJob | null {
  return GOVT_JOBS.find(j => j.id === idOrSlug || j.slug === idOrSlug) ?? null
}

export function getGovtStatsLocal() {
  const source = GOVT_JOBS.filter(j => j.tab === "latest")
  const jobs = source.length ? source : GOVT_JOBS
  return {
    totalVacancies: sumGovtVacancies(jobs),
    departments: new Set(jobs.map(j => j.org)).size,
    locations: new Set(jobs.map(j => j.location)).size,
    totalExams: jobs.length,
  }
}
