/**
 * Verify Resend env + send OTP, welcome, password-reset test emails.
 * Usage: node scripts/verify-resend.mjs
 * Optional: RESEND_TEST_TO=you@example.com in .env.local (required for live sends on resend.dev sandbox)
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { Resend } from "resend"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const envPath = path.join(root, ".env.local")

function loadEnv() {
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "")
  }
}

loadEnv()

const report = []
function record(name, pass, detail) {
  report.push({ name, pass, detail })
  console.log(`[${pass ? "PASS" : "FAIL"}] ${name}`)
  console.log(`       ${detail}`)
}

function maskKey(key) {
  if (!key || key.length < 12) return "(missing or too short)"
  return `${key.slice(0, 7)}…${key.slice(-4)} (${key.length} chars)`
}

const apiKey = process.env.RESEND_API_KEY?.trim()
const emailFrom = process.env.EMAIL_FROM?.trim()
// Resend sandbox accepts delivered@resend.dev; override with RESEND_TEST_TO for your inbox
const testTo =
  process.env.RESEND_TEST_TO?.trim() ||
  process.env.ADMIN_EMAIL?.trim() ||
  "delivered@resend.dev"

const keyLoaded =
  !!apiKey && !apiKey.includes("your_resend") && !apiKey.startsWith("re_your")
record(
  "RESEND_API_KEY loaded",
  keyLoaded,
  keyLoaded ? maskKey(apiKey) : "not set or placeholder in .env.local"
)

const fromLoaded = !!emailFrom && emailFrom.length > 3
record(
  "EMAIL_FROM loaded",
  fromLoaded,
  fromLoaded ? emailFrom : "not set (would fall back to Noble Job <onboarding@resend.dev>)"
)

if (!keyLoaded) {
  console.log("\nSkipping send tests — fix RESEND_API_KEY first.")
  printSummary()
  process.exit(1)
}

const resend = new Resend(apiKey)
const from = emailFrom || "Noble Job <onboarding@resend.dev>"
const otp = "847291"

function layout(title, bodyHtml) {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;padding:24px">
<div style="max-width:480px;margin:0 auto;background:#fff;padding:28px;border-radius:12px">
<h1>${title}</h1>${bodyHtml}
<p style="color:#9ca3af;font-size:12px">Noble Job — Resend verify script</p>
</div></body></html>`
}

async function send(label, subject, html, text) {
  const { data, error } = await resend.emails.send({
    from,
    to: [testTo],
    subject: `[verify] ${subject}`,
    html,
    text,
  })
  if (error) return { ok: false, detail: error.message }
  return { ok: true, detail: `id=${data?.id ?? "ok"}` }
}

// 3. OTP (email verify)
const otpVerify = await send(
  "OTP email (verify)",
  "Noble Job — Email verification code",
  layout(
    "Verify your email",
    `<p>Test OTP verify:</p><p style="font-size:28px;font-weight:800">${otp}</p>`
  ),
  `Verify OTP test: ${otp}`
)
record("Send OTP email (email_verify)", otpVerify.ok, otpVerify.detail)

// 4. Welcome
const welcome = await send(
  "Welcome email",
  "Welcome to Noble Job — your email is verified",
  layout(
    "You're all set",
    `<p>Hi there, your email is verified (test).</p>`
  ),
  "Welcome test from verify-resend"
)
record("Send Welcome email", welcome.ok, welcome.detail)

// 5. Password reset OTP
const reset = await send(
  "Password reset OTP",
  "Noble Job — Password reset code",
  layout(
    "Reset your password",
    `<p>Test password reset OTP:</p><p style="font-size:28px;font-weight:800">${otp}</p>`
  ),
  `Password reset OTP test: ${otp}`
)
record("Send Password Reset email", reset.ok, reset.detail)

printSummary()

function printSummary() {
  const fail = report.filter((r) => !r.pass).length
  console.log(`\n${"═".repeat(50)}`)
  console.log(`TOTAL: ${report.length - fail} PASS / ${fail} FAIL`)
  if (testTo) console.log(`Recipient: ${testTo}`)
}

process.exit(report.some((r) => !r.pass) ? 1 : 0)
