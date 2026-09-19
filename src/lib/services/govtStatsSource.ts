/**
 * govtStatsSource.ts — single async source of truth for ALL /jobs/govt
 * statistics. Reads active rows from Supabase (RLS already restricts public
 * reads to active + approved + published).
 *
 * DATA-INTEGRITY POLICY (Phase 1): when Supabase fails, the hand-written SEED
 * rows are NOT silently swapped in as "current official jobs". The order is
 * live DB → last-known-good REAL dataset (age-bounded) → seed only when
 * `isGovtSeedFallbackAllowed()` (dev / explicit opt-in) → an honest
 * "unavailable" state. See `govtPoolResolver.ts`.
 *
 * Intentionally NOT gated on NEXT_PUBLIC_JOB_DATA_SOURCE — statistics always
 * prefer the database; that flag continues to govern listings only. Wrapped in
 * React cache() so a single page render performs at most one query.
 */
import { cache } from "react"
import { unstable_cache } from "next/cache"
import { GOVT_ROWS_CACHE_TTL_SECONDS } from "@/lib/config/govtCache"
import { GOVT_LIST_COLUMNS, GOVT_DETAIL_COLUMNS, withGovtIntegrityColumns } from "@/lib/config/govtColumns"
import { govtKeyLookups } from "@/lib/config/govtKey"
import { govtLastKnownGoodMaxAgeMs, isGovtSeedFallbackAllowed } from "@/lib/config/govtSeedPolicy"
import { GOVT_JOBS, enrichGovtJob } from "@/lib/data/govtData"
import { applyGovtVacancies, parseVacancyCount } from "@/lib/data/govtVacancies"
import { isGovtRecordType } from "@/lib/govt/recordType"
import { isMissingColumnError } from "@/lib/supabase/columnErrors"
import { resolveGovtPool, type GovtPoolSnapshot, type GovtPoolResult } from "@/lib/services/govtPoolResolver"
import { isActiveGovtJob } from "@/lib/utils/govtJobExpiry"
import type { GovtJob } from "@/types/govtJob"

/** Thrown for a single-row lookup when the database is unreachable and no last-known-good copy exists. */
export class GovtSourceUnavailableError extends Error {
  constructor(reason: string) {
    super(`Government job data is temporarily unavailable (${reason})`)
    this.name = "GovtSourceUnavailableError"
  }
}

/** Last successful REAL pool read (process memory; survives a database outage). */
let lastKnownGood: GovtPoolSnapshot<GovtJob> | null = null

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
    // Captured BEFORE applyGovtVacancies can synthesize a display count.
    vacanciesStated: parseVacancyCount(r.vacancies) !== null ? String(r.vacancies).trim() : undefined,
    lastDate: r.lastDate ?? r.last_date,
    last_date: r.last_date ?? r.lastDate,
    ageRange: r.ageRange ?? r.age_range,
    age_range: r.age_range ?? r.ageRange,
    // Record-integrity columns (absent on an unmigrated database → undefined).
    recordType: isGovtRecordType(r.record_type) ? r.record_type : undefined,
    sourcePublishedAt: r.source_published_at ?? undefined,
    contentChangedAt: r.content_changed_at ?? undefined,
    verifiedAt: r.verified_at ?? undefined,
    verifiedBy: r.verified_by ?? undefined,
  }) as GovtJob
}

/**
 * The actual Supabase POOL read — STRICT: it throws on any failure (or when the
 * admin client is unconfigured) so a failure is never cached and never silently
 * replaced by demo data. Same query, filters, ordering and visibility as before
 * (status=active AND review_status=approved AND published; date-expired rows
 * dropped) with the explicit LIGHT column projection.
 *
 * The record-integrity columns are requested first; if the database has not had
 * migration 20260727000001 applied yet, Postgres reports the missing column and
 * we retry with the base projection.
 */
async function loadActiveGovtRows(): Promise<GovtJob[]> {
  if (!adminConfigured()) throw new Error("Supabase admin client is not configured")
  const { supabaseAdmin } = await import("@/lib/supabase/admin")
  const runList = (cols: string) =>
    supabaseAdmin
      .from("govt_jobs")
      .select(cols)
      .eq("status", "active")
      .eq("review_status", "approved")
      .eq("published", true)
  let res = await runList(withGovtIntegrityColumns(GOVT_LIST_COLUMNS))
  if (res.error && isMissingColumnError(res.error)) res = await runList(GOVT_LIST_COLUMNS)
  if (res.error) throw new Error(res.error.message)
  const rows = (res.data ?? []).map(r =>
    enrichGovtJob(mapRow(r as unknown as Record<string, unknown>) as GovtJob & { last_date: string; age_range: string }),
  )
  return rows.filter(isActiveGovtJob)
}

/**
 * Fetch ONE genuine government job by slug or id — a single indexed row with its
 * full (light + heavy) columns — instead of loading the entire active dataset
 * and filtering in memory. Mirrors the pool's visibility filters (active,
 * approved, published, non-expired). Returns null ONLY when the database was
 * reached and the row is absent/expired; any failure THROWS (see getGovtJobRow
 * for the last-known-good / unavailable handling). Slugs are persisted + indexed
 * on govt_jobs.
 *
 * Resolution uses separate parameterized `.eq()` queries (slug first, then id)
 * rather than interpolating the raw key into a combined `.or()` string. This
 * keeps colon-containing ids (e.g. "mppsc:mppsc-2025-20-06-20") working and makes
 * PostgREST filter injection structurally impossible — the key is only ever a
 * VALUE bound by supabase-js, never part of the filter grammar. Both columns are
 * indexed, so the extra lookup for an id is a cheap single-row read.
 */
