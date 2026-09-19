/**
 * run-job-lifecycle.ts — apply the job expiry lifecycle to private / WFH / abroad
 * jobs. Run by GitHub Actions (.github/workflows/job-lifecycle.yml) — NOT by a
 * Vercel cron: the site is hosted on Hostinger, where vercel.json crons never run.
 *
 *   npx tsx scripts/run-job-lifecycle.ts            # apply
 *   npx tsx scripts/run-job-lifecycle.ts --dry-run  # report only, write nothing
 *
 * What it does (rules in src/lib/services/jobExpiryPlan.ts):
 *   • closes an ACTIVE job whose employer-supplied `application_deadline` has passed
 *   • sets NobleJob's internal `review_due_at` where it is missing
 *   • reports jobs whose review is due (needs employer/source confirmation)
 *   • closes silent jobs only if JOB_AUTO_CLOSE_GRACE_DAYS is set (default: never)
 * It never invents an `application_deadline` and never writes `review_due_at`
 * into it.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY.
 * If migration 20260727000002 (lifecycle columns) has not been applied the run
 * exits 0 with a warning — there is nothing to do until it is.
 *
 * Exit code: 0 on success / nothing to do; 1 on a database failure.
 */
import "./setupWebSocket"
import fs from "node:fs"
import path from "node:path"
import { isMissingColumnError } from "../src/lib/supabase/columnErrors"
import { jobAutoCloseGraceDays, jobReviewIntervalDays } from "../src/lib/config/jobLifecycleConfig"
import {
  buildCloseUpdate,
  planLifecycleActions,
  type LifecycleAction,
  type LifecycleRow,
  type LifecycleTable,
} from "../src/lib/services/jobExpiryPlan"

const envPath = path.join(process.cwd(), ".env.local")
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf8").replace(/^﻿/, "")
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "")
  }
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL
}

const DRY_RUN = process.argv.includes("--dry-run")
const TABLES: LifecycleTable[] = ["jobs", "wfh_jobs", "abroad_jobs"]
const COLUMNS = "id, status, posted_at, application_deadline, review_due_at, last_confirmed_open_at, closed_at"
const PAGE = 1000

function summary(md: string) {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n")
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) throw new Error("Missing DB secrets: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  const now = new Date()
  const cfg = { reviewIntervalDays: jobReviewIntervalDays(), autoCloseGraceDays: jobAutoCloseGraceDays() }
  console.log(
    `${DRY_RUN ? "[DRY RUN] " : ""}Job lifecycle @ ${now.toISOString()} — review interval ${cfg.reviewIntervalDays}d, ` +
      `auto-close for silence: ${cfg.autoCloseGraceDays === undefined ? "off" : `after ${cfg.autoCloseGraceDays}d grace`}`,
  )
  summary(`## Job lifecycle — ${now.toISOString()}${DRY_RUN ? " (dry run)" : ""}`)
  summary("| Table | Active scanned | Closed | Review scheduled | Review due |")
  summary("|---|--:|--:|--:|--:|")

  let hadError = false
  for (const table of TABLES) {
    // Page through ACTIVE rows only.
    const rows: LifecycleRow[] = []
    let columnsMissing = false
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from(table)
        .select(COLUMNS)
        .eq("status", "active")
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) {
        if (isMissingColumnError(error)) {
          columnsMissing = true
        } else {
          console.error(`❌ ${table}: ${error.message}`)
          hadError = true
        }
        break
      }
      rows.push(...((data ?? []) as unknown as LifecycleRow[]))
      if (!data || data.length < PAGE) break
    }
    if (columnsMissing) {
      console.warn(`::warning::${table}: lifecycle columns not present — apply migration 20260727000002_job_lifecycle_foundation.sql. Skipped.`)
      summary(`| ${table} | — | — | — | — (migration not applied) |`)
      continue
    }
    if (hadError && rows.length === 0) continue

    const actions = planLifecycleActions(rows, now, cfg)
    const closes = actions.filter((a): a is Extract<LifecycleAction, { kind: "close" }> => a.kind === "close")
    const schedules = actions.filter((a): a is Extract<LifecycleAction, { kind: "schedule_review" }> => a.kind === "schedule_review")
    const dues = actions.filter(a => a.kind === "review_due")

    let closed = 0
    let scheduled = 0
    if (!DRY_RUN) {
      for (const a of closes) {
        // `.eq("status","active")` keeps this idempotent and race-safe with an employer's own change.
        const { error } = await db.from(table).update(buildCloseUpdate(now)).eq("id", a.id).eq("status", "active")
        if (error) { console.error(`❌ ${table}/${a.id} close: ${error.message}`); hadError = true } else closed++
      }
      for (const a of schedules) {
        const { error } = await db.from(table).update({ review_due_at: a.reviewDueAt }).eq("id", a.id).is("review_due_at", null)
        if (error) { console.error(`❌ ${table}/${a.id} schedule: ${error.message}`); hadError = true } else scheduled++
      }
    }
    console.log(
      `${table}: scanned ${rows.length} active · ${DRY_RUN ? `would close ${closes.length}` : `closed ${closed}/${closes.length}`}` +
        ` · ${DRY_RUN ? `would schedule ${schedules.length}` : `review scheduled ${scheduled}/${schedules.length}`}` +
        ` · review due ${dues.length}`,
    )
    for (const a of closes.slice(0, 20)) console.log(`   close ${a.id} (${a.reason})`)
    summary(`| ${table} | ${rows.length} | ${DRY_RUN ? closes.length + " (would)" : closed} | ${DRY_RUN ? schedules.length + " (would)" : scheduled} | ${dues.length} |`)
  }
  if (hadError) process.exitCode = 1
}

main().catch(e => {
  console.error(`❌ job lifecycle failed: ${(e as Error).message}`)
  process.exit(1)
})
