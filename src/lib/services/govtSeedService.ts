/**
 * govtSeedService.ts — dedicated, idempotent seeding helper for the curated
 * real govt_jobs set (Phase 1A). Intentionally separate from govtAutoUpdate.ts
 * so the cron ingestion path is untouched; it reuses enrichGovtJob and mirrors
 * persist()'s column mapping.
 */
import { enrichGovtJob } from "@/lib/data/govtData"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { isGovtJobExpired } from "@/lib/utils/govtJobExpiry"
import { REAL_GOVT_SEED, SEED_IDS } from "@/lib/data/govtSeed"
import type { GovtJob } from "@/types/govtJob"

/** Provenance tag written to every seeded row — the rollback/identification handle. */
export const SEED_SOURCE_ID = "seed:curated-v1"

const ALLOW_LIST = new Set<string>(SEED_IDS)

/** Mirrors persist() in govtAutoUpdate.ts, plus the seed-specific overrides. */
function mapSeedJobToRow(j: GovtJob) {
  return {
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
    // ── seed-specific ──
    source_id: SEED_SOURCE_ID,
    published: true,
  }
}

export interface SeedResult {
  attempted: number
  ids: string[]
  skippedExpired: string[]
  upserted: number
  dryRun: boolean
}

/**
 * Enrich + idempotently upsert the curated seed (onConflict:"id").
 * Throws on any guardrail violation or DB error. Prints exact ids before write.
 */
export async function seedCuratedGovtJobs(opts: { dryRun?: boolean } = {}): Promise<SeedResult> {
  const dryRun = opts.dryRun === true

  // Guardrail 4 (pre): nothing outside the allow-list may proceed.
  const preOffenders = REAL_GOVT_SEED.filter(j => !ALLOW_LIST.has(j.id))
  if (preOffenders.length) {
    throw new Error(`[seed] aborting — non-allow-listed ids in REAL_GOVT_SEED: ${preOffenders.map(j => j.id).join(", ")}`)
  }

  // Safety gate: never seed an entry whose window has since closed.
  const skippedExpired: string[] = []
  const enriched = REAL_GOVT_SEED
    .filter(j => {
      const expired = j.status === "expired" || isGovtJobExpired(j.lastDate)
      if (expired) skippedExpired.push(j.id)
      return !expired
    })
    .map(enrichGovtJob)

  // Guardrail 4 (post): enrichment must not move an id out of the allow-list.
  const postOffenders = enriched.filter(j => !ALLOW_LIST.has(j.id))
  if (postOffenders.length) {
    throw new Error(`[seed] aborting — enrichment produced non-allow-listed ids: ${postOffenders.map(j => j.id).join(", ")}`)
  }

  const rows = enriched.map(mapSeedJobToRow)
  const ids = rows.map(r => r.id)

  // Guardrail 5: report the exact ids BEFORE any write.
  console.log(`\n[seed] mode=${dryRun ? "DRY-RUN" : "LIVE"}  rows=${ids.length}  source_id=${SEED_SOURCE_ID}`)
  for (const id of ids) console.log(`  • ${id}`)
  if (skippedExpired.length) console.log(`[seed] skipped (expired since audit): ${skippedExpired.join(", ")}`)

  if (dryRun) return { attempted: ids.length, ids, skippedExpired, upserted: 0, dryRun }

  if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  throw new Error(
    "[seed] Supabase not configured — set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local"
  )
}
  const { supabaseAdmin } = await import("@/lib/supabase/admin")
  const { error } = await supabaseAdmin.from("govt_jobs").upsert(rows as never, { onConflict: "id" })
  if (error) throw new Error(`[seed] upsert failed: ${error.message}`)

  return { attempted: ids.length, ids, skippedExpired, upserted: ids.length, dryRun }
}
