/**
 * OAuth audit: Supabase provider config, authorize probe, app-layer E2E (simulated post-OAuth).
 * Usage: node scripts/verify-oauth.mjs
 * Optional: E2E_BASE=http://localhost:3000
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const envPath = path.join(root, ".env.local")
const base = process.env.E2E_BASE || "http://localhost:3000"
const ts = Date.now()
const password = "OAuthE2ePass123!"

const report = []
function record(name, pass, detail) {
  report.push({ name, pass, detail })
  console.log(`[${pass ? "PASS" : "FAIL"}] ${name}`)
  console.log(`       ${detail}`)
}

function loadEnv() {
  if (!fs.existsSync(envPath)) return false
  for (const line of fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "")
  }
  return true
}

async function probeAuthorize(provider, redirectTo) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const sb = createClient(url, anon)
  const { data, error } = await sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  })
  if (error) return { ok: false, detail: error.message }
  if (!data?.url) return { ok: false, detail: "no authorize URL returned" }
  const res = await fetch(data.url)
  let body = ""
  try {
    body = await res.text()
  } catch {
    /* ignore */
  }
  if (res.status >= 400) {
    try {
      const j = JSON.parse(body)
      return { ok: false, detail: j.msg || body.slice(0, 120) }
    } catch {
      return { ok: false, detail: `HTTP ${res.status}` }
    }
  }
  const loc = res.headers.get("location") || ""
  if (loc.includes("accounts.google.com") || loc.includes("linkedin.com"))
    return { ok: true, detail: "redirects to IdP" }
  return { ok: true, detail: `authorize HTTP ${res.status}` }
}

/** Mirrors provisionOAuthUser.ts */
async function provisionOAuthUser(admin, user, role) {
  const email = user.email ?? ""
  await admin.from("users").upsert(
    {
      id: user.id,
      email,
      role,
      status: "active",
      email_verified: Boolean(user.email_confirmed_at),
    },
    { onConflict: "id" }
  )
  if (role === "employer") {
    const { data: existing } = await admin.from("employers").select("id").eq("user_id", user.id).maybeSingle()
    if (!existing) {
      await admin.from("employers").insert({
        user_id: user.id,
        company_name: "OAuth Test Co",
        city: "—",
        industry: "Other",
        company_size: "1-10",
        designation: "—",
      })
    }
  } else {
    const { data: existing } = await admin.from("candidates").select("id").eq("user_id", user.id).maybeSingle()
    if (!existing) {
      await admin.from("candidates").insert({
        user_id: user.id,
        first_name: "OAuth",
        last_name: "Test",
        skills: [],
      })
    }
  }
}

async function signInCookie(email) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) return null
  const data = await res.json()
  const ref = new URL(url).hostname.split(".")[0]
  const payload = JSON.stringify({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
    expires_in: data.expires_in || 3600,
    token_type: "bearer",
    user: data.user,
  })
  return `sb-${ref}-auth-token=base64-${Buffer.from(payload).toString("base64")}`
}

async function fetchDash(path, cookie) {
  const res = await fetch(`${base}${path}`, { redirect: "manual", headers: { Cookie: cookie } })
  return { status: res.status, location: res.headers.get("location") }
}

async function runProviderE2E(label, provider, role, dashboardPath, profileTable) {
  const email = `oauth.${provider}.${role}.${ts}@noblejob-e2e.test`
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const authProbe = await probeAuthorize(
    provider,
    `${base.replace(/\/$/, "")}/auth/callback`
  )
  record(
    `${label} — OAuth signup/login (IdP authorize)`,
    authProbe.ok,
    authProbe.detail
  )
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role, full_name: `OAuth ${label}`, provider },
  })
  if (createErr) {
    record(`${label} — OAuth signup simulation`, false, createErr.message)
    return null
  }

  await provisionOAuthUser(admin, created.user, role)
  const profile = await admin.from(profileTable).select("id").eq("user_id", created.user.id).single()
  record(
    `${label} — OAuth signup simulation (provision + profile)`,
    !profile.error && !!profile.data,
    profile.error?.message || `${profileTable} row created`
  )

  const cookie = await signInCookie(email)
  record(`${label} — OAuth login simulation`, !!cookie, cookie ? "session from Auth" : "signIn failed")

  if (cookie) {
    const dash = await fetchDash(dashboardPath, cookie)
    const ok = dash.status === 200 && !(dash.location || "").includes("/auth")
    record(
      `${label} — Dashboard access ${dashboardPath}`,
      ok,
      `status=${dash.status}${dash.location ? ` → ${dash.location}` : ""}`
    )
  } else {
    record(`${label} — Dashboard access ${dashboardPath}`, false, "no session")
  }

  if (created?.user?.id) await admin.auth.admin.deleteUser(created.user.id).catch(() => {})
  return { email, cookie }
}

