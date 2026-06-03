/**
 * Deploy resumes bucket + policies on hosted Supabase.
 * Bucket via postgres; policies via direct CREATE (may need Dashboard if owner error).
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import postgres from "postgres"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "")
}

const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]
const sql = postgres(
  `postgresql://postgres:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@db.${ref}.supabase.co:5432/postgres`,
  { max: 1, ssl: "require" }
)

const bucketSql = `
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resumes', 'resumes', false, 5242880,
  ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
`

const policyNames = [
  "resumes_candidate_select",
  "resumes_candidate_insert",
  "resumes_candidate_update",
  "resumes_candidate_delete",
  "resumes_employer_select_applicant",
]

const helpersSql = fs.readFileSync(
  path.join(root, "src", "database", "migrations", "008_storage_rls_helpers.sql"),
  "utf8"
)

console.log("Step 1: bucket …")
try {
  await sql.unsafe(bucketSql)
  console.log("  OK")
} catch (e) {
  console.error("  FAIL:", e.message)
  await sql.end()
  process.exit(1)
}

console.log("Step 2: helpers + policies (008) …")
try {
  await sql.unsafe(helpersSql)
  console.log("  OK")
} catch (e) {
  console.error("  FAIL:", e.message)
  await sql.end()
  process.exit(1)
}

const bucket = await sql`SELECT id FROM storage.buckets WHERE id = 'resumes'`
const pol = await sql`
  SELECT policyname FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = ANY(${policyNames})
`
console.log(`Done: bucket=${!!bucket.length}, policies=${pol.length}/5`)
await sql.end()
process.exit(pol.length >= 5 ? 0 : 1)
