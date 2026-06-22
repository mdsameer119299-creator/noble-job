/**
 * run-ingestion.ts — execute one full govt-jobs ingestion pass and print the
 * per-source breakdown (fetched / published / skipped / error). Writes to the
 * configured Supabase DB exactly like the daily cron. Use to verify which
 * adapters actually return data from THIS host's network.
 *
 *   npx tsx scripts/run-ingestion.ts
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
  console.log("Running full ingestion pass (writes to Supabase)…\n")
  const r = await runGovtAutoUpdate()
  console.log(`ranAt=${r.ranAt}  autoPublish=${r.autoPublish}`)
  console.log(`sourcesChecked=${r.sourcesChecked}  totalPublished=${r.totalPublished}  totalExpired=${r.totalExpired}`)
  console.log(`failedSources=[${r.failedSources.join(", ")}]\n`)
  console.log("Per-source:")
  console.log("  id".padEnd(20), "fetched".padStart(8), "published".padStart(10), "skipped".padStart(8), "  error")
  for (const s of r.sources.sort((a, b) => b.fetched - a.fetched || a.id.localeCompare(b.id))) {
    console.log(
      `  ${s.id.padEnd(18)}`,
      String(s.fetched).padStart(8),
      String(s.published).padStart(10),
      String(s.skipped).padStart(8),
      s.error ? `  ⚠ ${s.error}` : "",
    )
  }
}

main().catch(e => { console.error(e); process.exit(1) })
