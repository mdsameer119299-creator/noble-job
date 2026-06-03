/**
 * RBAC verification — HTTP + optional Supabase session tests.
 *
 * Usage:
 *   node scripts/verify-rbac.mjs [--base http://localhost:3000]
 *
 * Optional .env.local credentials (must exist in Supabase Auth + users table):
 *   RBAC_TEST_ADMIN_EMAIL / RBAC_TEST_ADMIN_PASSWORD
 *   RBAC_TEST_EMPLOYER_EMAIL / RBAC_TEST_EMPLOYER_PASSWORD
 *   RBAC_TEST_CANDIDATE_EMAIL / RBAC_TEST_CANDIDATE_PASSWORD
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

const base = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : process.env.RBAC_TEST_BASE || "http://localhost:3000"

const PROTECTED = [
  { path: "/admin/dashboard", label: "admin/dashboard" },
  { path: "/admin/jobs", label: "admin/jobs" },
  { path: "/employer/dashboard", label: "employer/dashboard" },
  { path: "/candidate/dashboard", label: "candidate/dashboard" },
]

const PUBLIC = [{ path: "/jobs/private", label: "jobs/private" }, { path: "/auth", label: "auth" }]

function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !key) return false
  if (url.includes("your-project") || key.includes("your-anon-key")) return false
  return url.startsWith("http")
}

/** @returns {{ status: number, location: string|null, finalUrl: string, bodySnippet: string }} */
async function fetchNoRedirect(url, cookieHeader = "") {
  const headers = cookieHeader ? { Cookie: cookieHeader } : {}
  const res = await fetch(url, { redirect: "manual", headers })
  const loc = res.headers.get("location")
  let bodySnippet = ""
  try {
    const t = await res.text()
    bodySnippet = t.slice(0, 200)
  } catch {
    /* ignore */
  }
  return { status: res.status, location: loc, finalUrl: url, bodySnippet }
}

async function signIn(email, password) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) return null
  const data = await res.json()
  const access = data.access_token
  const refresh = data.refresh_token
  if (!access) return null
  // Supabase SSR uses sb-<project-ref>-auth-token cookie (chunked). For middleware test,
  // set Authorization via cookie simulation — Next middleware reads cookies from @supabase/ssr.
  // Minimal: pass access_token in custom header won't work. Use document cookie format.
  const projectRef = new URL(url).hostname.split(".")[0]
  const cookieName = `sb-${projectRef}-auth-token`
  const payload = JSON.stringify({
    access_token: access,
    refresh_token: refresh,
    expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
    expires_in: data.expires_in || 3600,
    token_type: "bearer",
    user: data.user,
  })
  const encoded = `base64-${Buffer.from(payload).toString("base64")}`
  return `${cookieName}=${encodeURIComponent(encoded)}`
}

const results = []
let pass = 0
let fail = 0
let skip = 0

function record(name, ok, detail, skipped = false) {
  results.push({ name, ok, detail, skipped })
  if (skipped) skip++
  else if (ok) pass++
  else fail++
}

async function expectBlocked(label, res, expectReason) {
  const loc = res.location || ""
  const isRedirect =
    res.status === 307 || res.status === 308 || res.status === 302 || res.status === 303
  if (!isRedirect) {
    record(label, false, `Expected redirect to /auth, got status=${res.status}`)
    return
  }
  if (!loc.includes("/auth")) {
    record(label, false, `Redirect but not /auth: ${loc}`)
    return
  }
  const reasonOk =
    !expectReason ||
    expectReason === "redirect" ||
    loc.includes(`reason=${expectReason}`) ||
    loc.includes("redirect=")
  record(
    label,
    reasonOk,
    `status=${res.status} → ${loc}`,
  )
}

async function expectAllowed(label, res) {
  const ok = res.status === 200 && !(res.location || "").includes("/auth?reason=unauthorized")
  record(label, ok, `status=${res.status}`)
}

async function run() {
  console.log(`\nRBAC verification — base: ${base}`)
  console.log(`Supabase configured: ${isSupabaseConfigured()}\n`)

  // ── Guest (no cookies) ──
  console.log("=== Guest (unauthenticated) ===")
  for (const p of PUBLIC) {
    const res = await fetchNoRedirect(`${base}${p.path}`)
    const ok = res.status === 200
    record(`Guest → ${p.label}`, ok, `status=${res.status}`)
  }
  for (const p of PROTECTED) {
    const res = await fetchNoRedirect(`${base}${p.path}`)
    await expectBlocked(`Guest → ${p.label}`, res, isSupabaseConfigured() ? "redirect" : "config")
  }

  // ── Role sessions (optional) ──
  const roles = [
    { role: "admin", email: process.env.RBAC_TEST_ADMIN_EMAIL, password: process.env.RBAC_TEST_ADMIN_PASSWORD },
    { role: "employer", email: process.env.RBAC_TEST_EMPLOYER_EMAIL, password: process.env.RBAC_TEST_EMPLOYER_PASSWORD },
    { role: "candidate", email: process.env.RBAC_TEST_CANDIDATE_EMAIL, password: process.env.RBAC_TEST_CANDIDATE_PASSWORD },
  ]

  for (const { role, email, password } of roles) {
    if (!email || !password || !isSupabaseConfigured()) {
      console.log(`\n=== ${role} — SKIP (set RBAC_TEST_${role.toUpperCase()}_EMAIL/PASSWORD) ===`)
      continue
    }
    console.log(`\n=== ${role} (authenticated) ===`)
    const cookie = await signIn(email, password)
    if (!cookie) {
      record(`${role} sign-in`, false, "Could not obtain session")
      continue
    }
    record(`${role} sign-in`, true, "Session cookie obtained")

    const own =
      role === "admin"
        ? ["/admin/dashboard"]
        : role === "employer"
          ? ["/employer/dashboard"]
          : ["/candidate/dashboard"]
    for (const path of own) {
      const res = await fetchNoRedirect(`${base}${path}`, cookie)
      await expectAllowed(`${role} → ${path}`, res)
    }

    const forbidden =
      role === "admin"
        ? []
        : role === "employer"
          ? ["/admin/dashboard", "/candidate/dashboard"]
          : ["/admin/dashboard", "/employer/dashboard"]

    for (const path of forbidden) {
      const res = await fetchNoRedirect(`${base}${path}`, cookie)
      await expectBlocked(`${role} → ${path}`, res, "unauthorized")
    }

    if (role === "admin") {
      for (const path of ["/employer/dashboard", "/candidate/dashboard"]) {
        const res = await fetchNoRedirect(`${base}${path}`, cookie)
        await expectBlocked(`Admin → ${path} (cross-role)`, res, "unauthorized")
      }
    }
  }

  console.log("\n══════════════════════════════════════")
  console.log(`PASS: ${pass}  FAIL: ${fail}  SKIP: ${skip}`)
  console.log("══════════════════════════════════════\n")
  for (const r of results) {
    const tag = r.skipped ? "SKIP" : r.ok ? "PASS" : "FAIL"
    console.log(`[${tag}] ${r.name}`)
    if (r.detail) console.log(`       ${r.detail}`)
  }
  process.exit(fail > 0 ? 1 : 0)
}

run().catch(e => {
  console.error(e)
  process.exit(1)
})
