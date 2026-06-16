/**
 * Schema-drift guard.
 *
 * Probes the LIVE database (read-only, via PostgREST + service-role key) for every
 * (table, column) pair the application code depends on. Fails if any column is
 * missing — i.e. if the code has drifted away from the deployed schema.
 *
 * This catches bugs like the `applications.job_board` regression (code wrote a
 * column that did not exist in production, silently breaking candidate applies)
 * BEFORE they ship.
 *
 * Usage: node scripts/verify-schema-drift.mjs
 * Exit:  0 = all required columns present, 1 = drift detected / env missing.
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const envPath = path.join(root, ".env.local")

function loadEnv() {
  if (!fs.existsSync(envPath)) return false
  const raw = fs.readFileSync(envPath, "utf8").replace(/^﻿/, "")
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "")
  }
  return true
}

loadEnv()
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !svc) {
  console.log("FAIL: Supabase env missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)")
  process.exit(1)
}

/**
 * Columns the runtime code reads/writes. Keep in sync when code touches new columns.
 * Each entry is verified with `?select=<col>&limit=0` (returns [] if present, 400 if not).
 */
const REQUIRED = {
  users: ["id", "email", "role", "status", "email_verified"],
  candidates: ["id", "user_id", "first_name", "last_name", "skills", "resume_url", "profile_score"],
  employers: ["id", "user_id", "company_name", "status", "verified"],
  jobs: ["id", "employer_id", "title", "status", "is_verified", "posted_at"],
  applications: ["id", "job_id", "board", "candidate_id", "employer_id", "status", "notes", "applied_at"],
  notifications: ["id", "user_id", "type", "title", "message", "is_read"],
  otp_tokens: ["id", "email", "otp_hash", "type", "is_used", "expires_at"],
  contact_messages: ["id", "status"],
}

// Columns added by pending/optional migrations — warn (not fail) if absent, so this
// guard is safe to run before those migrations are applied.
const OPTIONAL = {
  jobs: ["job_status"],
  auth_failures: ["id", "email", "failure_type", "is_lockout", "created_at"],
}

const headers = { apikey: svc, Authorization: `Bearer ${svc}` }

async function columnExists(table, col) {
  const res = await fetch(`${url}/rest/v1/${table}?select=${col}&limit=0`, { headers })
  if (res.ok) return true
  const body = await res.text()
  // 42703 = undefined_column; PGRST205 = table not found
  return { ok: false, status: res.status, body: body.slice(0, 140) }
}

let failures = 0
let warnings = 0

for (const [table, cols] of Object.entries(REQUIRED)) {
  for (const col of cols) {
    const r = await columnExists(table, col)
    if (r !== true) {
      failures++
      console.log(`FAIL  ${table}.${col} — ${r.status} ${r.body}`)
    }
  }
}

for (const [table, cols] of Object.entries(OPTIONAL)) {
  for (const col of cols) {
    const r = await columnExists(table, col)
    if (r !== true) {
      warnings++
      console.log(`WARN  ${table}.${col} missing (pending migration?) — ${r.status}`)
    }
  }
}

if (failures === 0) {
  console.log(`PASS: all ${Object.values(REQUIRED).flat().length} required columns present${warnings ? ` (${warnings} optional warning(s))` : ""}`)
  process.exit(0)
}
console.log(`\nDRIFT DETECTED: ${failures} required column(s) missing. Code references a schema that production does not have.`)
process.exit(1)
