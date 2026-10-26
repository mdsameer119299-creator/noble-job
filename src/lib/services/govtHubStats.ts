/**
 * Govt hub stat counters — sourced from the database (active govt_jobs rows),
 * with the local seeded inventory as a fallback. No fabricated vacancy totals.
 */
import { sumRealVacancies, isVacancyBearingJob } from "@/lib/data/govtVacancies"
import { getActiveGovtRows } from "@/lib/services/govtStatsSource"
import { jobMatchesCategorySlug } from "@/lib/services/govtNavStats"
import { countStatesWithListings } from "@/lib/govt/hubCounts"
import { isCurrentGovtNotification } from "@/lib/govt/recordType"

export interface GovtHubStatItem {
  key: string
  icon: string
  num: number
  label: string
}

export async function getGovtHubStats(opts?: { slug?: string }): Promise<GovtHubStatItem[]> {
  // NOT `.filter(isCurrentGovtNotification)` directly — see govtJobLocal.ts's doc
  // comment (Array.filter's (element, index, array) collides with the predicate's
  // second `now` parameter and throws `now.getTime is not a function`).
  const all = (await getActiveGovtRows()).filter(j => isCurrentGovtNotification(j))
  const jobs = opts?.slug ? all.filter(j => jobMatchesCategorySlug(j, opts.slug!)) : all
  // Vacancies: real, parseable counts on recruitment tabs only (latest/upcoming).
  const vacancies = sumRealVacancies(jobs.filter(isVacancyBearingJob))
  const departments = new Set(jobs.map(j => j.org)).size

  return [
    // No total when a contributing figure is unsubstantiated (sumRealVacancies returns 0) — omitted, never "0 Vacancies".
    ...(vacancies > 0 ? [{ key: "vacancies", icon: "👥", num: vacancies, label: "Vacancies" }] : []),
    { key: "notifications", icon: "📋", num: jobs.length, label: "Notifications" },
    { key: "departments", icon: "🏛", num: departments, label: "Departments" },
    // States / UTs that have a state-specific notice in THIS pool — not the size of the state taxonomy.
    { key: "states", icon: "🗺️", num: countStatesWithListings(jobs), label: "States & UTs with Listings" },
  ]
}
