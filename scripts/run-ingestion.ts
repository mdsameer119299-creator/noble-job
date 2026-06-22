/**
 * run-ingestion.ts — execute one full govt-jobs ingestion pass and report
 * fetched / inserted / updated / skipped / failed per source. Writes to the
 * configured Supabase DB exactly like the cron. Used by GitHub Actions
 * (.github/workflows/govt-ingestion.yml) and for local verification.
 *
 *   npx tsx scripts/run-ingestion.ts
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY.
 * In CI these come from GitHub Secrets; locally from .env.local.
 *
 * Exit code: 0 on success; 1 only on a SYSTEMIC failure (the run threw, or zero
 * jobs were published while adapters were enabled) so GitHub flags genuine
 * breakage — routine single-portal hiccups are reported but don't fail the job.
 */
// MUST be first: polyfill WebSocket for supabase-js on Node 20 (GitHub Actions).
import "./setupWebSocket"
import fs from "node:fs"
import path from "node:path"

// Load .env.local locally (no-op in CI where vars come from the environment).
const envPath = path.join(process.cwd(), ".env.local")
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf8").replace(/^﻿/, "")
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "")
  }
}
// Accept SUPABASE_URL as an alias for the app's NEXT_PUBLIC_SUPABASE_URL so the
// GitHub Secret can use the shorter name requested in the runbook.
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL
}

const SUMMARY = process.env.GITHUB_STEP_SUMMARY // set by GitHub Actions
function summary(md: string) {
  if (SUMMARY) fs.appendFileSync(SUMMARY, md + "\n")
}

async function rowCount(): Promise<number | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { count } = await db.from("govt_jobs").select("id", { count: "exact", head: true })
  return count ?? null
}

async function main() {
  const { runGovtAutoUpdate } = await import("@/lib/services/govtAutoUpdate")
  console.log("Running full ingestion pass (writes to Supabase)…\n")

  const before = await rowCount()
  const r = await runGovtAutoUpdate()
  const after = await rowCount()

  // Row count only grows on insert (upsert of an existing id is in-place;
  // expiry flips status, never deletes). So new rows = inserted; the remainder
  // of totalPublished were content refreshes (updates).
  const inserted = before != null && after != null ? Math.max(0, after - before) : null
  const updated = inserted != null ? Math.max(0, r.totalPublished - inserted) : null
  const totalFetched = r.sources.reduce((s, x) => s + x.fetched, 0)

  const head =
    `ranAt=${r.ranAt}\n` +
    `sourcesChecked=${r.sourcesChecked}  fetched=${totalFetched}  published=${r.totalPublished}` +
    (inserted != null ? `  inserted=${inserted}  updated=${updated}` : "") +
    `  expired=${r.totalExpired}\n` +
    `failedSources=[${r.failedSources.join(", ") || "none"}]`
  console.log(head + "\n")

  console.log("Per-source:")
  console.log("  " + "id".padEnd(18), "fetched".padStart(8), "published".padStart(10), "skipped".padStart(8), "  status")
  const rows = r.sources.sort((a, b) => b.published - a.published || b.fetched - a.fetched || a.id.localeCompare(b.id))
  for (const s of rows) {
    console.log(
      `  ${s.id.padEnd(18)}`,
      String(s.fetched).padStart(8),
      String(s.published).padStart(10),
      String(s.skipped).padStart(8),
      s.error ? `  ⚠ ${s.error}` : "  ok",
    )
  }

  // GitHub Actions step summary (Markdown).
  summary(`## 🛰️ Govt Jobs Ingestion — ${new Date().toISOString()}`)
  summary("")
  summary(`- **Fetched:** ${totalFetched}`)
  summary(`- **Published (upserted):** ${r.totalPublished}` + (inserted != null ? ` — 🆕 ${inserted} inserted, ♻️ ${updated} updated` : ""))
  summary(`- **Expired:** ${r.totalExpired}`)
  summary(`- **Failed adapters:** ${r.failedSources.length ? "⚠️ " + r.failedSources.join(", ") : "✅ none"}`)
  summary("")
  summary("| Source | Fetched | Published | Skipped | Status |")
  summary("|---|--:|--:|--:|---|")
  for (const s of rows) {
    summary(`| ${s.id} | ${s.fetched} | ${s.published} | ${s.skipped} | ${s.error ? "⚠️ " + s.error.slice(0, 60) : "✅"} |`)
  }

  // Systemic-failure detection → non-zero exit triggers GitHub failure alerts.
  if (r.totalPublished === 0 && r.sources.length > 0) {
    console.error("\nSYSTEMIC FAILURE: 0 jobs published across all adapters.")
    process.exit(1)
  }
}

main().catch(e => {
  console.error(e)
  summary(`## ❌ Govt Jobs Ingestion FAILED\n\n\`\`\`\n${(e as Error).message}\n\`\`\``)
  process.exit(1)
})
