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
import { planIngestWrites, type ExistingGovtRow, type IngestPlan, type PlanEntry } from "@/lib/services/govtIngestPlan"
import { parseRealDate } from "@/lib/seo/jobPostingRules"
import { ADAPTERS, enabledAdapters } from "@/lib/ingest/registry"
import type { SourceAdapter, RawNotification } from "@/lib/ingest/types"
import type { GovtJob } from "@/types/govtJob"

type GovtJobRow = GovtJob & { last_date: string; age_range: string }
export interface PersistEntry { job: GovtJob; sourceId: string; hash: string; recordType: string; sourcePublishedAt?: string }

export interface AutoUpdateResult {
    ranAt: string
    autoPublish: boolean
    sourcesChecked: number
    failedSources: string[]
    /**
     * Adapter ids never attempted this run because the elapsed-time budget
     * (see ADAPTER_BUDGET_MS below) was exhausted before their turn. Distinct
     * from `failedSources` (attempted, `.fetch()` threw) and from a write
     * failure (attempted, fetch succeeded, persist() rejected — surfaced only
     * via `sources[].error`, never added here). Optional so existing callers/
     * tests built before this field existed keep compiling unchanged.
     */
  skippedSources?: string[]
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

/**
 * Elapsed-time budget for the adapter-fetch phase of runGovtAutoUpdate().
 *
 * This is a BOUNDARY check, not a hard timeout: it stops the loop from
 * STARTING a new adapter once the budget is spent, but it cannot interrupt
 * an adapter already in flight (SourceAdapter.fetch() takes no deadline/
 * AbortSignal). A single already-started adapter can still overrun the
 * budget by its own worst case (see each adapter's own fetch timeout).
 * Promise.race() is deliberately NOT used here — it would stop this function
 * from waiting on a slow adapter, but would not cancel that adapter's
 * underlying fetch()/persist() call, which could then write to govt_jobs
 * after this function has already moved on to (or finished) later adapters.
 *
 * GOVT_INGEST_BUDGET_MS lets an operator raise the total budget (e.g. once
 * the execution environment's real duration ceiling is confirmed) without a
 * code change. The built-in default is deliberately conservative — safely
 * under Vercel's Hobby-tier 60s ceiling — since this codebase has no
 * confirmed plan tier to assume a larger one from.
 */
const DEFAULT_TOTAL_BUDGET_MS = 55_000
/**
 * Reserved for work that runs AFTER the adapter loop: expireStaleJobs() (one
 * select + conditional bulk update), recordIngestRun() (one insert), and
 * response serialization. Estimated with margin, not measured.
 */
const FIXED_OVERHEAD_RESERVE_MS = 8_000

function resolveTotalBudgetMs(): number {
    const configured = Number(process.env.GOVT_INGEST_BUDGET_MS)
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TOTAL_BUDGET_MS
}

/** Exported for testing (pure function, no I/O). */
export function adapterPhaseBudgetMs(): number {
    return Math.max(0, resolveTotalBudgetMs() - FIXED_OVERHEAD_RESERVE_MS)
}

/**
 * The exact boundary predicate the adapter loop uses before starting each
 * adapter: true only while elapsed time is strictly under budget. Extracted
 * so the loop's stop/continue decision is independently testable without
 * mocking Supabase or timing a real loop — see govtAutoUpdate.test.ts.
 * `elapsedMs` is measured ONCE per adapter, at that adapter's turn to start;
 * it says nothing about how long that adapter itself then takes to run (see
 * the doc comment on adapterPhaseBudgetMs for why that's a real limitation).
 */
export function hasAdapterBudgetRemaining(elapsedMs: number, budgetMs: number): boolean {
    return elapsedMs < budgetMs
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
 *
 * Exported (issue #46) so `RawNotification.publishedAt -> PersistEntry.sourcePublishedAt`
 * — the exact mapping that becomes the DB's `source_published_at` in persist()
 * below — has direct, no-I/O test coverage; see govtAutoUpdate.test.ts.
 */
export function normalise(raw: RawNotification, adapter: SourceAdapter): PersistEntry {
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

interface PersistResult { published: number; inserted: number; updated: number; unchanged: number; datesBackfilled?: number; error?: string }

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
 *
 * IMPORTANT: this backfill pass runs over BOTH `plan.writes` and
 * `plan.unchanged` — not writes alone. `contentHash()` never includes
 * `publishedAt`, so a row ingested before source-dated extraction existed
 * (title/org/post/vacancies/lastDate/officialUrl/notificationPdf all
 * unchanged since) hashes identically on a later run and is classified
 * "unchanged" by `planIngestWrites`, skipping the upsert entirely. Without
 * also covering `plan.unchanged` here, such a row's `source_published_at`
 * would never be set no matter how many times ingestion re-runs — confirmed
 * (2026-10-25): every one of the 133 currently-active notification rows
 * already has a non-null `content_hash` from pre-date-extraction ingestion,
 * so this is not a hypothetical edge case, it is the default case for the
 * very first run after this code ships.
 */
type PlannedEntry = PersistEntry & PlanEntry

/**
 * Pure (no I/O): which entries from this run's `IngestPlan` are candidates
 * for a `source_published_at` backfill — both written AND unchanged rows,
 * each only if it actually carries a `sourcePublishedAt`. Exported so the
 * "unchanged rows must still be considered" fix has direct, no-mock test
 * coverage (persist()'s actual Supabase calls are intentionally untested —
 * see the file header — so this is the testable seam for that bug).
 */
export function datesNeedingBackfill<E extends PlannedEntry>(plan: IngestPlan<E>): E[] {
    return [...plan.writes.map(w => w.entry), ...plan.unchanged].filter(e => !!e.sourcePublishedAt)
}

async function persist(entries: PersistEntry[]): Promise<PersistResult> {
    const none: PersistResult = { published: 0, inserted: 0, updated: 0, unchanged: 0, datesBackfilled: 0 }
    if (!isSupabaseAdminConfigured() || entries.length === 0) return none
    try {
          const { supabaseAdmin } = await import("@/lib/supabase/admin")
          const existing = await loadExistingRows(entries.map(e => e.job.id))
          const plan = planIngestWrites(
                  entries.map(e => ({ ...e, id: e.job.id })),
                  existing,
                )

      // Backfill source_published_at for every candidate this run saw —
      // written or not — never overwriting an existing value. See the doc
      // comment above; candidate selection itself is the pure, directly
      // tested `datesNeedingBackfill`.
      const backfillDates = async (): Promise<number> => {
              let n = 0
              for (const entry of datesNeedingBackfill(plan)) {
                        const { error: dateErr } = await supabaseAdmin
                          .from("govt_jobs")
                          .update({ source_published_at: entry.sourcePublishedAt } as never)
                          .eq("id", entry.job.id)
                          .is("source_published_at", null)
                        if (dateErr) { if (!isMissingColumnError(dateErr)) console.warn(`[govtAutoUpdate] source_published_at skipped for ${entry.job.id}: ${dateErr.message}`) }
                        else n++
              }
              return n
      }

      if (!plan.writes.length) {
              const datesBackfilled = await backfillDates()
              return { ...none, unchanged: plan.unchanged.length, datesBackfilled }
      }

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
                  // The upsert itself failed, but `plan.unchanged` rows never touched that
                  // upsert — their date backfill is independent and must not be skipped just
                  // because the write side of this run errored. (Any plan.writes candidates
                  // this also offers to backfillDates() are harmless here too: the per-row
                  // `.is("source_published_at", null)` guard means a row whose own upsert
                  // never landed either matches zero rows — a no-op — or, if it already
                  // existed with content now stale, still only has its date column touched.)
                  const datesBackfilled = await backfillDates()
                  return { ...none, unchanged: plan.unchanged.length, datesBackfilled, error: error.message }
          }

      // Real source publication dates — covers written AND unchanged rows (see doc comment above).
      const datesBackfilled = await backfillDates()

      const inserted = plan.writes.filter(w => w.isNew).length
          return { published: plan.writes.length, inserted, updated: plan.writes.length - inserted, unchanged: plan.unchanged.length, datesBackfilled }
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
 * expireStaleJobs() error-surfacing fix — closes it.
 *
 * `skippedSources` (optional — omitted by existing callers built before this
 * field existed, which must keep working identically) covers adapters never
 * ATTEMPTED this run because the elapsed-time budget ran out first. A run
 * with any skipped adapters must never read as `"success"` — it was
 * incomplete even if everything it DID attempt succeeded — so it is folded
 * into the same non-success branch as a genuine failure, but reported in its
 * own clause (`"skipped (budget): ..."`) rather than merged into
 * `allFailedIds`, so a reader (or a future per-adapter alert) can tell "this
 * adapter is broken" apart from "this adapter was never tried." A skipped id
 * is also excluded from `writeFailedIds` even if it happens to carry an
 * `error` string (its skip placeholder), so it is never double-counted as a
 * write failure. Exported for testing (pure function, no I/O).
 */
export function computeIngestRunStatus(
    result: Pick<AutoUpdateResult, "failedSources" | "sources" | "totalPublished">
      & { totalUnchanged?: number; skippedSources?: string[] },
  ): IngestRunStatus {
    const skippedIds = result.skippedSources ?? []
    const writeFailedIds = result.sources
      .filter(s => s.error && !result.failedSources.includes(s.id) && !skippedIds.includes(s.id))
      .map(s => s.id)
    const allFailedIds = [...result.failedSources, ...writeFailedIds]
    if (!allFailedIds.length && !skippedIds.length) return { status: "success", error: null }
    // Rows whose content_hash was unchanged are skipped (not written) — they are
  // still successfully processed, so they count as progress, not as "nothing".
  const progressed = result.totalPublished + (result.totalUnchanged ?? 0)
    const parts = [
          allFailedIds.length ? `failed: ${allFailedIds.join(", ")}` : null,
          skippedIds.length ? `skipped (budget): ${skippedIds.join(", ")}` : null,
    ].filter((p): p is string => p !== null)
    return { status: progressed ? "partial" : "error", error: parts.join("; ") }
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
        const skippedSources: string[] = []
            let totalPublished = 0, totalInserted = 0, totalUpdated = 0, totalUnchanged = 0

  const adapters = enabledAdapters()
    const adapterBudgetMs = adapterPhaseBudgetMs()

  for (let i = 0; i < adapters.length; i++) {
        // Boundary check only: stops a NEW adapter from starting once the
        // budget is spent. It cannot interrupt the adapter this iteration is
        // about to call — see adapterPhaseBudgetMs()'s doc comment.
        if (!hasAdapterBudgetRemaining(Date.now() - startedAt, adapterBudgetMs)) {
                for (const remaining of adapters.slice(i)) {
                          skippedSources.push(remaining.id)
                          report.push({
                                      id: remaining.id, label: remaining.label, fetched: 0, published: 0, skipped: 0,
                                      error: `skipped: time budget exceeded (${Date.now() - startedAt}ms elapsed, ${adapterBudgetMs}ms budget)`,
                          })
                }
                break
        }
        const adapter = adapters[i]
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
          skippedSources,
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
