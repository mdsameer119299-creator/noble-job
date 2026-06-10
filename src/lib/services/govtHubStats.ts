/**
 * Lightweight govt hub stats (GOVT_JOBS only — no private/WFH inventory).
 */
import { GOVT_JOBS } from "@/lib/data/govtData"
import { sumGovtVacancies, isVacancyBearingJob } from "@/lib/data/govtVacancies"
import { filterGovtJobsByCategory } from "@/lib/services/govtNavStats"
import { isActiveGovtJob } from "@/lib/utils/govtJobExpiry"
import { INDIAN_STATES } from "@/lib/config/govtTaxonomy"

export interface GovtHubStatItem {
  key: string
  icon: string
  num: number
  label: string
}

export function getGovtHubStats(opts?: { slug?: string }): GovtHubStatItem[] {
  // Statistics only ever reflect active (non-expired) notifications.
  const jobs = (opts?.slug ? filterGovtJobsByCategory(opts.slug) : GOVT_JOBS).filter(isActiveGovtJob)
  // Vacancies count only recruitment tabs (latest/upcoming); results/admit/
  // answer-key entries carry no open posts. Real sum only — no minimum floor.
  const vacancies = sumGovtVacancies(jobs.filter(isVacancyBearingJob))
  const departments = new Set(jobs.map(j => j.org)).size

  return [
    { key: "vacancies", icon: "👥", num: vacancies, label: "Vacancies" },
    { key: "notifications", icon: "📋", num: jobs.length, label: "Notifications" },
    { key: "departments", icon: "🏛", num: departments, label: "Departments" },
    { key: "states", icon: "🗺️", num: INDIAN_STATES.length, label: "States Covered" },
  ]
}
