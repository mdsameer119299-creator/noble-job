/**
 * One-time, idempotent seeder for the curated 20 real govt_jobs (Phase 1A).
 *
 *   npm run db:seed:govt -- --dry-run   # preview only — prints ids, NO DB write
 *   npm run db:seed:govt                # live — upsert 20 rows (onConflict:"id")
 *
 * Requires .env.local:  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Run via tsx (resolves the @/ alias from tsconfig paths).
 */
import fs from "node:fs"
import path from "node:path"

// Load .env.local BEFORE importing modules that read env at runtime.
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

const dryRun = process.argv.includes("--dry-run")

async function main() {
  const { seedCuratedGovtJobs } = await import("@/lib/services/govtSeedService")
  const res = await seedCuratedGovtJobs({ dryRun })
  console.log(
    `\n[seed] ${res.dryRun ? "DRY-RUN complete" : "LIVE complete"} — ` +
      `attempted=${res.attempted} upserted=${res.upserted} skipped=${res.skippedExpired.length}`,
  )
  if (!res.dryRun && res.upserted !== res.attempted) {
    console.error("[seed] WARNING: upserted count != attempted")
    process.exitCode = 1
  }
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
