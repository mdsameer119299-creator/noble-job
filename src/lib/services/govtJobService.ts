import { isSupabaseConfigured } from "@/lib/supabase/config"
import { preferLocalInventory, shouldFallbackToLocal } from "@/lib/supabase/useLocalInventory"
import { GOVT_JOBS, GOVT_CONTENT, enrichGovtJob } from "@/lib/data/govtData"
import { applyGovtVacancies, sumGovtVacancies, isVacancyBearingJob } from "@/lib/data/govtVacancies"
import { getCategoryBySlug } from "@/lib/config/govtTaxonomy"
import { filterGovtJobsByCategory, filterGovtJobsByQualification } from "@/lib/services/govtNavStats"
import { getGovtJobsLocal, getGovtJobByIdLocal } from "@/lib/services/govtJobLocal"
import { isGovtJobExpired, isActiveGovtJob } from "@/lib/utils/govtJobExpiry"
import type { GovtJob, GovtJobTab, GovtContentItem } from "@/types/govtJob"

async function getSupabaseClient() {
  const { createClient } = await import("@/lib/supabase/server")
  return createClient()
}

function mapGovtRow(row: Record<string, unknown>): GovtJob {
  const r = row as unknown as GovtJob & { last_date?: string; age_range?: string }
  return applyGovtVacancies({
    ...r,
    lastDate: r.lastDate ?? r.last_date,
    last_date: r.last_date ?? r.lastDate,
    ageRange: r.ageRange ?? r.age_range,
    age_range: r.age_range ?? r.ageRange,
  }) as GovtJob
}

export async function getGovtJobs(tab: GovtJobTab = "latest", state?: string): Promise<GovtJob[]> {
  const local = getGovtJobsLocal(tab, state)
  if (preferLocalInventory() || !isSupabaseConfigured()) return local

  try {
    const sb = await getSupabaseClient()
    if (!sb) return local
    let q = sb.from("govt_jobs").select("*").eq("status", "active").eq("tab", tab).order("sort_order")
    if (state && state !== "All India") q = q.eq("state", state)
    const { data, error } = await q
    if (error || !data?.length) return local
    const remote = data.map(row =>
      enrichGovtJob(mapGovtRow(row as Record<string, unknown>) as GovtJob & { last_date: string; age_range: string }),
    )
    return shouldFallbackToLocal(remote.length, local.length) ? local : remote
  } catch {
    return local
  }
}

export async function getGovtJobById(id: string): Promise<GovtJob | null> {
  const local = getGovtJobByIdLocal(id)
  if (preferLocalInventory()) return local

  if (!isSupabaseConfigured()) return local
  try {
    const sb = await getSupabaseClient()
    if (!sb) return local
    const { data } = await sb.from("govt_jobs").select("*").or(`id.eq.${id},slug.eq.${id}`).maybeSingle()
    if (data) {
      return enrichGovtJob(mapGovtRow(data as Record<string, unknown>) as GovtJob & { last_date: string; age_range: string })
    }
    return local
  } catch {
    return local
  }
}

