/**
 * Verify resumes bucket + RLS policies (candidate upload/view, employer access rules).
 * Usage: node scripts/verify-storage-resumes.mjs
 */
import fs from "fs"
import path from "path"
import crypto from "crypto"
import { fileURLToPath } from "url"
import postgres from "postgres"
import { createClient } from "@supabase/supabase-js"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const envPath = path.join(root, ".env.local")
const password = "StorageTestPass123!"
const ts = Date.now()

function loadEnv() {
  for (const line of fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "")
  }
}

loadEnv()
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
const ref = new URL(url).hostname.split(".")[0]

const report = []
function record(name, pass, detail) {
  report.push({ name, pass, detail })
  console.log(`[${pass ? "PASS" : "FAIL"}] ${name}`)
  console.log(`       ${detail}`)
}

const sql = postgres(
  `postgresql://postgres:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@db.${ref}.supabase.co:5432/postgres`,
  { ssl: "require" }
)

const bucket = await sql`SELECT id, public FROM storage.buckets WHERE id = 'resumes'`
const policies = await sql`
  SELECT policyname FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'resumes_%'
`
record(
  "Deploy: resumes bucket",
  bucket.length > 0 && bucket[0].public === false,
  bucket[0] ? `exists, public=${bucket[0].public}` : "missing"
)
record(
  "Deploy: 5 storage policies",
  policies.length >= 5,
  policies.map((p) => p.policyname).join(", ") || "none"
)

const admin = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } })

const candEmail = `storage.cand.${ts}@noblejob-e2e.test`
const empEmail = `storage.emp.${ts}@noblejob-e2e.test`
const emp2Email = `storage.emp2.${ts}@noblejob-e2e.test`

async function createUser(email, role, meta = {}) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role, ...meta },
  })
  if (error) throw new Error(`${email}: ${error.message}`)
  await admin.from("users").upsert({
    id: data.user.id,
    email,
    role,
    status: "active",
    email_verified: true,
  })
  return data.user.id
}

const candUserId = await createUser(candEmail, "candidate", { first_name: "S", last_name: "C" })
const empUserId = await createUser(empEmail, "employer", { company_name: "Co A" })
const emp2UserId = await createUser(emp2Email, "employer", { company_name: "Co B" })

const { data: candRow } = await admin.from("candidates").select("id").eq("user_id", candUserId).single()
const { data: empRow } = await admin.from("employers").select("id").eq("user_id", empUserId).single()
const { data: emp2Row } = await admin.from("employers").select("id").eq("user_id", emp2UserId).single()
const candidateId = candRow.id
const employerId = empRow.id

async function clientFor(email) {
  const c = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`signIn ${email}: ${error.message}`)
  return c
}

const candClient = await clientFor(candEmail)
const resumePath = `${candidateId}/resume.pdf`
const pdf = Buffer.from("%PDF-1.4 noble-job storage verify")

const up = await candClient.storage.from("resumes").upload(resumePath, pdf, {
  contentType: "application/pdf",
  upsert: true,
})
record("Candidate upload", !up.error, up.error?.message || resumePath)

await admin.from("candidates").update({ resume_url: resumePath }).eq("id", candidateId)

const view = await candClient.storage.from("resumes").createSignedUrl(resumePath, 120)
record(
  "Candidate view own resume",
  !view.error && !!view.data?.signedUrl,
  view.error?.message || "signed URL ok"
)

const appIns = await admin.from("applications").insert({
  job_id: null,
  board: "private",
  candidate_id: candidateId,
  employer_id: employerId,
  status: "new",
  notes: "{}",
})
if (appIns.error) {
  record("Employer access after application", false, `application seed failed: ${appIns.error.message}`)
}

if (!appIns.error) {
  const empClient = await clientFor(empEmail)
  const empView = await empClient.storage.from("resumes").createSignedUrl(resumePath, 120)
  record(
    "Employer access after application",
    !empView.error && !!empView.data?.signedUrl,
    empView.error?.message || "signed URL ok"
  )
}

const emp2Client = await clientFor(emp2Email)
const emp2View = await emp2Client.storage.from("resumes").createSignedUrl(resumePath, 120)
record(
  "Employer cannot access unrelated resume",
  !!emp2View.error || !emp2View.data?.signedUrl,
  emp2View.error?.message || (emp2View.data?.signedUrl ? "unexpected access" : "denied")
)

// cleanup
await admin.storage.from("resumes").remove([resumePath])
await admin.auth.admin.deleteUser(candUserId)
await admin.auth.admin.deleteUser(empUserId)
await admin.auth.admin.deleteUser(emp2UserId)

await sql.end()

const fail = report.filter((r) => !r.pass).length
console.log(`\n${"═".repeat(50)}`)
console.log(`TOTAL: ${report.length - fail} PASS / ${fail} FAIL`)
process.exit(fail > 0 ? 1 : 0)
