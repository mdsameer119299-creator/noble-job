/**
 * govtAutoUpdate.ts — scheduler/ingestion engine for government jobs.
 *
 * Reads the central source config (govtSources.ts), polls each enabled source,
 * normalises notifications into GovtJob rows, de-duplicates against what's
 * already stored, and publishes new entries. Designed to be invoked daily by
 * the cron endpoint at /api/cron/govt-jobs.
 *
 * NOTE: live scraping/feed parsing is intentionally stubbed (`fetchFromSource`)
 * so the architecture works without external dependencies. Wire real parsers
 * per `source.kind` when feeds are finalised; everything downstream already
 * supports the full flow (normalise → dedupe → publish).
 */
import { GOVT_SOURCES, SCHEDULER_CONFIG, type GovtSource } from "@/lib/config/govtSources"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { enrichGovtJob } from "@/lib/data/govtData"
import type { GovtJob } from "@/types/govtJob"

export interface AutoUpdateResult {
  ranAt: string
  autoPublish: boolean
  sources: { id: string; label: string; fetched: number; published: number; skipped: number }[]
  totalPublished: number
}

/** Fetch notifications for a source; uses local inventory slices until live parsers ship. */
async function fetchFromSource(source: GovtSource): Promise<Partial<GovtJob & { last_date: string; age_range: string }>[]> {
  const { GOVT_JOBS } = await import("@/lib/data/govtData")
  const tab = source.defaultTab
  const sector = source.sectors?.[0]
  const pool = GOVT_JOBS.filter(j => {
    if (sector && j.categoryTags?.includes(sector as GovtJob["tab"])) return true
    if (j.tab === tab) return true
    return j.org?.toLowerCase().includes(source.id.split("-")[0])
  })
  const slice = pool.slice(0, SCHEDULER_CONFIG.maxPerSourcePerRun)
  return slice.map(j => ({
    id: `${source.id}-${j.id}`,
    title: j.title,
    org: j.org,
    short: j.short,
    post: j.post,
    vacancies: j.vacancies,
    qualification: j.qualification,
    lastDate: j.lastDate,
    last_date: j.lastDate,
    ageRange: j.ageRange,
    age_range: j.ageRange,
    fee: j.fee,
    salary: j.salary,
    location: j.location,
    state: j.state,
    tab: j.tab,
    department: j.department,
    officialUrl: j.officialUrl,
    notificationPdf: j.notificationPdf,
  }))
}

type GovtJobRow = GovtJob & { last_date: string; age_range: string }

/**
 * Normalise a raw notification into a fully-enriched GovtJob:
 * generates a unique SEO slug, taxonomy tags and a complete article + detail
 * sections so the imported job is immediately publishable as its own SEO page.
 */
function normalise(raw: Partial<GovtJobRow>, source: GovtSource): GovtJob {
  const base: GovtJobRow = {
    id: raw.id || `${source.id}-${Date.now()}`,
    title: raw.title || "Untitled Notification",
    org: raw.org || source.label,
    short: raw.short || (raw.org || source.label).slice(0, 4).toUpperCase(),
    post: raw.post || "",
    vacancies: raw.vacancies || "TBA",
    qualification: raw.qualification || "",
    lastDate: raw.lastDate || "TBA",
    last_date: raw.last_date || raw.lastDate || "TBA",
    ageRange: raw.ageRange || "-",
    age_range: raw.age_range || raw.ageRange || "-",
    fee: raw.fee || "-",
    salary: raw.salary || "-",
    location: raw.location || "All India",
    state: raw.state || "All India",
    tab: raw.tab || source.defaultTab,
    department: raw.department || raw.org || source.label,
    color: raw.color || "#1e3a8a",
    badge: raw.badge || "New",
    status: "active",
    jobStatus: "LIVE_JOB",
    postedAt: new Date().toISOString(),
    notificationPdf: raw.notificationPdf || raw.notificationUrl,
    officialUrl: raw.officialUrl || source.url,
  }
  // Auto-tag against sector config + auto-generate the article / SEO sections.
  const enriched = enrichGovtJob(base)
  // Honour explicit sector tags declared on the source.
  if (source.sectors?.length) {
    enriched.categoryTags = Array.from(new Set([...(enriched.categoryTags || []), ...source.sectors]))
  }
  return enriched
}

async function persist(jobs: GovtJob[]): Promise<number> {
  if (!isSupabaseConfigured() || jobs.length === 0) return 0
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin")
    const rows = jobs.map(j => ({
      id: j.id,
      slug: j.slug,
      title: j.title,
      org: j.org,
      short: j.short,
      post: j.post,
      vacancies: j.vacancies,
      qualification: j.qualification,
      age_range: j.ageRange,
      fee: j.fee,
      last_date: j.lastDate,
      start_date: j.startDate,
      salary: j.salary,
      location: j.location,
      state: j.state,
      state_slug: j.stateSlug,
      tab: j.tab,
      department: j.department,
      experience: j.experience,
      category_tags: j.categoryTags,
      qualification_tags: j.qualificationTags,
      color: j.color,
      badge: j.badge,
      status: j.status,
      job_status: j.jobStatus,
      notification_pdf: j.notificationPdf,
      apply_url: j.applyUrl,
      official_url: j.officialUrl,
      overview: j.overview,
      vacancy_breakup: j.vacancyBreakup,
      eligibility: j.eligibility,
      age_limit: j.ageLimit,
      salary_details: j.salaryDetails,
      selection_process: j.selectionProcess,
      fee_details: j.feeDetails,
      exam_pattern: j.examPattern,
      syllabus_content: j.syllabusContent,
      important_dates: j.importantDates,
      faqs: j.faqs,
      article: j.article,
      source_id: undefined as string | undefined,
      published: SCHEDULER_CONFIG.autoPublish,
    }))
    const { error } = await supabaseAdmin.from("govt_jobs").upsert(rows as never, { onConflict: "id" })
    return error ? 0 : jobs.length
  } catch {
    return 0
  }
}

/** Run one ingestion pass across all enabled sources. */
export async function runGovtAutoUpdate(): Promise<AutoUpdateResult> {
  const seen = new Set<string>()
  const report: AutoUpdateResult["sources"] = []
  let totalPublished = 0

  for (const source of GOVT_SOURCES.filter(s => s.enabled)) {
    let fetched = 0, skipped = 0
    const toPublish: GovtJob[] = []
    try {
      const raws = (await fetchFromSource(source)).slice(0, SCHEDULER_CONFIG.maxPerSourcePerRun)
      fetched = raws.length
      for (const raw of raws) {
        const job = normalise(raw, source)
        if (seen.has(job.id)) { skipped++; continue }
        seen.add(job.id)
        toPublish.push(job)
      }
    } catch {
      // a single bad source should never break the whole run
    }
    const published = SCHEDULER_CONFIG.autoPublish ? await persist(toPublish) : 0
    totalPublished += published
    report.push({ id: source.id, label: source.label, fetched, published, skipped })
  }

  return {
    ranAt: new Date().toISOString(),
    autoPublish: SCHEDULER_CONFIG.autoPublish,
    sources: report,
    totalPublished,
  }
}
