/**
 * End-to-end signup verification (Candidate + Employer).
 *
 * Requires .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional: E2E_BASE=http://localhost:3000
 *
 * Usage: node scripts/verify-signup-e2e.mjs
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import crypto from "crypto"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const envPath = path.join(root, ".env.local")

function loadEnv() {
  if (!fs.existsSync(envPath)) return false
  const raw = fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "").trim()
  if (!raw) return false
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "")
  }
  return true
}

function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key || !svc) return false
  if (url.includes("your-project") || key.includes("your-anon-key")) return false
  return url.startsWith("http")
}

const base = process.env.E2E_BASE || "http://localhost:3000"
const ts = Date.now()
const candidateEmail = `e2e.candidate.${ts}@noblejob-e2e.test`
const employerEmail = `e2e.employer.${ts}@noblejob-e2e.test`
const password = "E2eTestPass123!"

const results = []
let pass = 0
let fail = 0

function record(step, ok, detail, proof = null) {
  results.push({ step, ok, detail, proof })
  if (ok) pass++
  else fail++
}

async function apiPost(route, body, cookie = "") {
  const headers = { "Content-Type": "application/json" }
  if (cookie) headers.Cookie = cookie
  const res = await fetch(`${base}/api/auth/${route}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  let json = {}
  try {
    json = await res.json()
  } catch {
    /* ignore */
  }
  return { status: res.status, json, ok: res.ok }
}

async function crackOtp(email, type = "email_verify") {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
  const res = await fetch(
    `${url}/rest/v1/otp_tokens?email=eq.${encodeURIComponent(email)}&type=eq.${type}&is_used=eq.false&order=created_at.desc&limit=1`,
    {
      headers: {
        apikey: svc,
        Authorization: `Bearer ${svc}`,
      },
    },
  )
  const rows = await res.json()
  if (!Array.isArray(rows) || !rows[0]?.otp_hash) return null
  const target = rows[0].otp_hash
  for (let n = 100000; n <= 999999; n++) {
    const hash = crypto.createHash("sha256").update(String(n)).digest("hex")
    if (hash === target) return String(n).padStart(6, "0")
  }
  return null
}

async function dbQuery(table, filter) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
  const q = new URL(`${url}/rest/v1/${table}`)
  Object.entries(filter).forEach(([k, v]) => q.searchParams.set(k, "eq." + v))
  q.searchParams.set("select", "*")
  const res = await fetch(q.toString(), {
    headers: { apikey: svc, Authorization: `Bearer ${svc}` },
  })
  const data = await res.json()
  return { ok: res.ok, data: Array.isArray(data) ? data : [], error: data?.message }
}

async function signIn(email) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) return null
  const data = await res.json()
  const projectRef = new URL(url).hostname.split(".")[0]
  const cookieName = `sb-${projectRef}-auth-token`
  const payload = JSON.stringify({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
    expires_in: data.expires_in || 3600,
    token_type: "bearer",
    user: data.user,
  })
  return `${cookieName}=${encodeURIComponent(`base64-${Buffer.from(payload).toString("base64")}`)}`
}

async function fetchDashboard(path, cookie) {
  const res = await fetch(`${base}${path}`, { redirect: "manual", headers: { Cookie: cookie } })
  return { status: res.status, location: res.headers.get("location") }
}

const candidatePayload = {
  firstName: "E2E",
  lastName: "Candidate",
  email: candidateEmail,
  phone: "+919876543210",
  password,
  terms: true,
  experienceYears: 2,
  category: "IT & Software",
  expectedSalary: 800000,
  skills: ["JavaScript", "React"],
}

const employerPayload = {
  firstName: "E2E",
  lastName: "Employer",
  email: employerEmail,
  phone: "+919876543211",
  password,
  terms: true,
  companyName: `E2E Corp ${ts}`,
  website: "",
  city: "Mumbai",
  industry: "Technology",
  companySize: "51-200",
  designation: "HR Manager",
}

