/**
 * Live counts for govt browse grids & sub-page heroes (from GOVT_JOBS / GOVT_CONTENT).
 */
import { GOVT_JOBS, GOVT_CONTENT } from "@/lib/data/govtData"
import { sumGovtVacancies, sumRealVacancies, isVacancyBearingJob } from "@/lib/data/govtVacancies"
import { isActiveGovtJob } from "@/lib/utils/govtJobExpiry"
import { getActiveGovtRows } from "@/lib/services/govtStatsSource"
import {
  GOVT_TOP_CATEGORIES,
  INDIAN_STATES,
  GOVT_QUALIFICATIONS,
  getCategoryBySlug,
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
  // Count active notifications only; sum vacancies for recruitment tabs only.
  const active = jobs.filter(isActiveGovtJob)
  return {
    notifications: active.length,
    vacancies: sumGovtVacancies(active.filter(isVacancyBearingJob)),
  }
}

export function getCategoryNavStat(slug: string): GovtNavStat {
  const cat = getCategoryBySlug(slug)
  if (!cat) return { notifications: 0, vacancies: 0 }
  if (cat.contentType !== "jobs") {
    // Content categories (admit cards / results / answer keys / syllabus /
    // papers) have no vacancies — report the real resource count, zero posts.
    const n = GOVT_CONTENT.filter(c => c.contentType === cat.contentType).length
    return { notifications: n, vacancies: 0 }
  }
  const jobs = filterGovtJobsByCategory(slug)
  const s = statsFromJobs(jobs)
  if (s.notifications === 0 && cat.scope === "latest") {
    return statsFromJobs(GOVT_JOBS.filter(j => j.tab === "latest"))
  }
  return s
}

export function getStateNavStat(slug: string): GovtNavStat {
  // Real active counts only — no fabricated numbers for states without jobs.
  return statsFromJobs(filterGovtJobsByState(slug))
}

export function getQualificationNavStat(slug: string): GovtNavStat {
  return statsFromJobs(filterGovtJobsByQualification(slug))
}

// ── Database-backed browse-grid stats (used by the /jobs/govt hub) ──────────

/** Category-slug predicate usable against any rows array (job categories only). */
export function jobMatchesCategorySlug(job: GovtJob, slug: string): boolean {
  const cat = getCategoryBySlug(slug)
  return !!cat && cat.contentType === "jobs" && jobMatchesCategory(job, cat)
}

/** Real, active stats for a subset of rows (recruitment-tab vacancies only). */
function realStatsFromRows(jobs: GovtJob[]): GovtNavStat {
  const active = jobs.filter(isActiveGovtJob)
  return {
    notifications: active.length,
    vacancies: sumRealVacancies(active.filter(isVacancyBearingJob)),
  }
}

/** Map a content-type category to its govt_jobs tab (null = no job rows). */
function contentTabFor(contentType: string): GovtJob["tab"] | null {
  if (contentType === "results") return "results"
  if (contentType === "admit_cards") return "admit"
  if (contentType === "answer_keys") return "answer"
  return null
}

/** Build all browse-grid stats from a given (already-active) rows array. */
export function computeNavStats(rows: GovtJob[]) {
  const active = rows.filter(isActiveGovtJob)
  const categories: Record<string, GovtNavStat> = {}
  const states: Record<string, GovtNavStat> = {}
  const qualifications: Record<string, GovtNavStat> = {}

  for (const c of GOVT_TOP_CATEGORIES) {
    if (c.contentType !== "jobs") {
      const tab = contentTabFor(c.contentType)
      const n = tab ? active.filter(j => j.tab === tab).length : 0
      categories[c.slug] = { notifications: n, vacancies: 0 }
      continue
    }
    let jobs = active.filter(j => jobMatchesCategory(j, c))
    if (jobs.length === 0 && c.scope === "latest") jobs = active.filter(j => j.tab === "latest")
    categories[c.slug] = realStatsFromRows(jobs)
  }
  // Central (All-India) recruitment is open to candidates in every state, so a
  // state with no state-specific notifications still has these to show — the grid
  // must never display "0 notices · 0 vacancies". Empty states fall back to this
  // national baseline (mirrors the state page's own central-jobs fallback).
  const national = realStatsFromRows(
    active.filter(j => !j.stateSlug || (j.state || "").toLowerCase() === "all india"),
  )
  for (const s of INDIAN_STATES) {
    const own = realStatsFromRows(active.filter(j => j.stateSlug === s.slug))
    // Use the state's own figures only when both are non-zero; otherwise fall
    // back to the national baseline so a card never renders "0 notices/vacancies".
    states[s.slug] = own.notifications > 0 && own.vacancies > 0 ? own : national
  }
  for (const q of GOVT_QUALIFICATIONS) {
    qualifications[q.slug] = realStatsFromRows(active.filter(j => jobMatchesQualification(j, q.slug)))
  }
  return { categories, states, qualifications }
}

/** Async, database-backed browse-grid stats for the hub (local fallback). */
export async function getGovtNavStats() {
  return computeNavStats(await getActiveGovtRows())
}
