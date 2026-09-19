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
import { isSupabaseAdminConfigured } from "@/lib/supabase/config"
import { enrichGovtJob } from "@/lib/data/govtData"
import { isGovtJobExpired } from "@/lib/utils/govtJobExpiry"
import { slugify, deriveStateSlugFromText } from "@/lib/config/govtTaxonomy"
import { deriveRecordType } from "@/lib/govt/recordType"
import { isMissingColumnError } from "@/lib/supabase/columnErrors"
import { planIngestWrites, type ExistingGovtRow } from "@/lib/services/govtIngestPlan"
import { parseRealDate } from "@/lib/seo/jobPostingRules"
import { ADAPTERS, enabledAdapters } from "@/lib/ingest/registry"
import type { SourceAdapter, RawNotification } from "@/lib/ingest/types"
import type { GovtJob } from "@/types/govtJob"

type GovtJobRow = GovtJob & { last_date: string; age_range: string }
interface PersistEntry { job: GovtJob; sourceId: string; hash: string; recordType: string; sourcePublishedAt?: string }

export interface AutoUpdateResult {
  ranAt: string
  autoPublish: boolean
  sourcesChecked: number
  failedSources: string[]
  sources: { id: string; label: string; fetched: number; published: number; unchanged?: number; skipped: number; error?: string }[]
  /** Rows actually written this run (new + changed). Unchanged rows are not rewritten. */
  totalPublished: number
  totalInserted?: number
  totalUpdated?: number
  /** Rows whose content_hash matched the stored one — skipped, content_changed_at untouched. */
  totalUnchanged?: number
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
  // State resolution priority:
  //   1. Adapter-supplied canonical slug (state-PSC sources) — authoritative.
  //   2. Conservative derivation from org/title for untagged sources (Employment
  //      News etc.) so state-PSC / state-police / state-university recruitments
  //      land under the right state instead of all collapsing to "All India".
  // Central bodies named after a state are excluded by deriveStateSlugFromText.
  const derived = raw.stateSlug ? undefined : deriveStateSlugFromText(raw.org, raw.title, raw.post)
  const resolvedStateSlug = raw.stateSlug ?? derived?.slug
  const resolvedStateName = raw.state ?? derived?.label ?? "All India"
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
    location: raw.location || resolvedStateName,
    state: resolvedStateName,
    // Authoritative adapter slug, else conservative org/title derivation (see
    // above). enrichGovtJob only backfills stateSlug when it's still unset.
    stateSlug: resolvedStateSlug,
    tab: raw.tab || "latest",
    department: raw.org || adapter.label,
    color: "#1e3a8a",
    badge: "New",
    status: "active",
    jobStatus: "LIVE_JOB",
    // NOTE: no `postedAt`. It used to be stamped with the fetch time, which then
    // leaked into JobPosting `datePosted`. The real source date (if the adapter
    // supplies one) is carried separately as sourcePublishedAt.
    notificationPdf: raw.notificationPdf,
    officialUrl: raw.officialUrl,
  }
  // synthesizeVacancies:false — real ingested jobs must never carry a fabricated
  // vacancy count; unknown counts surface as "Not Specified".
  return {
    job: enrichGovtJob(base, { synthesizeVacancies: false }),
    sourceId: adapter.id,
    hash: contentHash(raw),
    recordType: deriveRecordType({ tab: base.tab, title: base.title }),
    sourcePublishedAt: parseRealDate(raw.publishedAt),
  }
}

interface PersistResult { published: number; inserted: number; updated: number; unchanged: number; error?: string }

