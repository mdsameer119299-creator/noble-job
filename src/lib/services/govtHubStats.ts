/**
 * Govt hub stat counters — sourced from the database (active govt_jobs rows),
 * with the local seeded inventory as a fallback. No fabricated vacancy totals.
 */
import { sumRealVacancies, isVacancyBearingJob } from "@/lib/data/govtVacancies"
import { getActiveGovtRows } from "@/lib/services/govtStatsSource"
import { jobMatchesCategorySlug } from "@/lib/services/govtNavStats"
import { INDIAN_STATES } from "@/lib/config/govtTaxonomy"
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
    { key: "vacancies", icon: "👥", num: vacancies, label: "Vacancies" },
    { key: "notifications", icon: "📋", num: jobs.length, label: "Notifications" },
    { key: "departments", icon: "🏛", num: departments, label: "Departments" },
    { key: "states", icon: "🗺️", num: INDIAN_STATES.length, label: "States Covered" },
  ]
}
