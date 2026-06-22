/**
 * govt-coverage-report.ts — read-only state/source coverage snapshot.
 *
 * Prints, for active+published govt_jobs:
 *   • State-wise job counts (own recruitments per state/UT)
 *   • All-India (national) job count
 *   • Missing states (zero own recruitments) — the SEO/UX gap
 *   • Source-wise job counts (which adapters are actually feeding the table)
 *
 * Read-only — safe to run anytime.
 *   npx tsx scripts/govt-coverage-report.ts
 */
// MUST be first: polyfill WebSocket for supabase-js on Node 20 (GitHub Actions).
import "./setupWebSocket"
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
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL
}

const SUMMARY = process.env.GITHUB_STEP_SUMMARY
function summary(md: string) {
  if (SUMMARY) fs.appendFileSync(SUMMARY, md + "\n")
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { INDIAN_STATES } = await import("@/lib/config/govtTaxonomy")

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.error("Missing Supabase env."); process.exit(1) }
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data, error } = await db.from("govt_jobs")
    .select("id, state, state_slug, source_id, status, published")
    .eq("status", "active")
    .eq("published", true)
    .limit(10000)
  if (error) { console.error("Query failed:", error.message); process.exit(1) }
  const rows = (data ?? []) as Record<string, string>[]

  const isNational = (r: Record<string, string>) => !r.state_slug || (r.state || "").toLowerCase() === "all india"
  const national = rows.filter(isNational)
  const stateRows = rows.filter(r => !isNational(r))

  const byState = new Map<string, number>()
  for (const r of stateRows) byState.set(r.state_slug, (byState.get(r.state_slug) ?? 0) + 1)

  const bySource = new Map<string, number>()
  for (const r of rows) bySource.set(r.source_id ?? "(none)", (bySource.get(r.source_id ?? "(none)") ?? 0) + 1)

  console.log(`\n========== GOVT JOBS COVERAGE (active + published) ==========`)
  console.log(`Total active jobs : ${rows.length}`)
  console.log(`All-India (national): ${national.length}`)
  console.log(`State-tagged       : ${stateRows.length}`)

  console.log(`\n----- State-wise counts (${byState.size} states with jobs) -----`)
  const present = INDIAN_STATES
    .map(s => ({ s, n: byState.get(s.slug) ?? 0 }))
    .filter(x => x.n > 0)
    .sort((a, b) => b.n - a.n)
  for (const { s, n } of present) console.log(`  ${s.label.padEnd(28)} ${n}`)

  const missing = INDIAN_STATES.filter(s => !(byState.get(s.slug) ?? 0))
  console.log(`\n----- Missing states / UTs (${missing.length}, zero own jobs) -----`)
  console.log("  " + missing.map(s => s.label).join(", "))

  console.log(`\n----- Source-wise counts -----`)
  const sources = [...bySource].sort((a, b) => b[1] - a[1])
  for (const [src, n] of sources) console.log(`  ${src.padEnd(24)} ${n}`)
  console.log("")

  // GitHub Actions step summary (Markdown).
  summary(`## 📊 Govt Jobs Coverage — ${new Date().toISOString().slice(0, 10)}`)
  summary("")
  summary(`- **Total active jobs:** ${rows.length}`)
  summary(`- **National (All-India):** ${national.length}`)
  summary(`- **State-tagged:** ${stateRows.length} across ${byState.size} states/UTs`)
  summary("")
  summary(`### State-wise counts`)
  summary("| State / UT | Jobs |")
  summary("|---|--:|")
  for (const { s, n } of present) summary(`| ${s.label} | ${n} |`)
  summary("")
  summary(`### Missing (${missing.length} states/UTs, zero own jobs)`)
  summary(missing.map(s => s.label).join(", ") || "_none — full coverage_")
  summary("")
  summary(`### Source-wise counts`)
  summary("| Source | Jobs |")
  summary("|---|--:|")
  for (const [src, n] of sources) summary(`| ${src} | ${n} |`)
}

main().catch(e => { console.error(e); process.exit(1) })
