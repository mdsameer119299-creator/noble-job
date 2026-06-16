/**
 * inspect-ingest-runs.ts — READ-ONLY inspector for the ingestion audit log.
 *
 * Confirms that ingest_runs rows are being recorded and shows the latest runs.
 *   tsx scripts/inspect-ingest-runs.ts
 *
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Writes nothing.
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
  const { createClient } = await import("@supabase/supabase-js")
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  const { count, error: cErr } = await db.from("ingest_runs").select("*", { count: "exact", head: true })
  if (cErr) { console.error("ingest_runs query failed:", cErr.message); process.exit(1) }
  console.log(`ingest_runs total rows: ${count ?? 0}`)

  const { data, error } = await db
    .from("ingest_runs")
    .select("id, source_id, trigger, status, started_at, finished_at, duration_ms, fetched, inserted, skipped, expired, error")
    .order("started_at", { ascending: false })
    .limit(8)
  if (error) { console.error("latest query failed:", error.message); process.exit(1) }

  console.log(`\nLatest ${data?.length ?? 0} runs:`)
  for (const r of data ?? []) {
    console.log(JSON.stringify(r))
  }
}

main().catch(e => { console.error(e); process.exit(1) })
