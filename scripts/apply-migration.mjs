/**
 * Apply a single migration file from src/database/migrations/.
 * Usage: node scripts/apply-migration.mjs 007_signup_trigger_fix.sql
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import postgres from "postgres"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const envPath = path.join(root, ".env.local")
const file = process.argv[2]

if (!file) {
  console.error("Usage: node scripts/apply-migration.mjs <filename.sql>")
  process.exit(1)
}

function loadEnv() {
  if (!fs.existsSync(envPath)) return
  const raw = fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "")
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "")
  }
}

function resolveDbUrl() {
  if (process.env.SUPABASE_DB_URL?.trim()) return process.env.SUPABASE_DB_URL.trim()
  const password = process.env.SUPABASE_DB_PASSWORD?.trim()
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!password || !projectUrl) return null
  const ref = new URL(projectUrl).hostname.split(".")[0]
  const host = process.env.SUPABASE_DB_HOST?.trim() || `db.${ref}.supabase.co`
  const port = process.env.SUPABASE_DB_PORT?.trim() || "5432"
  const user = process.env.SUPABASE_DB_USER?.trim() || "postgres"
  const database = process.env.SUPABASE_DB_NAME?.trim() || "postgres"
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`
}

loadEnv()
const dbUrl = resolveDbUrl()
if (!dbUrl) {
  console.error("FAIL: Set SUPABASE_DB_PASSWORD or SUPABASE_DB_URL in .env.local")
  process.exit(1)
}

const filePath = path.join(root, "src", "database", "migrations", file)
if (!fs.existsSync(filePath)) {
  console.error(`FAIL: Missing ${filePath}`)
  process.exit(1)
}

const sql = postgres(dbUrl, { max: 1, ssl: "require" })
const body = fs.readFileSync(filePath, "utf8")
process.stdout.write(`Applying ${file} … `)
try {
  await sql.unsafe(body)
  console.log("OK")
} catch (e) {
  console.log("ERROR")
  console.error(e.message)
  process.exit(1)
} finally {
  await sql.end()
}
