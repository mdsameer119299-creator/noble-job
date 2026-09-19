import { GOVT_CONTENT } from "@/lib/data/govtData"
import { sumRealVacancies, isVacancyBearingJob } from "@/lib/data/govtVacancies"
import { getCategoryBySlug } from "@/lib/config/govtTaxonomy"
import { jobMatchesCategorySlug } from "@/lib/services/govtNavStats"
import { jobMatchesQualification } from "@/lib/services/govtQualificationMatch"
import { getGovtJobsLocal, getGovtJobByIdLocal } from "@/lib/services/govtJobLocal"
import { getActiveGovtRows, getGovtJobRow } from "@/lib/services/govtStatsSource"
import { isGovtJobExpired } from "@/lib/utils/govtJobExpiry"
import { isGovtSeedFallbackAllowed } from "@/lib/config/govtSeedPolicy"
import type { GovtJob, GovtJobTab, GovtContentItem } from "@/types/govtJob"

/**
 * DB-first job tabs. Derives from the shared active-rows pool (Supabase, with
 * local emergency fallback baked into getActiveGovtRows) and reuses the exact
 * tab-matching logic from getGovtJobsLocal. No flag gate, no thin-data guard.
 */
export async function getGovtJobs(tab: GovtJobTab = "latest", state?: string): Promise<GovtJob[]> {
  const pool = await getActiveGovtRows()
  return getGovtJobsLocal(tab, state, pool)
}

// Single-row fetch (indexed slug/id lookup) instead of loading the full active
// dataset and filtering in memory. The demo seed is consulted ONLY when
// `isGovtSeedFallbackAllowed()` (dev / explicit opt-in) — never as a silent
// production fallback, so a seed record can't be served as a current official job.
export async function getGovtJobById(id: string): Promise<GovtJob | null> {
  return (await getGovtJobRow(id)) ?? (isGovtSeedFallbackAllowed() ? getGovtJobByIdLocal(id) : null)
}

/** Look up a single government job by SEO slug (falls back to id; dev seed only when policy allows). */
export async function getGovtJobBySlug(slug: string): Promise<GovtJob | null> {
  return (await getGovtJobRow(slug)) ?? (isGovtSeedFallbackAllowed() ? getGovtJobByIdLocal(slug) : null)
}

export interface GovtJobFilters {
  q?: string
  category?: string       // category slug (banking, railway, all-india, state-govt, …)
  state?: string          // state slug
  qualification?: string  // qualification slug
  department?: string
  experience?: string
  /** "open" → only non-expired notifications. */
  lastDate?: string
  page?: number
  limit?: number
}

export interface GovtJobListResult {
  items: GovtJob[]
  total: number
  vacanciesTotal: number
  page: number
  totalPages: number
  facets: { departments: string[]; experiences: string[] }
}

/** Filtered + paginated government job listing (state / qualification / dept / category). DB-first. */
export async function getGovtJobsFiltered(filters: GovtJobFilters = {}): Promise<GovtJobListResult> {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 20
  const pool = await getActiveGovtRows()
  let list = pool

  if (filters.category) {
    const cat = getCategoryBySlug(filters.category)
    if (cat?.contentType === "jobs") {
      list = list.filter(j => jobMatchesCategorySlug(j, filters.category!))
    }
  }
  if (filters.qualification) list = list.filter(j => jobMatchesQualification(j, filters.qualification!))
  if (filters.state) list = list.filter(j => j.stateSlug === filters.state)
  if (filters.department) list = list.filter(j => (j.department || j.org).toLowerCase().includes(filters.department!.toLowerCase()))
  if (filters.experience) list = list.filter(j => (j.experience || "").toLowerCase().includes(filters.experience!.toLowerCase()))
  // Pool is already active (non-expired); the "open" filter is a no-op safety net.
  if (filters.lastDate === "open") list = list.filter(j => j.status !== "expired" && !isGovtJobExpired(j.lastDate))
  if (filters.q) {
    const q = filters.q.toLowerCase()
    list = list.filter(j => `${j.title} ${j.org} ${j.post}`.toLowerCase().includes(q))
  }

  const facets = {
    departments: Array.from(new Set(pool.map(j => j.department || j.org))).sort(),
    experiences: Array.from(new Set(pool.map(j => j.experience).filter(Boolean) as string[])).sort(),
  }

  return {
    items: list.slice((page - 1) * limit, page * limit),
    total: list.length,
    vacanciesTotal: sumRealVacancies(list.filter(isVacancyBearingJob)),
    page,
    totalPages: Math.ceil(list.length / limit) || 1,
    facets,
  }
}

