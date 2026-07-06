/**
 * audit-jobs-provenance.ts — READ-ONLY pre-migration audit.
 *
 * Reports how the rows in the `jobs` table WOULD be classified by the
 * fail-closed classifier (src/lib/jobs/provenance.ts) before the
 * 20260707000001_jobs_provenance migration is applied. Writes NOTHING.
 *
 *   tsx scripts/audit-jobs-provenance.ts
 *
 * Requires .env.local (or env): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Use this to preview the impact of the migration backfill and to spot rows that
 * would become UNCLASSIFIED (and therefore non-indexable) so they can be
 * explicitly stamped before rollout.
 */
import fs from "node:fs"
import path from "node:path"
import { classifyProvenance, isGenuine, type Provenance } from "../src/lib/jobs/provenance"

// ── Load .env.local without adding a dependency ──────────────────────────
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

type JobRow = {
  id: string
  provenance: string | null
  source: string | null
  board: string | null
  apply_url: string | null
  employer_id: string | null
  is_verified: boolean | null
  job_status: string | null
  status: string | null
}

const BUCKETS: Provenance[] = [
  "EMPLOYER",
  "AGGREGATED",
  "CURATED",
  "OFFICIAL",
  "SYNTHETIC",
  "UNCLASSIFIED",
]

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes("placeholder") || url.includes("your-project")) {
    console.error(
      "✗ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. " +
        "Set them in .env.local. This script is READ-ONLY and never writes.",
    )
    process.exitCode = 1
    return
  }

  const { createClient } = await import("@supabase/supabase-js")
  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  // READ-ONLY: a single paged SELECT. No insert/update/delete anywhere.
  const PAGE = 1000
  const rows: JobRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("jobs")
      .select("id, provenance, source, board, apply_url, employer_id, is_verified, job_status, status")
      .range(from, from + PAGE - 1)
    if (error) {
      console.error("✗ Query failed:", error.message)
      process.exitCode = 1
      return
    }
    const batch = (data || []) as JobRow[]
    rows.push(...batch)
    if (batch.length < PAGE) break
  }

  const projected = new Map<Provenance, string[]>(BUCKETS.map(b => [b, []]))
  const storedCounts = new Map<string, number>()
  let genuineCount = 0
  let activeGenuine = 0

  for (const r of rows) {
    const stored = (r.provenance ?? "NULL").toString().toUpperCase()
    storedCounts.set(stored, (storedCounts.get(stored) || 0) + 1)

    const p = classifyProvenance({
      id: r.id,
      // Ignore any stored value so we preview the evidence-based backfill result.
      provenance: undefined,
      source: r.source,
      board: r.board,
      apply_url: r.apply_url,
      employer_id: r.employer_id,
      is_verified: r.is_verified,
      job_status: r.job_status,
    })
    projected.get(p)!.push(r.id)

    const genuine = isGenuine({
      id: r.id,
      provenance: undefined,
      source: r.source,
      board: r.board,
      apply_url: r.apply_url,
      employer_id: r.employer_id,
      is_verified: r.is_verified,
      job_status: r.job_status,
    })
    if (genuine) {
      genuineCount++
      if (r.status === "active") activeGenuine++
    }
  }

  const total = rows.length
  console.log(`\n=== jobs.provenance pre-migration audit (READ-ONLY) ===`)
  console.log(`Total jobs rows: ${total}\n`)

  console.log(`Currently STORED provenance:`)
  for (const [k, v] of [...storedCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(14)} ${v}`)
  }

  console.log(`\nPROJECTED provenance after fail-closed backfill:`)
  for (const b of BUCKETS) {
    const ids = projected.get(b)!
    const pct = total ? ((ids.length / total) * 100).toFixed(1) : "0.0"
    const sample = ids.slice(0, 5).join(", ")
    console.log(`  ${b.padEnd(14)} ${String(ids.length).padStart(6)}  (${pct}%)${sample ? `  e.g. ${sample}` : ""}`)
  }

  const uncl = projected.get("UNCLASSIFIED")!.length
  console.log(`\nGenuine (would pass the publication gate): ${genuineCount}  (active: ${activeGenuine})`)
  console.log(`Would become UNCLASSIFIED (non-indexable): ${uncl}`)
  if (uncl > 0) {
    console.log(
      `\n⚠  ${uncl} row(s) lack sufficient evidence and would be UNCLASSIFIED. ` +
        `Review the sample IDs and explicitly stamp any that are genuinely real ` +
        `before/after applying the migration.`,
    )
  }
  console.log(`\nNo changes were made. This audit is strictly read-only.`)
}

main().catch(e => {
  console.error(e)
  process.exitCode = 1
})
