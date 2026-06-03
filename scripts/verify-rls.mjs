/**
 * RLS verification — calls public.get_rls_audit() via service role.
 *
 * Prerequisites:
 *   - .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   - Migrations 002 + 006_rls_complete applied (includes get_rls_audit RPC)
 *
 * Usage:
 *   node scripts/verify-rls.mjs
 *   npm run verify:rls
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const envPath = path.join(root, ".env.local")

function loadEnv() {
  if (!fs.existsSync(envPath)) return
  const raw = fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "")
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "")
  }
}

loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error("FAIL: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

const { createClient } = await import("@supabase/supabase-js")
const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data, error } = await admin.rpc("get_rls_audit")

if (error) {
  console.error("FAIL: Could not run get_rls_audit().")
  console.error("  ", error.message)
  console.error("")
  console.error("Apply src/database/migrations/006_rls_complete.sql in Supabase SQL Editor first.")
  process.exit(1)
}

const rows = data || []
const pass = rows.filter((r) => r.test_result === "PASS").length
const fail = rows.filter((r) => r.test_result !== "PASS").length

console.log("")
console.log("RLS verification report")
console.log("=".repeat(72))
console.log(
  `${"Table".padEnd(28)} ${"RLS".padEnd(6)} ${"Policies".padEnd(10)} ${"Expected".padEnd(10)} Result`
)
console.log("-".repeat(72))

for (const r of rows) {
  console.log(
    `${String(r.table_name).padEnd(28)} ${String(r.rls_enabled).padEnd(6)} ${String(r.policy_count).padEnd(10)} ${String(r.expected_min_policies).padEnd(10)} ${r.test_result}`
  )
}

console.log("-".repeat(72))
console.log(`Total tables: ${rows.length}  |  PASS: ${pass}  |  FAIL: ${fail}`)
console.log("")

if (fail > 0) {
  console.error("Overall: FAIL — fix policies or run 006_rls_complete.sql")
  process.exit(1)
}

console.log("Overall: PASS")
process.exit(0)
