/**
 * Apply src/database/migrations/*.sql to remote Supabase Postgres.
 *
 * Required in .env.local (Dashboard → Settings → Database → Database password):
 *   SUPABASE_DB_PASSWORD=your-postgres-password
 *
 * Or full URI:
 *   SUPABASE_DB_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
 *
 * Usage: npm run db:apply
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import postgres from "postgres"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const envPath = path.join(root, ".env.local")
const migrationsDir = path.join(root, "src", "database", "migrations")

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

const MIGRATION_ORDER = [
  "001_initial_schema.sql",
  "002_rls_policies.sql",
  "003_indexes.sql",
  "004_functions.sql",
  "005_triggers.sql",
  "006_rls_complete.sql",
  "007_signup_trigger_fix.sql",
  "006_storage_resumes.sql",
  "008_storage_rls_helpers.sql",
]

async function main() {
  loadEnv()
  const dbUrl = resolveDbUrl()
  if (!dbUrl) {
    console.error("FAIL: Set SUPABASE_DB_PASSWORD or SUPABASE_DB_URL in .env.local")
    console.error("  Supabase Dashboard → Project Settings → Database → Database password")
    process.exit(1)
  }

  const sql = postgres(dbUrl, { max: 1, ssl: "require" })
  console.log("Applying Noble Job migrations…\n")

  for (const file of MIGRATION_ORDER) {
    const filePath = path.join(migrationsDir, file)
    if (!fs.existsSync(filePath)) {
      console.error(`FAIL: Missing ${file}`)
      await sql.end()
      process.exit(1)
    }
    const body = fs.readFileSync(filePath, "utf8")
    process.stdout.write(`  → ${file} … `)
    try {
      await sql.unsafe(body)
      console.log("OK")
    } catch (e) {
      console.log("ERROR")
      console.error(e.message)
      await sql.end()
      process.exit(1)
    }
  }

  const [{ exists }] = await sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users'
    ) AS exists
  `
  await sql.end()

  if (!exists) {
    console.error("\nFAIL: public.users still missing after migrations")
    process.exit(1)
  }

  console.log("\nPASS: All migrations applied; public.users exists")
  console.log(
    "Tip: Supabase Dashboard → Settings → API → Reload schema cache if REST still returns PGRST205"
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
