/**
 * backfill-state-slugs.ts — recover state coverage for existing govt_jobs rows.
 *
 * Historic rows (mostly from the central Employment News feed) were stored with
 * state="All India" / state_slug=null even when their organisation or title
 * clearly names a state body (e.g. "Maharashtra Public Service Commission").
 * This script re-derives the canonical state from title + org + department +
 * location using the SAME conservative resolver the live ingestion now uses
 * (deriveStateSlugFromText — central bodies named after a state are excluded),
 * then writes state_slug + state for the matched rows.
 *
 * Safe by default: DRY-RUN unless invoked with `--apply`.
 *   Preview:  npx tsx scripts/backfill-state-slugs.ts
 *   Execute:  npx tsx scripts/backfill-state-slugs.ts --apply
 */
import fs from "node:fs"
import path from "node:path"

// Load .env.local (mirrors scripts/remediate-vacancies.ts).
const envPath = path.join(process.cwd(), ".env.local")
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf8").replace(/^﻿/, "")
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "")
  }
}

const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { deriveStateSlugFromText, getStateBySlug } = await import("@/lib/config/govtTaxonomy")

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.error("Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)"); process.exit(1) }
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  // Pull rows that are currently untagged (no state_slug). We re-evaluate these
  // only — rows already tagged by an authoritative adapter are left untouched.
  const { data, error } = await db.from("govt_jobs")
    .select("id, title, org, department, location, state, state_slug, source_id")
    .is("state_slug", null)
    .limit(10000)
  if (error) { console.error("Query failed:", error.message); process.exit(1) }

  const rows = data ?? []
  console.log(`Scanned ${rows.length} untagged rows (state_slug IS NULL).\n`)

  const updates: { id: string; slug: string; name: string; src: string; title: string }[] = []
  for (const r of rows as Record<string, string>[]) {
    const hit = deriveStateSlugFromText(r.org, r.title, r.department, r.location)
    if (!hit) continue
    const region = getStateBySlug(hit.slug)
    if (!region) continue
    updates.push({ id: r.id, slug: region.slug, name: region.label, src: r.source_id, title: r.title })
  }

  // Per-state + per-source tallies for the report.
  const byState = new Map<string, number>()
  const bySource = new Map<string, number>()
  for (const u of updates) {
    byState.set(u.name, (byState.get(u.name) ?? 0) + 1)
    bySource.set(u.src, (bySource.get(u.src) ?? 0) + 1)
  }

  console.log(`===== BACKFILL ${APPLY ? "(APPLY)" : "(DRY-RUN)"} — ${updates.length} rows would be tagged =====\n`)
  console.log("By state:")
  for (const [s, n] of [...byState].sort((a, b) => b[1] - a[1])) console.log(`  ${s.padEnd(24)} ${n}`)
  console.log("\nBy source:")
  for (const [s, n] of [...bySource].sort((a, b) => b[1] - a[1])) console.log(`  ${s.padEnd(24)} ${n}`)
  console.log("\nSample (first 25):")
  for (const u of updates.slice(0, 25)) console.log(`  → ${u.name.padEnd(18)} ${u.title.slice(0, 70)}`)

  if (!APPLY) { console.log("\nDry-run only. Re-run with --apply to write changes."); return }

  let written = 0
  for (const u of updates) {
    const { error: e } = await db.from("govt_jobs")
      .update({ state: u.name, state_slug: u.slug } as never)
      .eq("id", u.id)
    if (e) console.error(`  ERR ${u.id}: ${e.message}`); else written++
  }
  console.log(`\nApplied: ${written}/${updates.length} rows updated.`)
}

main().catch(e => { console.error(e); process.exit(1) })