async function loadGovtJobRow(slugOrId: string): Promise<GovtJob | null> {
  const lookups = govtKeyLookups(slugOrId)
  if (!lookups.length) return null
  if (!adminConfigured()) throw new Error("Supabase admin client is not configured")
  const { supabaseAdmin } = await import("@/lib/supabase/admin")
  let row: Record<string, unknown> | null = null
  for (const [column, value] of lookups) {
    const runOne = (cols: string) =>
      supabaseAdmin
        .from("govt_jobs")
        .select(cols)
        .eq(column, value)
        .eq("status", "active")
        .eq("review_status", "approved")
        .eq("published", true)
        .limit(1)
    let res = await runOne(withGovtIntegrityColumns(GOVT_DETAIL_COLUMNS))
    if (res.error && isMissingColumnError(res.error)) res = await runOne(GOVT_DETAIL_COLUMNS)
    if (res.error) throw new Error(res.error.message) // an error is NOT "not found"
    if (res.data?.length) {
      row = res.data[0] as unknown as Record<string, unknown>
      break
    }
  }
  if (!row) return null
  const job = enrichGovtJob(mapRow(row) as GovtJob & { last_date: string; age_range: string })
  return isActiveGovtJob(job) ? job : null
}

/**
 * Per-render-deduped single-row lookup (detail page metadata + body share it).
 *
 * `null` means the database was reached and the row does not exist (or is not
 * active). A database FAILURE is different: we serve the row from the
 * last-known-good pool when we have one, otherwise (policy allowing) return
 * `null` so the caller may consult the dev seed, otherwise THROW
 * `GovtSourceUnavailableError` — a 5xx that crawlers retry, never a 404 that
 * would get real pages de-indexed during an outage.
 */
export const getGovtJobRow = cache(async (slugOrId: string): Promise<GovtJob | null> => {
  try {
    return await loadGovtJobRow(slugOrId)
  } catch (e) {
    const reason = (e as Error).message
    const snap = lastKnownGood
    if (snap && Date.now() - snap.at <= govtLastKnownGoodMaxAgeMs()) {
      const hit = snap.rows.find(j => j.slug === slugOrId || j.id === slugOrId)
      console.warn(`[govtSource] single-row lookup failed (${reason}); ${hit ? "served last-known-good row" : "not in last-known-good"}`)
      return hit && isActiveGovtJob(hit) ? hit : null
    }
    if (isGovtSeedFallbackAllowed()) return null // caller may consult the dev seed
    throw new GovtSourceUnavailableError(reason)
  }
})

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
 * The cached function is STRICT (throws on failure), so a failed read is never
 * cached; `resolveGovtPool` layers last-known-good / policy-gated seed / an
 * honest unavailable state on top.
 */
const cachedActiveGovtRows = unstable_cache(loadActiveGovtRows, ["govt-active-rows-v2"], {
  revalidate: GOVT_ROWS_CACHE_TTL_SECONDS,
})

/** The same degraded-source warning would otherwise repeat once per page render. */
let lastWarn: { msg: string; at: number } | null = null
function warnThrottled(msg: string) {
  const now = Date.now()
  if (lastWarn && lastWarn.msg === msg && now - lastWarn.at < 60_000) return
  lastWarn = { msg, at: now }
  console.warn(msg)
}

const resolveActivePool = cache((): Promise<GovtPoolResult<GovtJob>> =>
  resolveGovtPool<GovtJob>({
    fetchStrict: () => cachedActiveGovtRows(),
    getLkg: () => lastKnownGood,
    setLkg: s => { lastKnownGood = s },
    allowSeed: isGovtSeedFallbackAllowed(),
    seed: () => GOVT_JOBS,
    isActive: isActiveGovtJob,
    maxAgeMs: govtLastKnownGoodMaxAgeMs(),
    warn: warnThrottled,
  }),
)

/** Active government rows. Never throws; empty + `getGovtPoolStatus().unavailable` when the source is down. */
export const getActiveGovtRows = cache(async (): Promise<GovtJob[]> => (await resolveActivePool()).rows)

/** Where the current pool came from — use to show an honest notice / noindex when unavailable. */
export async function getGovtPoolStatus(): Promise<{ source: GovtPoolResult<GovtJob>["source"]; unavailable: boolean; degraded: boolean }> {
  const { source } = await resolveActivePool()
  return { source, unavailable: source === "unavailable", degraded: source !== "db" }
}

/**
 * STRICT variant for the sitemap: throws when the source is unavailable so a
 * scheduled regeneration keeps serving the previous good sitemap instead of
 * publishing one with every govt URL missing.
 */
export async function getActiveGovtRowsStrict(): Promise<GovtJob[]> {
  const res = await resolveActivePool()
  if (res.source === "unavailable") throw new GovtSourceUnavailableError(res.error ?? "unknown")
  return res.rows
}
