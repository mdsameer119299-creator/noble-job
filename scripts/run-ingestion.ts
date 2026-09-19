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

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  return { url, key }
}

/**
 * Fail fast with an actionable message if the DB is unreachable, misconfigured,
 * or rejecting requests (bad key, or a Supabase-side restriction such as an
 * exceeded egress/usage quota — same "Invalid API key"-shaped error either way),
 * BEFORE polling ~20 adapters. Without this the run scrapes everything and then
 * silently writes nothing, with the real cause visible nowhere.
 */
async function preflight(): Promise<void> {
  const { url, key } = adminClient()
  if (!url || !key) {
    throw new Error("Missing DB secrets: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
  }
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error } = await db.from("govt_jobs").select("id", { count: "exact", head: true })
  if (error) {
    const host = (() => { try { return new URL(url).host } catch { return "(invalid URL)" } })()
    console.error(`❌ DB preflight failed: ${error.message || "(empty error — almost always a bad apikey or a restricted project)"}`)
    console.error(`   URL host: ${host}`)
    console.error(`   service key length: ${key.length} (legacy keys start with "eyJ"; new ones with "sb_secret_")`)
    console.error("   Common causes, in order of likelihood:")
    console.error("     • Supabase project restricted (e.g. exceeded egress/usage quota) — check the project dashboard")
    console.error("     • SUPABASE_SERVICE_ROLE_KEY is wrong/stale/whitespace-corrupted in GitHub Secrets")
    console.error("     • SUPABASE_URL doesn't belong to the same project as that key")
    throw new Error(`DB preflight failed: ${error.message || "Invalid API key"}`)
  }
  console.log(`✓ DB preflight OK (${(() => { try { return new URL(url).host } catch { return url } })()})`)
}

async function rowCount(): Promise<number | null> {
  const { url, key } = adminClient()
  if (!url || !key) return null
  try {
    const { createClient } = await import("@supabase/supabase-js")
    const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    const { count, error } = await db.from("govt_jobs").select("id", { count: "exact", head: true })
    if (error) { console.error(`[rowCount] ${error.message}`); return null }
    return count ?? null
  } catch (e) {
    console.error(`[rowCount] threw: ${(e as Error).message}`)
    return null
  }
}

async function main() {
  await preflight() // fail fast on bad/missing/restricted DB credentials before scraping ~20 adapters
  const { runGovtAutoUpdate } = await import("@/lib/services/govtAutoUpdate")
  console.log("Running full ingestion pass (writes to Supabase)…\n")

  const r = await runGovtAutoUpdate()

  // The ingestion now compares `content_hash` before writing, so it reports exact
  // counts itself: unchanged rows are NOT written (and do not bump content_changed_at).
  const inserted = r.totalInserted
  const updated = r.totalUpdated
  const unchanged = r.totalUnchanged ?? 0
  const totalFetched = r.sources.reduce((s, x) => s + x.fetched, 0)

  const head =
    `ranAt=${r.ranAt}\n` +
    `sourcesChecked=${r.sourcesChecked}  fetched=${totalFetched}  written=${r.totalPublished}` +
    `  inserted=${inserted}  updated=${updated}  unchanged=${unchanged}` +
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
  summary(`- **Written (inserted+updated):** ${r.totalPublished}` + ` — 🆕 ${inserted} inserted, ♻️ ${updated} updated, ⏭️ ${unchanged} unchanged (not rewritten)`)
  summary(`- **Expired:** ${r.totalExpired}`)
  summary(`- **Failed adapters:** ${r.failedSources.length ? "⚠️ " + r.failedSources.join(", ") : "✅ none"}`)
  summary("")
  summary("| Source | Fetched | Published | Skipped | Status |")
  summary("|---|--:|--:|--:|---|")
  for (const s of rows) {
    summary(`| ${s.id} | ${s.fetched} | ${s.published} | ${s.skipped} | ${s.error ? "⚠️ " + s.error.slice(0, 60) : "✅"} |`)
  }

  // Systemic-failure detection → non-zero exit triggers GitHub failure alerts.
  // "Unchanged" rows are healthy (compare-before-write skipped them), so a steady-state
  // run where nothing changed is NOT a failure — only "nothing written AND nothing seen".
  if (r.totalPublished + (r.totalUnchanged ?? 0) === 0 && r.sources.length > 0) {
    console.error("\nSYSTEMIC FAILURE: 0 jobs written or confirmed unchanged across all adapters.")
    process.exit(1)
  }
}

main().catch(e => {
  console.error(e)
  summary(`## ❌ Govt Jobs Ingestion FAILED\n\n\`\`\`\n${(e as Error).message}\n\`\`\``)
  process.exit(1)
})
