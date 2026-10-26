import { cache as reactCache } from "react"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { isProductionEnvironment, preferLocalInventory } from "@/lib/supabase/useLocalInventory"
import { sortByStatus } from "@/lib/data/inventoryPagination"
import { filterRenderable, isValidJobId, renderableOrNull } from "@/lib/jobs/renderable"
import {
  getAbroadJobsPaginatedLocal,
  getAbroadJobByIdLocal,
  type AbroadJobFilters,
} from "@/lib/services/abroadJobLocal"
import { getLiveAbroadJobs, getLiveAbroadJobById } from "@/lib/services/liveJobOpportunities"
import { filterByCountry } from "@/lib/jobs/countryIdentity"
import { isSyntheticJobsVisible, applySyntheticVisibility } from "@/lib/jobs/syntheticVisibility"
import type { AbroadJob } from "@/types/abroadJob"

export type { AbroadJobFilters } from "@/lib/services/abroadJobLocal"

async function getSupabaseClient() {
  const { createClient } = await import("@/lib/supabase/server")
  return createClient()
}

export async function getAbroadJobsPaginated(filters: AbroadJobFilters = {}) {
  const all = await getAbroadJobs(filters)
  const page = Math.max(1, filters.page ?? 1)
  const limit = Math.max(1, filters.limit ?? 20)
  const start = (page - 1) * limit
  const items = all.slice(start, start + limit)
  const live = all.filter(j => j.jobStatus === "LIVE_JOB").length
  const verified = all.filter(j => j.jobStatus === "VERIFIED_JOB").length
  const archived = all.filter(j => j.jobStatus === "ARCHIVED_JOB").length
  return {
    items,
    total: all.length,
    page,
    totalPages: Math.max(1, Math.ceil(all.length / limit)),
    counts: { all: all.length, live, verified, archived },
  }
}

/**
 * Per-request memo (React `cache()`) when running inside the Next server runtime; a plain function in a
 * bare Node process (unit tests, scripts), where `react` has no `cache`. Same convention as
 * govtStatsSource.ts. Keyed on primitive arguments, so equal filters share one read within a request.
 */
function perRequest<A extends (string | undefined)[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  return typeof reactCache === "function" ? reactCache(fn) : fn
}

/** Everything the Abroad list reads that is NOT the live external feed: Supabase rows, or the local demo inventory. */
interface AbroadRest {
  jobs: AbroadJob[]
  /** Which source `jobs` came from (db rows, or the dev/local demo inventory). */
  origin: "db" | "local"
}

/** "Every local row that matches" — the local helper paginates, so ask for one page big enough to hold them all. */
const ALL_LOCAL = Number.MAX_SAFE_INTEGER

/**
 * The single place the Abroad list reads `abroad_jobs` (or, outside production, the local inventory).
 * Active rows only → renderable → synthetic-visibility → status-sorted, exactly as the list always did.
 *
 * COUNTRY IS DELIBERATELY NOT A PARAMETER. It is applied in memory by the caller with the shared
 * `countryMatches` rule (countryIdentity.ts), never by a source-specific rule (SQL ILIKE substring / local
 * equality), so (a) every source uses one definition of "this country" and aliases can never make the list
 * and its count disagree, and (b) the filtered list, the unfiltered list and all the country-card counts
 * share the SAME memoised read — one `abroad_jobs` query per request however many countries are shown.
 * Memoised per request: the same filters never trigger a second read in one render.
 */
const loadAbroadRest = perRequest(
  async (q?: string, category?: string, status?: string): Promise<AbroadRest> => {
    const syntheticVisible = await isSyntheticJobsVisible()
    const filters = { q: q || undefined, category: category || undefined }
    // Production never serves demo inventory; elsewhere it is the fallback when the DB is unavailable.
    const local = (): AbroadRest => ({
      jobs: isProductionEnvironment()
        ? []
        : getAbroadJobsPaginatedLocal({ ...filters, status: status as AbroadJobFilters["status"], page: 1, limit: ALL_LOCAL }, syntheticVisible).items,
      origin: "local",
    })

    if (preferLocalInventory() || !isSupabaseConfigured()) return local()

    try {
      const sb = await getSupabaseClient()
      if (!sb) return local()
      let query = sb.from("abroad_jobs").select("*").eq("status", "active")
      if (filters.q) query = query.or(`title.ilike.%${filters.q}%,company.ilike.%${filters.q}%`)
      if (filters.category) query = query.eq("category", filters.category)
      query = query.order("posted_at", { ascending: false })
      const { data, error } = await query
      if (error) return local()
      return {
        jobs: sortByStatus(applySyntheticVisibility(filterRenderable((data || []) as unknown as AbroadJob[], "abroad"), syntheticVisible)),
        origin: "db",
      }
    } catch {
      return local()
    }
  },
)