/** Related jobs sharing a category with the given job. DB-first. */
export async function getRelatedGovtJobs(job: GovtJob, limit = 6): Promise<GovtJob[]> {
  const pool = await getActiveGovtRows()
  return pool.filter(j => j.id !== job.id && j.categoryTags?.some(t => job.categoryTags?.includes(t) && t !== "latest-notifications")).slice(0, limit)
}

/** State-wise related jobs. DB-first. */
export async function getStateRelatedGovtJobs(job: GovtJob, limit = 5): Promise<GovtJob[]> {
  if (!job.stateSlug) return []
  const pool = await getActiveGovtRows()
  return pool.filter(j => j.id !== job.id && j.stateSlug === job.stateSlug).slice(0, limit)
}

/** Qualification-wise related jobs. DB-first. */
export async function getQualificationRelatedGovtJobs(job: GovtJob, limit = 5): Promise<GovtJob[]> {
  const pool = await getActiveGovtRows()
  return pool.filter(j => j.id !== job.id && j.qualificationTags?.some(t => job.qualificationTags?.includes(t))).slice(0, limit)
}

export interface GovtContentResult { items: GovtContentItem[]; total: number; page: number; totalPages: number }

/** content_type → govt_jobs.tab for the three DB-backed content surfaces. */
const CONTENT_TAB: Partial<Record<GovtContentItem["contentType"], GovtJobTab>> = {
  results: "results",
  admit_cards: "admit",
  answer_keys: "answer",
}

/** Map a govt_jobs row into the GovtContentItem shape used by content pages. */
function jobToContentItem(j: GovtJob, contentType: GovtContentItem["contentType"]): GovtContentItem {
  return {
    id: j.id,
    slug: j.slug || j.id,
    contentType,
    title: j.title,
    org: j.org,
    examName: j.post || j.short || j.title,
    date: j.lastDate || j.examDate || "",
    link: j.officialUrl || j.applyUrl,
    state: j.state,
    stateSlug: j.stateSlug,
    color: j.color,
    badge: j.badge,
  }
}

/**
 * Government content listing. Results / Admit Cards / Answer Keys are served
 * from govt_jobs rows (by tab) so they are fully DB-driven; Syllabus and
 * Previous Papers remain on local GOVT_CONTENT until a content table exists.
 */
export async function getGovtContent(
  contentType: GovtContentItem["contentType"],
  filters: { q?: string; state?: string; page?: number; limit?: number } = {},
): Promise<GovtContentResult> {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 20

  const tab = CONTENT_TAB[contentType]
  let list: GovtContentItem[]
  if (tab) {
    const pool = await getActiveGovtRows()
    list = pool.filter(j => j.tab === tab).map(j => jobToContentItem(j, contentType))
  } else {
    list = GOVT_CONTENT.filter(c => c.contentType === contentType)
  }

  if (filters.state) list = list.filter(c => c.stateSlug === filters.state)
  if (filters.q) {
    const q = filters.q.toLowerCase()
    list = list.filter(c => `${c.title} ${c.org} ${c.examName}`.toLowerCase().includes(q))
  }
  return {
    items: list.slice((page - 1) * limit, page * limit),
    total: list.length,
    page,
    totalPages: Math.ceil(list.length / limit) || 1,
  }
}

export async function getGovtStats() {
  const source = await getActiveGovtRows()
  const totalVacancies = sumRealVacancies(source.filter(isVacancyBearingJob))
  const departments = new Set(source.map(j => j.org)).size
  const locations = new Set(source.map(j => j.location)).size
  return { totalVacancies, departments, locations, totalExams: source.length }
}
