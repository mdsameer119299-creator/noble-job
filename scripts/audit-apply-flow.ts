/**
 * audit-apply-flow.ts — READ-ONLY diagnostic for the "no Apply Now" / "empty
 * homepage column" production report (fix/production-inventory-and-stale-pages).
 *
 * Prints, for every currently-ACTIVE row in `jobs`, `wfh_jobs` and `abroad_jobs`:
 *   - the raw stored provenance / employer_id / status / job_status / is_verified
 *   - what the fail-closed classifier (src/lib/jobs/provenance.ts) resolves them
 *     to TODAY, using the REAL stored provenance (unlike audit-jobs-provenance.ts,
 *     which previews a backfill by ignoring the stored value)
 *   - whether the row is genuine, renderable, listable (homepage-eligible) and
 *     actionable (Apply Now-eligible) under the exact same code the app runs
 *
 * This answers, with certainty, the one question code inspection alone cannot:
 * do the production rows actually carry `provenance = 'EMPLOYER'` + a real
 * `employer_id`? If yes and Apply Now still doesn't render, that is a genuine
 * code regression to re-open. If no, the code is correctly declining to show an
 * Apply Now it cannot vouch for, and the fix is a data/ops one (re-link the row
 * to its employer, or correct its provenance), not a code change.
 *
 * Writes NOTHING. Never touches Production state.
 *
 *   npx tsx scripts/audit-apply-flow.ts
 *
 * Requires .env.local (or env): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import fs from "node:fs"
import path from "node:path"
import { classifyProvenance, isGenuine, isOpen } from "../src/lib/jobs/provenance"
import { isActionableJob, isListableJob, isRenderableJob } from "../src/lib/jobs/renderable"
import { applyRouteFor } from "../src/lib/jobs/applyRoute"

const envPath = path.join(process.cwd(), ".env.local")
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf8").replace(/^﻿/, "")
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "")
  }
}

type Board = "private" | "wfh" | "abroad"
const TABLES: Record<Board, string> = { private: "jobs", wfh: "wfh_jobs", abroad: "abroad_jobs" }

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes("placeholder") || url.includes("your-project")) {
    console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. This script is READ-ONLY and never writes.")
    process.exitCode = 1
    return
  }
  const { createClient } = await import("@supabase/supabase-js")
  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  for (const board of ["private", "wfh", "abroad"] as Board[]) {
    const table = TABLES[board]
    const { data, error } = await sb.from(table).select("*").eq("status", "active").order("posted_at", { ascending: false })
    console.log(`\n=== ${table} (status='active') ===`)
    if (error) {
      console.log(`  ✗ query failed: ${error.message}`)
      continue
    }
    const rows = (data || []) as Record<string, unknown>[]
    console.log(`  ${rows.length} active row(s)\n`)
    for (const r of rows) {
      const str = (v: unknown): string | null => (v == null ? null : String(v))
      const rec = {
        id: str(r.id) ?? "",
        board,
        provenance: str(r.provenance),
        source: str(r.source),
        apply_url: str(r.apply_url),
        employer_id: str(r.employer_id),
        is_verified: Boolean(r.is_verified),
        status: str(r.status),
        job_status: str(r.job_status),
        title: str(r.title),
        company: str(r.company),
        description: str(r.description),
        location: str(r.location),
        country: str(r.country),
      }
      const resolvedProvenance = classifyProvenance(rec)
      console.log(`  • ${rec.id}  "${String(rec.title ?? "").slice(0, 48)}"  (${rec.company ?? "no company"})`)
      console.log(`      stored provenance=${JSON.stringify(rec.provenance)}  employer_id=${JSON.stringify(rec.employer_id)}  is_verified=${JSON.stringify(rec.is_verified)}  source=${JSON.stringify(rec.source)}  apply_url=${JSON.stringify(rec.apply_url)}`)
      console.log(`      resolved provenance=${resolvedProvenance}  genuine=${isGenuine(rec)}  open=${isOpen(rec)}  renderable=${isRenderableJob(rec, board)}  listable(homepage)=${isListableJob(rec, board)}  actionable(ApplyNow)=${isActionableJob(rec, board)}  applyRoute=${applyRouteFor(board, rec)}`)
      if (resolvedProvenance === "EMPLOYER" && !isActionableJob(rec, board)) {
        console.log(`      ⚠ provenance is EMPLOYER but the row is NOT actionable — inspect employer_id/status/job_status above, this is the exact case to escalate as a real regression.`)
      }
    }
  }
  console.log(`\nNo changes were made. This audit is strictly read-only.`)
}

main().catch(e => {
  console.error(e)
  process.exitCode = 1
})