/** Live external jobs lead; a row of the same id from the other source is not listed twice. */
function composeAbroadJobs(live: AbroadJob[], rest: AbroadJob[]): AbroadJob[] {
  const liveIds = new Set(live.map(j => j.id))
  return [...live, ...rest.filter(j => !liveIds.has(j.id))]
}

export async function getAbroadJobs(filters: AbroadJobFilters = {}): Promise<AbroadJob[]> {
  const [live, rest] = await Promise.all([
    getLiveAbroadJobs({ q: filters.q, country: filters.country, category: filters.category }),
    loadAbroadRest(filters.q, filters.category, filters.status),
  ])
  return composeAbroadJobs(live, filterByCountry(rest.jobs, filters.country))
}

/**
 * Per-country job counts for the country cards, from ONE read of the Abroad pool instead of one full list
 * query per country. `counts[name]` equals `getAbroadJobsPaginated({ country: name }).total` — same active /
 * renderable / provenance / synthetic-visibility / source-selection rules, same per-source country filter
 * and same live-vs-stored de-duplication — because the stored rows come from the very loader the list uses
 * and are narrowed in memory by the very same `countryMatches` rule the list applies (countryIdentity.ts:
 * aliases such as UK / United Kingdom and UAE / United Arab Emirates, whole-country tokens only — "Oman"
 * never matches "Romania", "UK" never matches "Ukraine").
 *
 * Live external jobs are asked for per country through getLiveAbroadJobs(): that is an in-memory narrowing of
 * ONE upstream response (the URL does not depend on the country, so Next's fetch cache serves it once) and
 * a no-op while that source is disabled — it never touches the database.
 *
 * Failure is safe: if the read throws, every requested country reports 0 (never a target or invented count).
 */
export async function getAbroadCountryCounts(countries: readonly string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = Object.fromEntries(countries.map(c => [c, 0]))
  try {
    const [rest, liveByCountry] = await Promise.all([
      loadAbroadRest(undefined, undefined, undefined),
      Promise.all(countries.map(c => getLiveAbroadJobs({ country: c }))),
    ])
    countries.forEach((country, i) => {
      // A blank country is "no filter" in the list, so it is "no narrowing" here too (filterByCountry).
      counts[country] = composeAbroadJobs(liveByCountry[i], filterByCountry(rest.jobs, country)).length
    })
  } catch {
    // keep the zeros
  }
  return counts
}

export async function getAbroadJobById(id: string): Promise<AbroadJob | null> {
  if (!isValidJobId(id)) return null
  const syntheticVisible = await isSyntheticJobsVisible()
  const local = renderableOrNull(getAbroadJobByIdLocal(id, syntheticVisible), "abroad")
  if (preferLocalInventory() || !isSupabaseConfigured()) {
    if (isProductionEnvironment()) return await getLiveAbroadJobById(id)
    return (await getLiveAbroadJobById(id)) || local
  }
  try {
    const sb = await getSupabaseClient()
    if (!sb) return isProductionEnvironment() ? await getLiveAbroadJobById(id) : (await getLiveAbroadJobById(id)) || local
    const { data } = await sb.from("abroad_jobs").select("*").eq("id", id).maybeSingle()
    if (data) {
      const mapped = renderableOrNull(
        applySyntheticVisibility([data as unknown as AbroadJob], syntheticVisible)[0] ?? null,
        "abroad",
      )
      if (mapped) return mapped
    }
    return isProductionEnvironment() ? await getLiveAbroadJobById(id) : (await getLiveAbroadJobById(id)) || local
  } catch {
    return isProductionEnvironment() ? await getLiveAbroadJobById(id) : (await getLiveAbroadJobById(id)) || local
  }
}
