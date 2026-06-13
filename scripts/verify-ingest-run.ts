/**
 * verify-ingest-run.ts — one-off LOCAL verification of the ingestion pipeline.
 *
 * Runs a single runGovtAutoUpdate() pass against the configured Supabase DB
 * (publishes new jobs, expires stale ones, records one ingest_runs row) — the
 * identical, idempotent operation the hourly cron performs on Vercel — then
 * reads back the freshly recorded ingest_runs row to confirm recording works.
 *
 * This is verification tooling, NOT a deployment path: it is not wired into any
 * workflow. Architecture A (GitHub Actions → Vercel endpoint) remains the runner.
 *
 *   tsx scripts/verify-ingest-run.ts
 *
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY.
 */
import fs from "node:fs"
import path from "node:path"

const envPath = path.join(process.cwd(), ".env.local")
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf8").replace(/^﻿/, "")
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "")
  }
}

async function main() {
  const { runGovtAutoUpdate } = await import("@/lib/services/govtAutoUpdate")
  console.log("Running one ingestion pass against the live DB…\n")
  const result = await runGovtAutoUpdate()
  console.log("=== runGovtAutoUpdate result ===")
  console.log(JSON.stringify(result, null, 2))

  // Read back the latest ingest_runs row to confirm recording succeeded.
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await db
    .from("ingest_runs")
    .select("id, source_id, trigger, status, started_at, finished_at, duration_ms, fetched, inserted, skipped, expired, error")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  console.log("\n=== latest ingest_runs row (recording check) ===")
  if (error) {
    console.error(`RECORDING NOT CONFIRMED — ingest_runs read failed: ${error.message}`)
    process.exit(1)
  }
  console.log(JSON.stringify(data, null, 2))
  console.log(data ? "\n✓ Recording confirmed: a row was written." : "\n✗ No ingest_runs row found.")
}

main().catch(e => { console.error(e); process.exit(1) })
