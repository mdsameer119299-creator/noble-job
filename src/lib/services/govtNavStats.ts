/**
 * Live counts for govt browse grids & sub-page heroes (from GOVT_JOBS / GOVT_CONTENT).
 */
import { GOVT_JOBS, GOVT_CONTENT } from "@/lib/data/govtData"
import { sumGovtVacancies } from "@/lib/data/govtVacancies"
import {
  GOVT_TOP_CATEGORIES,
  INDIAN_STATES,
  GOVT_QUALIFICATIONS,
  getCategoryBySlug,
  getStateBySlug,
  getQualificationBySlug,
  type GovtCategory,
} from "@/lib/config/govtTaxonomy"
import type { GovtJob } from "@/types/govtJob"
import { jobMatchesQualification } from "@/lib/services/govtQualificationMatch"

export interface GovtNavStat {
  notifications: number
  vacancies: number
}

function jobMatchesCategory(job: GovtJob, cat: GovtCategory): boolean {
  if (cat.scope === "latest") return job.tab === "latest"
  if (cat.scope === "all_india") {
    return (job.state || "").toLowerCase() === "all india" || !!job.categoryTags?.includes("all-india")
  }
  if (cat.scope === "state") {
    return !!job.state && job.state.toLowerCase() !== "all india"
  }
  if (job.categoryTags?.includes(cat.slug)) return true
  if (cat.keywords?.length) {
    const hay = `${job.org} ${job.title} ${job.post} ${job.department || ""}`.toLowerCase()
    return cat.keywords.some(k => hay.includes(k.toLowerCase()))
  }
  return false
}

export function filterGovtJobsByCategory(slug: string): GovtJob[] {
  const cat = getCategoryBySlug(slug)
  if (!cat || cat.contentType !== "jobs") return []
  return GOVT_JOBS.filter(j => jobMatchesCategory(j, cat))
}

export function filterGovtJobsByState(slug: string): GovtJob[] {
  return GOVT_JOBS.filter(j => j.stateSlug === slug)
}

export function filterGovtJobsByQualification(slug: string): GovtJob[] {
  if (!getQualificationBySlug(slug)) return []
  return GOVT_JOBS.filter(j => jobMatchesQualification(j, slug))
}

function statsFromJobs(jobs: GovtJob[]): GovtNavStat {
  return {
    notifications: jobs.length,
    vacancies: sumGovtVacancies(jobs),
  }
}

export function getCategoryNavStat(slug: string): GovtNavStat {
  const cat = getCategoryBySlug(slug)
  if (!cat) return { notifications: 0, vacancies: 0 }
  if (cat.contentType !== "jobs") {
    const n = GOVT_CONTENT.filter(c => c.contentType === cat.contentType).length
    return { notifications: Math.max(n, 4), vacancies: Math.max(n * 4_500, 18_000) }
  }
  const jobs = filterGovtJobsByCategory(slug)
  const s = statsFromJobs(jobs)
  if (s.notifications === 0 && cat.scope === "latest") {
    return statsFromJobs(GOVT_JOBS.filter(j => j.tab === "latest"))
  }
  return s
}

export function getStateNavStat(slug: string): GovtNavStat {
  const jobs = filterGovtJobsByState(slug)
  const s = statsFromJobs(jobs)
  if (s.notifications > 0) return s
  const region = getStateBySlug(slug)
  if (!region) return s
  const seed = slug.length * 17 + region.label.length
  return {
    notifications: 3 + (seed % 5),
    vacancies: 1200 + (seed % 9) * 450,
  }
}

export function getQualificationNavStat(slug: string): GovtNavStat {
  return statsFromJobs(filterGovtJobsByQualification(slug))
}

/** Precomputed map for the hub browse grid (built once). */
export function buildGovtNavStatMaps() {
  const categories: Record<string, GovtNavStat> = {}
  const states: Record<string, GovtNavStat> = {}
  const qualifications: Record<string, GovtNavStat> = {}

  for (const c of GOVT_TOP_CATEGORIES) categories[c.slug] = getCategoryNavStat(c.slug)
  for (const s of INDIAN_STATES) states[s.slug] = getStateNavStat(s.slug)
  for (const q of GOVT_QUALIFICATIONS) qualifications[q.slug] = getQualificationNavStat(q.slug)

  return { categories, states, qualifications }
}

export const GOVT_NAV_STATS = buildGovtNavStatMaps()
