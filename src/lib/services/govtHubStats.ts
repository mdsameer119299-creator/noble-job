/**
 * Lightweight govt hub stats (GOVT_JOBS only — no private/WFH inventory).
 */
import { GOVT_JOBS } from "@/lib/data/govtData"
import { sumGovtVacancies } from "@/lib/data/govtVacancies"
import { filterGovtJobsByCategory } from "@/lib/services/govtNavStats"

export interface GovtHubStatItem {
  key: string
  icon: string
  num: number
  label: string
}

export function getGovtHubStats(opts?: { slug?: string }): GovtHubStatItem[] {
  const jobs = opts?.slug ? filterGovtJobsByCategory(opts.slug) : GOVT_JOBS
  const vacancies = sumGovtVacancies(jobs)
  const vacDisplay = Math.max(vacancies, opts?.slug ? jobs.length * 400 : 25_000)

  return [
    { key: "vacancies", icon: "👥", num: vacDisplay, label: "Vacancies" },
    { key: "notifications", icon: "📋", num: Math.max(jobs.length, opts?.slug ? jobs.length : 120), label: "Notifications" },
    { key: "departments", icon: "🏛", num: opts?.slug ? Math.min(12, Math.max(4, Math.ceil(jobs.length / 3))) : 15, label: "Departments" },
    { key: "states", icon: "🗺️", num: 36, label: "States Covered" },
  ]
}
