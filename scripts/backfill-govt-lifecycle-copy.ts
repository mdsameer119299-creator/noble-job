/**
 * One-time, idempotent repair for STALE generated lifecycle copy on
 * result / admit_card / answer_key govt_jobs rows.
 *
 * Context: PR #48 fixed the TEMPLATE (generateGovtArticle / buildDates /
 * buildGovtJobLinkButtons / GovtHowToApply.tsx) so any NEWLY-generated
 * record gets lifecycle-appropriate copy (no "Apply Online" CTA, no "last
 * date to apply" FAQ, no "Last Date to Apply" row on a result/admit/answer
 * page). But `overview`, `faqs`, `important_dates` and `article` are
 * PERSISTED columns — enrichGovtJob() only ever backfills them via `||`
 * when empty (see src/lib/data/govtData.ts), so existing rows seeded BEFORE
 * the fix still render their old, apply-oriented text verbatim, and
 * `job.faqs` feeds the page's FAQPage JSON-LD schema directly
 * (GovtJobJsonLd.tsx) — so the stale text isn't just a display issue, it's
 * also in the structured data shown to search engines.
 *
 * This script re-runs generateGovtArticle() (the now-fixed generator)
 * against each result/admit_card/answer_key row and OVERWRITES ONLY:
 *   overview, faqs, important_dates, article
 * Never touched: vacancies, vacancy_breakup, official/apply/result/admit/
 * answer URLs, last_date, exam_date, status, record_type, or any other
 * source-backed field.
 *
 * Narrowly scoped and idempotent: a row is only included in the diff/update
 * when the regenerated value actually differs from what's stored, and a
 * re-run after applying produces an empty diff.
 *
 * Usage:
 *   npx tsx scripts/backfill-govt-lifecycle-copy.ts              # DRY RUN (default) — prints before/after diff, writes nothing
 *   npx tsx scripts/backfill-govt-lifecycle-copy.ts --apply      # LIVE — writes the diffed rows
 *
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import fs from "node:fs"
import path from "node:path"

const envPath = path.join(process.cwd(), ".env.local")
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf8").replace(/^﻿/, "")
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "")
    }
  }
}

const apply = process.argv.includes("--apply")

type Row = {
  id: string
  title: string | null
  overview: string | null
  faqs: unknown
  important_dates: unknown
  article: string | null
}

function jsonEq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

async function main() {
  const { isSupabaseAdminConfigured } = await import("@/lib/supabase/config")
  const { supabaseAdmin } = await import("@/lib/supabase/admin")
  const { mapRow } = await import("@/lib/services/govtRowMapper")
  const { generateGovtArticle } = await import("@/lib/services/govtArticle")

  if (!isSupabaseAdminConfigured()) {
    console.error(
      "[backfill] Supabase not configured — set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local",
    )
    process.exitCode = 1
    return
  }

  const { data, error } = await supabaseAdmin
    .from("govt_jobs")
    .select("*")
    .in("record_type", ["result", "admit_card", "answer_key"])

  if (error) {
    console.error("[backfill] query failed:", error.message)
    process.exitCode = 1
    return
  }

  const rows = (data ?? []) as Row[]
  console.log(`[backfill] ${rows.length} result/admit_card/answer_key row(s) found`)

  const diffs: { id: string; title: string | null; changed: string[] }[] = []
  const updates: { id: string; patch: Record<string, unknown> }[] = []

  for (const row of rows) {
    const mapped = mapRow(row as never)
    const gen = generateGovtArticle(mapped)

    const patch: Record<string, unknown> = {}
    const changed: string[] = []

    if (!jsonEq(row.overview, gen.overview)) {
      changed.push("overview")
      patch.overview = gen.overview
    }
    if (!jsonEq(row.faqs, gen.faqs)) {
      changed.push("faqs")
      patch.faqs = gen.faqs
    }
    if (!jsonEq(row.important_dates, gen.importantDates)) {
      changed.push("important_dates")
      patch.important_dates = gen.importantDates
    }
    if (!jsonEq(row.article, gen.article)) {
      changed.push("article")
      patch.article = gen.article
    }

    if (changed.length) {
      diffs.push({ id: row.id, title: row.title, changed })
      updates.push({ id: row.id, patch })
      console.log(`\n--- ${row.id} (${row.title}) ---`)
      for (const field of changed) {
        console.log(`  [${field}]`)
        console.log(`    BEFORE: ${JSON.stringify((row as Record<string, unknown>)[field])}`)
        console.log(`    AFTER:  ${JSON.stringify(patch[field])}`)
      }
    }
  }

  console.log(`\n[backfill] ${diffs.length}/${rows.length} row(s) need a repair: ${diffs.map(d => d.id).join(", ") || "(none)"}`)

  if (!apply) {
    console.log("[backfill] DRY RUN — no writes made. Re-run with --apply to write the rows listed above.")
    return
  }

  if (!diffs.length) {
    console.log("[backfill] nothing to apply.")
    return
  }

  let okCount = 0
  for (const u of updates) {
    const { error: updErr } = await supabaseAdmin.from("govt_jobs").update(u.patch as never).eq("id", u.id)
    if (updErr) {
      console.error(`[backfill] FAILED to update ${u.id}: ${updErr.message}`)
      process.exitCode = 1
    } else {
      okCount++
    }
  }
  console.log(`[backfill] LIVE complete — updated ${okCount}/${updates.length} row(s)`)
}

main().catch(e => {
  console.error(e)
  process.exitCode = 1
})
