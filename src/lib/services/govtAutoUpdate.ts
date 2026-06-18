/**
 * govtAutoUpdate.ts — adapter-driven ingestion engine for government jobs.
 *
 * runGovtAutoUpdate polls every ENABLED SourceAdapter (src/lib/ingest), normalises
 * notifications into enriched GovtJob rows, de-duplicates (stable id + content_hash),
 * publishes, then expires stale jobs — and records the run in ingest_runs.
 * Adapters are added incrementally; disabled stubs contribute nothing, so this is
 * safe to schedule hourly today (expiry automation runs regardless of sources).
 *
 * Invoked by /api/cron/govt-jobs (Hostinger cron or GitHub Actions).
 */
import { createHash } from "crypto"
import { SCHEDULER_CONFIG } from "@/lib/config/govtSources"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { enrichGovtJob } from "@/lib/data/govtData"
import { isGovtJobExpired } from "@/lib/utils/govtJobExpiry"
import { slugify } from "@/lib/config/govtTaxonomy"
import { ADAPTERS, enabledAdapters } from "@/lib/ingest/registry"
import type { SourceAdapter, RawNotification } from "@/lib/ingest/types"
import type { GovtJob } from "@/types/govtJob"

type GovtJobRow = GovtJob & { last_date: string; age_range: string }
interface PersistEntry { job: GovtJob; sourceId: string; hash: string }

export interface AutoUpdateResult {
  ranAt: string
  autoPublish: boolean
  sourcesChecked: number
  failedSources: string[]
  sources: { id: string; label: string; fetched: number; published: number; skipped: number; error?: string }[]
  totalPublished: number
  /** Number of jobs flipped to status=expired by this run. */
  totalExpired: number
}

/** Stable content fingerprint for change-detection / duplicate protection. */
function contentHash(raw: RawNotification): string {
  return createHash("sha256")
    .update([raw.title, raw.org, raw.post, raw.vacancies, raw.lastDate, raw.officialUrl, raw.notificationPdf].join("|"))
    .digest("hex")
}

/**
 * Normalise a raw notification into a fully-enriched GovtJob (unique SEO slug,
 * taxonomy tags, complete article + detail sections), plus provenance + hash.
 */
function normalise(raw: RawNotification, adapter: SourceAdapter): PersistEntry {
  const stableId = `${adapter.id}:${slugify(raw.externalId || raw.title) || String(Date.now())}`
  const base: GovtJobRow = {
    id: stableId,
    title: raw.title || "Untitled Notification",
    org: raw.org || adapter.label,
    short: (raw.org || adapter.label).slice(0, 4).toUpperCase(),
    post: raw.post || "",
    vacancies: raw.vacancies || "TBA",
    qualification: raw.qualification || "",
    lastDate: raw.lastDate || "TBA",
    last_date: raw.lastDate || "TBA",
    ageRange: "-",
    age_range: "-",
    fee: raw.fee || "-",
    startDate: raw.startDate,
    salary: raw.salary || "-",
    location: raw.location || raw.state || "All India",
    state: raw.state || "All India",
    // When an adapter supplies a canonical slug (state-PSC sources) it is
    // authoritative; enrichGovtJob only fills stateSlug when it's still unset.
    stateSlug: raw.stateSlug,
    tab: raw.tab || "latest",
    department: raw.org || adapter.label,
    color: "#1e3a8a",
    badge: "New",
    status: "active",
    jobStatus: "LIVE_JOB",
    postedAt: new Date().toISOString(),
    notificationPdf: raw.notificationPdf,
    officialUrl: raw.officialUrl,
  }
  // synthesizeVacancies:false — real ingested jobs must never carry a fabricated
  // vacancy count; unknown counts surface as "Not Specified".
  return { job: enrichGovtJob(base, { synthesizeVacancies: false }), sourceId: adapter.id, hash: contentHash(raw) }
}

/** Idempotent upsert (onConflict:"id") with provenance + content hash. */
async function persist(entries: PersistEntry[]): Promise<number> {
  if (!isSupabaseConfigured() || entries.length === 0) return 0
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin")
    const rows = entries.map(({ job: j, sourceId, hash }) => ({
      id: j.id, slug: j.slug, title: j.title, org: j.org, short: j.short, post: j.post,
      vacancies: j.vacancies, qualification: j.qualification, age_range: j.ageRange, fee: j.fee,
      last_date: j.lastDate, start_date: j.startDate, salary: j.salary, location: j.location,
      state: j.state, state_slug: j.stateSlug, tab: j.tab, department: j.department, experience: j.experience,
      category_tags: j.categoryTags, qualification_tags: j.qualificationTags, color: j.color, badge: j.badge,
      status: j.status, job_status: j.jobStatus, notification_pdf: j.notificationPdf, apply_url: j.applyUrl,
      official_url: j.officialUrl, overview: j.overview, vacancy_breakup: j.vacancyBreakup, eligibility: j.eligibility,
      age_limit: j.ageLimit, salary_details: j.salaryDetails, selection_process: j.selectionProcess,
      fee_details: j.feeDetails, exam_pattern: j.examPattern, syllabus_content: j.syllabusContent,
      important_dates: j.importantDates, faqs: j.faqs, article: j.article,
      source_id: sourceId, content_hash: hash, published: SCHEDULER_CONFIG.autoPublish,
    }))
    const { error } = await supabaseAdmin.from("govt_jobs").upsert(rows as never, { onConflict: "id" })
    return error ? 0 : entries.length
  } catch {
    return 0
  }
}