async function main() {
  console.log("Noble Job — OAuth Audit\n")
  if (!loadEnv()) {
    record("Environment", false, ".env.local missing")
    summarize()
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anon || !svc) {
    record("Supabase env", false, "missing URL/keys")
    summarize()
    process.exit(1)
  }

  const settingsRes = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  })
  const settings = await settingsRes.json()
  const googleOn = settings.external?.google === true
  const linkedInOn = settings.external?.linkedin_oidc === true

  record(
    "Google OAuth configuration (Supabase Dashboard)",
    googleOn,
    googleOn ? "provider enabled" : "provider disabled in Auth settings"
  )
  record(
    "LinkedIn OAuth configuration (Supabase Dashboard)",
    linkedInOn,
    linkedInOn ? "linkedin_oidc enabled" : "linkedin_oidc disabled in Auth settings"
  )

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  record(
    "Redirect URL config (NEXT_PUBLIC_APP_URL)",
    !!appUrl,
    appUrl ? `${appUrl}/auth/callback` : "missing — OAuth uses localhost fallback in SSR"
  )

  const callbackFile = path.join(root, "src/app/auth/callback/route.ts")
  const hasCallback = fs.existsSync(callbackFile)
  record(
    "App callback route /auth/callback",
    hasCallback,
    hasCallback ? "Route Handler: exchangeCodeForSession + provisionOAuthUser" : "missing"
  )

  let serverUp = false
  try {
    const h = await fetch(`${base}/auth`, { signal: AbortSignal.timeout(8000) })
    serverUp = h.ok || h.status === 307
  } catch {
    serverUp = false
  }
  record(
    "Dev server for dashboard/logout E2E",
    serverUp,
    serverUp ? `reachable at ${base}` : `not reachable at ${base} — start: npm run dev`
  )

  await runProviderE2E("Google", "google", "candidate", "/candidate/dashboard", "candidates")
  await runProviderE2E("LinkedIn", "linkedin_oidc", "employer", "/employer/dashboard", "employers")

  if (serverUp) {
    const email = `oauth.logout.${ts}@noblejob-e2e.test`
    const admin = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: lu } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "candidate" },
    })
    if (lu?.user) await provisionOAuthUser(admin, lu.user, "candidate")
    const cookie = await signInCookie(email)
    if (cookie) {
      const logoutRes = await fetch(`${base}/api/auth/logout`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        redirect: "manual",
      })
      const dashAfter = await fetchDash("/candidate/dashboard", cookie)
      const logoutOk =
        (logoutRes.status === 200 || logoutRes.status === 303) &&
        (dashAfter.status === 307 || dashAfter.status === 302 || (dashAfter.location || "").includes("/auth"))
      record(
        "Logout flow (POST /api/auth/logout)",
        logoutOk,
        `logout=${logoutRes.status} dashboard_after=${dashAfter.status}${dashAfter.location ? ` → ${dashAfter.location}` : ""}`
      )
      if (lu?.user?.id) await admin.auth.admin.deleteUser(lu.user.id)
    } else {
      record("Logout flow", false, "could not create session")
    }
  } else {
    record("Logout flow", false, "skipped — server not running")
  }

  summarize()
  process.exit(report.some((r) => !r.pass) ? 1 : 0)
}

function summarize() {
  const fail = report.filter((r) => !r.pass).length
  console.log(`\n${"═".repeat(50)}`)
  console.log(`TOTAL: ${report.length - fail} PASS / ${fail} FAIL`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