async function runRole(label, email, registerRoute, payload, dashboardPath, profileTable) {
  console.log(`\n========== ${label} ==========`)

  const reg = await apiPost(registerRoute, payload)
  const regOk = reg.ok && reg.json.success && reg.json.userId
  record(
    `${label} — Signup`,
    regOk,
    regOk ? `userId=${reg.json.userId}` : `HTTP ${reg.status} ${reg.json.error || ""}`,
    regOk ? { userId: reg.json.userId } : null,
  )
  if (!regOk) return

  const userRow = await dbQuery("users", { email })
  record(
    `${label} — DB: users row`,
    userRow.ok && userRow.data[0]?.role && userRow.data[0]?.status === "pending",
    userRow.data[0]
      ? `role=${userRow.data[0].role} status=${userRow.data[0].status} email_verified=${userRow.data[0].email_verified}`
      : userRow.error || "no row",
    userRow.data[0] || null,
  )

  const profile = await dbQuery(profileTable, { user_id: userRow.data[0]?.id })
  record(
    `${label} — DB: ${profileTable} profile`,
    profile.ok && profile.data.length > 0,
    profile.data[0] ? JSON.stringify(profile.data[0], null, 0).slice(0, 200) : "missing",
    profile.data[0] || null,
  )

  const otpRow = await dbQuery("otp_tokens", { email })
  record(
    `${label} — DB: otp_tokens`,
    otpRow.ok && otpRow.data.length > 0,
    otpRow.data.length ? `count=${otpRow.data.length} type=${otpRow.data[0]?.type}` : "none",
    otpRow.data[0] || null,
  )

  const otp = await crackOtp(email)
  const verify = otp ? await apiPost("verify-otp", { email, otp, type: "email_verify" }) : { ok: false, status: 0, json: {} }
  record(
    `${label} — Email verification`,
    verify.ok && verify.json.success,
    verify.ok ? "OTP verified" : otp ? `HTTP ${verify.status}` : "could not resolve OTP from DB hash",
  )

  const userAfter = await dbQuery("users", { email })
  const verified =
    userAfter.data[0]?.email_verified === true && userAfter.data[0]?.status === "active"
  record(
    `${label} — DB: users active after verify`,
    verified,
    userAfter.data[0]
      ? `status=${userAfter.data[0].status} email_verified=${userAfter.data[0].email_verified}`
      : "no row",
    userAfter.data[0] || null,
  )

  const cookie = await signIn(email)
  record(`${label} — Login`, !!cookie, cookie ? "session obtained" : "signIn failed")

  if (cookie) {
    const dash = await fetchDashboard(dashboardPath, cookie)
    const dashOk = dash.status === 200 && !(dash.location || "").includes("/auth")
    record(
      `${label} — Dashboard access (${dashboardPath})`,
      dashOk,
      `status=${dash.status}${dash.location ? ` location=${dash.location}` : ""}`,
    )
  } else {
    record(`${label} — Dashboard access`, false, "skipped (no session)")
  }
}

async function main() {
  console.log("Noble Job — Signup E2E Verification")
  console.log(`Base URL: ${base}`)
  console.log(`Candidate email: ${candidateEmail}`)
  console.log(`Employer email: ${employerEmail}`)

  if (!loadEnv() || !isSupabaseConfigured()) {
    console.error("\nBLOCKED: .env.local missing or Supabase not configured.")
    console.error("Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY")
    const steps = [
      "Candidate — Signup",
      "Candidate — Email verification",
      "Candidate — Profile creation (DB)",
      "Candidate — Dashboard access",
      "Employer — Signup",
      "Employer — Company profile (DB)",
      "Employer — Dashboard access",
    ]
    for (const s of steps) record(s, false, "Supabase env not configured")
    printSummary()
    process.exit(1)
  }

  try {
    const health = await fetch(`${base}/auth`, { signal: AbortSignal.timeout(8000) })
    if (!health.ok) throw new Error(`auth page ${health.status}`)
  } catch (e) {
    console.error(`\nBLOCKED: Dev server not reachable at ${base} — ${e.message}`)
    process.exit(1)
  }

  await runRole(
    "Candidate",
    candidateEmail,
    "register/candidate",
    candidatePayload,
    "/candidate/dashboard",
    "candidates",
  )
  await runRole(
    "Employer",
    employerEmail,
    "register/employer",
    employerPayload,
    "/employer/dashboard",
    "employers",
  )

  printSummary()
  process.exit(fail > 0 ? 1 : 0)
}

function printSummary() {
  console.log("\n══════════════════════════════════════════════════")
  console.log(`PASS: ${pass}  FAIL: ${fail}`)
  console.log("══════════════════════════════════════════════════\n")
  for (const r of results) {
    console.log(`[${r.ok ? "PASS" : "FAIL"}] ${r.step}`)
    console.log(`       ${r.detail}`)
    if (r.proof) {
      console.log(`       proof: ${typeof r.proof === "string" ? r.proof : JSON.stringify(r.proof)}`)
    }
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