/**
 * Flip active jobs whose lastDate has passed to status=expired. Jobs are never
 * deleted — expired rows remain published/searchable and resolve on their URL.
 * Safe to run repeatedly.
 */
async function expireStaleJobs(): Promise<number> {
  if (!isSupabaseConfigured()) return 0
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin")
    const { data, error } = await supabaseAdmin
      .from("govt_jobs")
      .select("id, last_date")
      .eq("status", "active")
    if (error || !data?.length) return 0
    const staleIds = (data as { id: string; last_date: string }[])
      .filter(row => isGovtJobExpired(row.last_date))
      .map(row => row.id)
    if (!staleIds.length) return 0
    const { error: updateError } = await supabaseAdmin
      .from("govt_jobs")
      .update({ status: "expired" })
      .in("id", staleIds)
    return updateError ? 0 : staleIds.length
  } catch {
    return 0
  }
}

/**
 * Best-effort monitoring write — never breaks a run, but no longer fails
 * SILENTLY: a rejected insert (e.g. missing table / schema-cache miss) is logged
 * so the gap is visible in deploy logs instead of being swallowed.
 */
async function recordIngestRun(result: AutoUpdateResult, startedAtMs: number, durationMs: number): Promise<void> {
  if (!isSupabaseConfigured()) return
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin")
    const status = result.failedSources.length ? (result.totalPublished ? "partial" : "error") : "success"
    const { error } = await supabaseAdmin.from("ingest_runs").insert({
      source_id: "all",
      trigger: "cron",
      status,
      started_at: new Date(startedAtMs).toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      fetched: result.sources.reduce((s, r) => s + r.fetched, 0),
      inserted: result.totalPublished,
      updated: 0,
      skipped: result.sources.reduce((s, r) => s + r.skipped, 0),
      expired: result.totalExpired,
      error: result.failedSources.length ? `failed: ${result.failedSources.join(", ")}` : null,
    } as never)
    if (error) console.error(`[govtAutoUpdate] ingest_runs insert failed: ${error.message}`)
  } catch (e) {
    // Thrown (vs returned) failure — still best-effort, but surfaced.
    console.error(`[govtAutoUpdate] ingest_runs recording threw: ${(e as Error).message}`)
  }
}

/** Run one ingestion pass across all enabled adapters, then expire stale jobs. */
export async function runGovtAutoUpdate(): Promise<AutoUpdateResult> {
  const startedAt = Date.now()
  const seen = new Set<string>()
  const report: AutoUpdateResult["sources"] = []
  const failedSources: string[] = []
  let totalPublished = 0

  for (const adapter of enabledAdapters()) {
    let fetched = 0, skipped = 0
    try {
      const raws = (await adapter.fetch()).slice(0, SCHEDULER_CONFIG.maxPerSourcePerRun)
      fetched = raws.length
      const toPublish: PersistEntry[] = []
      for (const raw of raws) {
        const entry = normalise(raw, adapter)
        if (seen.has(entry.job.id)) { skipped++; continue }
        seen.add(entry.job.id)
        toPublish.push(entry)
      }
      const published = SCHEDULER_CONFIG.autoPublish ? await persist(toPublish) : 0
      totalPublished += published
      report.push({ id: adapter.id, label: adapter.label, fetched, published, skipped })
    } catch (e) {
      failedSources.push(adapter.id)
      report.push({ id: adapter.id, label: adapter.label, fetched, published: 0, skipped, error: (e as Error).message })
    }
  }

  const totalExpired = await expireStaleJobs()
  const result: AutoUpdateResult = {
    ranAt: new Date().toISOString(),
    autoPublish: SCHEDULER_CONFIG.autoPublish,
    sourcesChecked: ADAPTERS.length,
    failedSources,
    sources: report,
    totalPublished,
    totalExpired,
  }
  await recordIngestRun(result, startedAt, Date.now() - startedAt)
  return result
}

export interface GovtIngestMetrics {
  activeJobs: number
  expiredJobs: number
  addedToday: number
  lastSync: string | null
  failedSources: string[]
  sourcesChecked: number
}

/** Dashboard metrics: Active / Expired / Added-today / Last-sync / Failed / Checked. */
export async function getGovtIngestMetrics(): Promise<GovtIngestMetrics> {
  const empty: GovtIngestMetrics = {
    activeJobs: 0, expiredJobs: 0, addedToday: 0, lastSync: null, failedSources: [], sourcesChecked: ADAPTERS.length,
  }
  if (!isSupabaseConfigured()) return empty
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin")
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const [active, expired, added, lastRun] = await Promise.all([
      supabaseAdmin.from("govt_jobs").select("id", { count: "exact", head: true }).eq("status", "active").eq("published", true),
      supabaseAdmin.from("govt_jobs").select("id", { count: "exact", head: true }).eq("status", "expired"),
      supabaseAdmin.from("govt_jobs").select("id", { count: "exact", head: true }).gte("created_at", startOfToday.toISOString()),
      supabaseAdmin.from("ingest_runs").select("started_at, error").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    ])
    const last = lastRun.data as { started_at?: string; error?: string | null } | null
    return {
      activeJobs: active.count ?? 0,
      expiredJobs: expired.count ?? 0,
      addedToday: added.count ?? 0,
      lastSync: last?.started_at ?? null,
      failedSources: last?.error ? [last.error] : [],
      sourcesChecked: ADAPTERS.length,
    }
  } catch {
    return empty
  }
}