/** Rows of `govt_jobs` we need to compare against, fetched in id chunks. */
async function loadExistingRows(ids: string[]): Promise<ExistingGovtRow[]> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin")
  const out: ExistingGovtRow[] = []
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200)
    // Non-literal projections: the generated DB types predate migration 20260727000001.
    const withType: string = "id, content_hash, record_type"
    const baseCols: string = "id, content_hash"
    let res = await supabaseAdmin.from("govt_jobs").select(withType).in("id", chunk)
    if (res.error && isMissingColumnError(res.error)) {
      res = await supabaseAdmin.from("govt_jobs").select(baseCols).in("id", chunk)
    }
    if (res.error) throw new Error(res.error.message)
    out.push(...((res.data ?? []) as unknown as ExistingGovtRow[]))
  }
  return out
}

/**
 * Compare-then-write. Existing rows whose stored `content_hash` matches the
 * incoming one are NOT rewritten (so `content_changed_at` — the sitemap
 * `lastmod` source — only moves when public content really changed, and admin
 * edits / status are not clobbered). New and changed rows are upserted
 * (onConflict:"id") with provenance + hash + `content_changed_at`.
 *
 * `source_published_at` is only ever set from a REAL adapter-supplied date, and
 * only where it is still NULL — it is never overwritten and never stamped "now".
 * If the record-integrity columns do not exist yet (migration not applied) the
 * write is retried without them, so ingestion keeps working either side of it.
 */
async function persist(entries: PersistEntry[]): Promise<PersistResult> {
  const none: PersistResult = { published: 0, inserted: 0, updated: 0, unchanged: 0 }
  if (!isSupabaseAdminConfigured() || entries.length === 0) return none
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin")
    const existing = await loadExistingRows(entries.map(e => e.job.id))
    const plan = planIngestWrites(
      entries.map(e => ({ ...e, id: e.job.id })),
      existing,
    )
    if (!plan.writes.length) return { ...none, unchanged: plan.unchanged.length }

    const rows = plan.writes.map(({ entry: { job: j, sourceId, hash }, contentChangedAt, recordType }) => ({
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
      // record-integrity columns (migration 20260727000001)
      record_type: recordType, content_changed_at: contentChangedAt,
    }))

    let { error } = await supabaseAdmin.from("govt_jobs").upsert(rows as never, { onConflict: "id" })
    if (error && isMissingColumnError(error)) {
      const legacy = rows.map(({ record_type: _r, content_changed_at: _c, ...rest }) => rest)
      ;({ error } = await supabaseAdmin.from("govt_jobs").upsert(legacy as never, { onConflict: "id" }))
    }
    if (error) {
      console.error(`[govtAutoUpdate] persist upsert failed: ${error.message}`)
      return { ...none, unchanged: plan.unchanged.length, error: error.message }
    }

    // Real source publication dates — set only where still NULL, never overwritten.
    for (const { entry } of plan.writes) {
      if (!entry.sourcePublishedAt) continue
      const { error: dateErr } = await supabaseAdmin
        .from("govt_jobs")
        .update({ source_published_at: entry.sourcePublishedAt } as never)
        .eq("id", entry.job.id)
        .is("source_published_at", null)
      if (dateErr && !isMissingColumnError(dateErr)) console.warn(`[govtAutoUpdate] source_published_at skipped for ${entry.job.id}: ${dateErr.message}`)
    }

    const inserted = plan.writes.filter(w => w.isNew).length
    return { published: plan.writes.length, inserted, updated: plan.writes.length - inserted, unchanged: plan.unchanged.length }
  } catch (e) {
    const msg = (e as Error).message
    console.error(`[govtAutoUpdate] persist threw: ${msg}`)
    return { ...none, error: msg }
  }
}

/**
 * Flip active jobs whose lastDate has passed to status=expired. Jobs are never
 * deleted — expired rows remain published/searchable and resolve on their URL.
 * Safe to run repeatedly.
 */