/** Look up a single government job by SEO slug (falls back to id). */
export async function getGovtJobBySlug(slug: string): Promise<GovtJob | null> {
  const local = getGovtJobByIdLocal(slug)
  if (preferLocalInventory()) return local

  if (isSupabaseConfigured()) {
    try {
      const sb = await getSupabaseClient()
      if (!sb) return local
      const { data } = await sb.from("govt_jobs").select("*").or(`slug.eq.${slug},id.eq.${slug}`).maybeSingle()
      if (data) {
        return enrichGovtJob(
          mapGovtRow(data as Record<string, unknown>) as GovtJob & { last_date: string; age_range: string },
        )
      }
    } catch { /* fall through */ }
  }
  return local
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

/** Filtered + paginated government job listing (state / qualification / dept / category). */
export function getGovtJobsFiltered(filters: GovtJobFilters = {}): GovtJobListResult {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 20
  let list = [...GOVT_JOBS]

  if (filters.category) {
    const cat = getCategoryBySlug(filters.category)
    if (cat?.contentType === "jobs") {
      list = filterGovtJobsByCategory(filters.category)
    }
  }
  if (filters.qualification) list = filterGovtJobsByQualification(filters.qualification)
  if (filters.state) list = list.filter(j => j.stateSlug === filters.state)
  if (filters.department) list = list.filter(j => (j.department || j.org).toLowerCase().includes(filters.department!.toLowerCase()))
  if (filters.experience) list = list.filter(j => (j.experience || "").toLowerCase().includes(filters.experience!.toLowerCase()))
  // "open" means the application window has not yet closed — check both the
  // explicit status flag and the actual lastDate so date-passed jobs are hidden
  // even when the status column hasn't been updated by the nightly cron yet.
  if (filters.lastDate === "open") list = list.filter(j => j.status !== "expired" && !isGovtJobExpired(j.lastDate))
  if (filters.q) {
    const q = filters.q.toLowerCase()
    list = list.filter(j => `${j.title} ${j.org} ${j.post}`.toLowerCase().includes(q))
  }

  const facets = {
    departments: Array.from(new Set(GOVT_JOBS.map(j => j.department || j.org))).sort(),
    experiences: Array.from(new Set(GOVT_JOBS.map(j => j.experience).filter(Boolean) as string[])).sort(),
  }

  return {
    items: list.slice((page - 1) * limit, page * limit),
    total: list.length,
    // Headline vacancy stat counts active, recruitment-tab jobs only; the
    // displayed item list / pagination above are intentionally left unchanged.
    vacanciesTotal: sumGovtVacancies(list.filter(j => isActiveGovtJob(j) && isVacancyBearingJob(j))),
    page,
    totalPages: Math.ceil(list.length / limit) || 1,
    facets,
  }
}

/** Related jobs sharing a category with the given job. */
export function getRelatedGovtJobs(job: GovtJob, limit = 6): GovtJob[] {
  return GOVT_JOBS.filter(j => j.id !== job.id && j.categoryTags?.some(t => job.categoryTags?.includes(t) && t !== "latest-notifications")).slice(0, limit)
}

/** State-wise related jobs. */
export function getStateRelatedGovtJobs(job: GovtJob, limit = 5): GovtJob[] {
  if (!job.stateSlug) return []
  return GOVT_JOBS.filter(j => j.id !== job.id && j.stateSlug === job.stateSlug).slice(0, limit)
}

/** Qualification-wise related jobs. */
export function getQualificationRelatedGovtJobs(job: GovtJob, limit = 5): GovtJob[] {
  return GOVT_JOBS.filter(j => j.id !== job.id && j.qualificationTags?.some(t => job.qualificationTags?.includes(t))).slice(0, limit)
}

export interface GovtContentResult { items: GovtContentItem[]; total: number; page: number; totalPages: number }

/** Government content listing (admit cards / results / answer keys / syllabus / papers). */
export function getGovtContent(
  contentType: GovtContentItem["contentType"],
  filters: { q?: string; state?: string; page?: number; limit?: number } = {},
): GovtContentResult {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 20
  let list = GOVT_CONTENT.filter(c => c.contentType === contentType)
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
  const base = preferLocalInventory() ? GOVT_JOBS.filter(j => j.tab === "latest") : await getGovtJobs("latest")
  // Active notifications only; fall back to active latest-tab inventory.
  const active = base.filter(isActiveGovtJob)
  const source = active.length ? active : GOVT_JOBS.filter(j => j.tab === "latest" && isActiveGovtJob(j))
  const totalVacancies = sumGovtVacancies(source.filter(isVacancyBearingJob))
  const departments = new Set(source.map(j => j.org)).size
  const locations = new Set(source.map(j => j.location)).size
  return { totalVacancies, departments, locations, totalExams: source.length }
}
