/**
 * Quick check: public.users exists (REST + optional SQL).
 * Usage: node scripts/verify-users-table.mjs
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const envPath = path.join(root, ".env.local")

function loadEnv() {
  if (!fs.existsSync(envPath)) return false
  const raw = fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "")
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
  console.log("FAIL: Supabase env missing")
  process.exit(1)
}

const res = await fetch(`${url}/rest/v1/users?select=id&limit=1`, {
  headers: { apikey: svc, Authorization: `Bearer ${svc}` },
})
const text = await res.text()
if (res.ok) {
  console.log("PASS: public.users reachable via REST")
  process.exit(0)
}
console.log("FAIL: public.users —", res.status, text)
process.exit(1)