async function expireStaleJobs(): Promise<number> {
  if (!isSupabaseAdminConfigured()) return 0
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin")
    const { data, error } = await supabaseAdmin
      .from("govt_jobs")
      .select("id, last_date")
      .eq("status", "active")
    if (error) { console.error(`[govtAutoUpdate] expireStaleJobs read failed: ${error.message}`); return 0 }
    if (!data?.length) return 0
    const staleIds = (data as { id: string; last_date: string }[])
      .filter(row => isGovtJobExpired(row.last_date))
      .map(row => row.id)
    if (!staleIds.length) return 0
    const { error: updateError } = await supabaseAdmin
      .from("govt_jobs")
      .update({ status: "expired" })
      .in("id", staleIds)
    if (updateError) console.error(`[govtAutoUpdate] expireStaleJobs update failed: ${updateError.message}`)
    return updateError ? 0 : staleIds.length
  } catch (e) {
    console.error(`[govtAutoUpdate] expireStaleJobs threw: ${(e as Error).message}`)
    return 0
  }
}

export interface IngestRunStatus { status: "success" | "partial" | "error"; error: string | null }

/**
 * Aggregate a run's outcome into the ingest_runs status/error fields.
 *
 * `failedSources` only covers adapters whose `.fetch()` threw — it says
 * nothing about adapters that fetched fine but whose `persist()` write
 * failed (e.g. a restricted/quota-exceeded Supabase project: every adapter
 * fetches successfully, every write is rejected, `failedSources` stays
 * empty). That gap meant a run where NOTHING was published could still be
 * recorded as `status: "success"`. Folding in `sources[].error` — populated
 * for write failures too as of the govtAutoUpdate.ts persist()/
 * expireStaleJobs() error-surfacing fix — closes it. Exported for testing
 * (pure function, no I/O).
 */
export function computeIngestRunStatus(
  result: Pick<AutoUpdateResult, "failedSources" | "sources" | "totalPublished"> & { totalUnchanged?: number },
): IngestRunStatus {
  const writeFailedIds = result.sources
    .filter(s => s.error && !result.failedSources.includes(s.id))
    .map(s => s.id)
  const allFailedIds = [...result.failedSources, ...writeFailedIds]
  if (!allFailedIds.length) return { status: "success", error: null }
  // Rows whose content_hash was unchanged are skipped (not written) — they are
  // still successfully processed, so they count as progress, not as "nothing".
  const progressed = result.totalPublished + (result.totalUnchanged ?? 0)
  return { status: progressed ? "partial" : "error", error: `failed: ${allFailedIds.join(", ")}` }
}

/**
 * Best-effort monitoring write — never breaks a run, but no longer fails
 * SILENTLY: a rejected insert (e.g. missing table / schema-cache miss) is logged
 * so the gap is visible in deploy logs instead of being swallowed.
 */
async function recordIngestRun(result: AutoUpdateResult, startedAtMs: number, durationMs: number): Promise<void> {
  if (!isSupabaseAdminConfigured()) return
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin")
    const { status, error: statusError } = computeIngestRunStatus(result)
    const { error } = await supabaseAdmin.from("ingest_runs").insert({
      source_id: "all",
      trigger: "cron",
      status,
      started_at: new Date(startedAtMs).toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      fetched: result.sources.reduce((s, r) => s + r.fetched, 0),
      inserted: result.totalInserted ?? result.totalPublished,
      updated: result.totalUpdated ?? 0,
      skipped: result.sources.reduce((s, r) => s + r.skipped, 0),
      expired: result.totalExpired,
      error: statusError,
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
  let totalPublished = 0, totalInserted = 0, totalUpdated = 0, totalUnchanged = 0

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
      const result: PersistResult = SCHEDULER_CONFIG.autoPublish
        ? await persist(toPublish)
        : { published: 0, inserted: 0, updated: 0, unchanged: 0 }
      totalPublished += result.published
      totalInserted += result.inserted
      totalUpdated += result.updated
      totalUnchanged += result.unchanged
      report.push({ id: adapter.id, label: adapter.label, fetched, published: result.published, unchanged: result.unchanged, skipped, error: result.error })
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
    totalInserted,
    totalUpdated,
    totalUnchanged,
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
  if (!isSupabaseAdminConfigured()) return empty
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
