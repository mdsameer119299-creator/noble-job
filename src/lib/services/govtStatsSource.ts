/**
 * govtStatsSource.ts — single async source of truth for ALL /jobs/govt
 * statistics. Reads active rows from Supabase (RLS already restricts public
 * reads to active + approved + published) and falls back to the local seeded
 * inventory only when the database is unavailable or empty.
 *
 * Intentionally NOT gated on NEXT_PUBLIC_JOB_DATA_SOURCE — statistics always
 * prefer the database; that flag continues to govern listings only. Wrapped in
 * React cache() so a single page render performs at most one query.
 */
import { cache } from "react"
import { unstable_cache } from "next/cache"
import { GOVT_ROWS_CACHE_TTL_SECONDS } from "@/lib/config/govtCache"
import { GOVT_LIST_COLUMNS, GOVT_DETAIL_COLUMNS } from "@/lib/config/govtColumns"
import { GOVT_JOBS, enrichGovtJob } from "@/lib/data/govtData"
import { applyGovtVacancies } from "@/lib/data/govtVacancies"
import { isActiveGovtJob } from "@/lib/utils/govtJobExpiry"
import type { GovtJob } from "@/types/govtJob"

/**
 * Statistics are read server-side via the service-role client (the project's
 * sanctioned server-only reader). We mirror the public RLS predicate in the
 * query (status=active AND review_status=approved AND published) so that
 * bypassing RLS can never surface pending/unpublished rows.
 */
/** Re-exported for callers/tests; defined in the dependency-free config module. */
export { GOVT_ROWS_CACHE_TTL_SECONDS }

function adminConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  return !!url && !!key && url.startsWith("http") && !url.includes("placeholder") && !key.includes("placeholder")
}

/** Snake→camel + vacancy normalisation, mirroring govtJobService.mapGovtRow. */
function mapRow(row: Record<string, unknown>): GovtJob {
  const r = row as unknown as GovtJob & { last_date?: string; age_range?: string }
  return applyGovtVacancies({
    ...r,
    lastDate: r.lastDate ?? r.last_date,
    last_date: r.last_date ?? r.lastDate,
    ageRange: r.ageRange ?? r.age_range,
    age_range: r.age_range ?? r.ageRange,
  }) as GovtJob
}

/**
 * The actual Supabase POOL read + graceful local fallback. Same query, filters,
 * ordering and visibility as before (status=active AND review_status=approved
 * AND published; date-expired rows dropped) — the ONLY change is an explicit
 * LIGHT column projection instead of select("*"). Heavy detail-body columns are
 * excluded: `enrichGovtJob` synthesizes them when absent and no pool consumer
 * (lists / stats / sitemap / related / generateStaticParams) renders them, so
 * output is unchanged while per-row egress drops sharply.
 */
async function loadActiveGovtRows(): Promise<GovtJob[]> {
  const local = GOVT_JOBS.filter(isActiveGovtJob)
  if (!adminConfigured()) return local
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin")
    const { data, error } = await supabaseAdmin
      .from("govt_jobs")
      .select(GOVT_LIST_COLUMNS)
      .eq("status", "active")
      .eq("review_status", "approved")
      .eq("published", true)
    if (error || !data?.length) return local
    const rows = data.map(r =>
      enrichGovtJob(mapRow(r as unknown as Record<string, unknown>) as GovtJob & { last_date: string; age_range: string }),
    )
    return rows.filter(isActiveGovtJob)
  } catch {
    return local
  }
}

/** Strip characters that could break/inject a PostgREST or() filter. Slugs and
 *  ids are `[a-z0-9-]`; anything else simply yields no match (→ local fallback). */
function sanitizeGovtKey(v: string): string {
  return v.replace(/[^a-zA-Z0-9_-]/g, "")
}

/**
 * Fetch ONE genuine government job by slug or id — a single indexed row with its
 * full (light + heavy) columns — instead of loading the entire active dataset
 * and filtering in memory. Mirrors the pool's visibility filters (active,
 * approved, published, non-expired). Returns null when unconfigured / not found
 * / expired; the caller applies the local-seed fallback (kept in govtJobService
 * to avoid a circular import). Slugs are persisted + indexed on govt_jobs.
 */
async function loadGovtJobRow(slugOrId: string): Promise<GovtJob | null> {
  const key = sanitizeGovtKey(slugOrId || "")
  if (!key || !adminConfigured()) return null
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin")
    const { data, error } = await supabaseAdmin
      .from("govt_jobs")
      .select(GOVT_DETAIL_COLUMNS)
      .or(`slug.eq.${key},id.eq.${key}`)
      .eq("status", "active")
      .eq("review_status", "approved")
      .eq("published", true)
      .limit(1)
    if (error || !data?.length) return null
    const job = enrichGovtJob(
      mapRow(data[0] as unknown as Record<string, unknown>) as GovtJob & { last_date: string; age_range: string },
    )
    return isActiveGovtJob(job) ? job : null
  } catch {
    return null
  }
}

/** Per-render-deduped single-row lookup (detail page metadata + body share it). */
export const getGovtJobRow = cache((slugOrId: string): Promise<GovtJob | null> => loadGovtJobRow(slugOrId))

/**
 * SHARED, cross-request cache for the govt_jobs full-table read.
 *
 * `unstable_cache` stores the result in Next's server Data Cache with a ~300s
 * TTL, so ALL renders and ALL requests (the govt hub, ~140 detail/state/
 * category/qualification pages, the homepage category cards and the sitemap)
 * reuse a SINGLE `govt_jobs` read per window — instead of one full-table read
 * per request, which is the dominant Supabase egress source. React `cache()`
 * remains as the per-render dedupe (belt-and-suspenders on a cache miss).
 *
 * Emergency egress fix: no cron/tag invalidation here — the govt data changes
 * at most hourly (via the ingestion cron), so a 300s TTL is behaviour-neutral
 * for users while collapsing egress. Filtering, ordering, visibility, URLs,
 * metadata, schema and sitemap contents are unchanged.
 */
const cachedActiveGovtRows = unstable_cache(loadActiveGovtRows, ["govt-active-rows-v1"], {
  revalidate: GOVT_ROWS_CACHE_TTL_SECONDS,
})

export const getActiveGovtRows = cache((): Promise<GovtJob[]> => cachedActiveGovtRows())
