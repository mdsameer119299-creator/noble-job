/**
 * himalayasWfhIngest.test.ts — Phase 1C / Phase 2 (strategy/internal-applications-admin-gate).
 *   npx tsx src/lib/services/himalayasWfhIngest.test.ts
 *
 * Exercises the pure, exported mapping/id/date helpers with no network or
 * database I/O (matching this repo's other dependency-free unit tests — see
 * govtAutoUpdate.test.ts), plus the renderable/provenance/apply-route gate
 * behaviour a mapped row actually gets once it reaches the existing pipeline
 * (renderable.ts / provenance.ts / applyRoute.ts are exercised for real, not
 * re-implemented, so this proves the INTEGRATION, not a duplicate model of
 * it). `ingestHimalayasWfhJobs()` itself is also exercised, but only its
 * "Supabase not configured" short-circuit — this test process never sets
 * Supabase credentials, so a real network/DB call would be a bug, and this
 * assertion pins that no such call is made in that state.
 */
import assert from "node:assert/strict"
import {
  toRow,
  idFromGuid,
  unixToIso,
  explicitIndiaCountry,
  stripHtml,
  ingestHimalayasWfhJobs,
  type RawHimalayasJob,
} from "./himalayasWfhIngest"
import { isValidJobId, checkJobRecord } from "../jobs/renderable"
import { classifyProvenance, isGenuine, isOpen } from "../jobs/provenance"
import { applyRouteFor, isJobPostingRoute } from "../jobs/applyRoute"

let passed = 0
let failed = 0
function test(name: string, fn: () => void | Promise<void>) {
  try {
    const r = fn()
    if (r && typeof (r as Promise<void>).then === "function") {
      ;(r as Promise<void>).then(
        () => { passed++; console.log(`  PASS  ${name}`) },
        err => { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) },
      )
    } else {
      passed++
      console.log(`  PASS  ${name}`)
    }
  } catch (err) {
    failed++
    console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`)
  }
}

const rawJob = (over: Partial<RawHimalayasJob> = {}): RawHimalayasJob => ({
  title: "Backend Engineer",
  companyName: "Acme Corp",
  companySlug: "acme",
  companyLogo: "https://example.com/logo.png",
  employmentType: "Full-time",
  seniority: ["Mid-level"],
  currency: "USD",
  minSalary: 60000,
  maxSalary: 90000,
  categories: ["software-engineering"],
  locationRestrictions: [],
  description: "<p>Build and ship backend services for our platform. Remote-first team, async by default.</p>",
  pubDate: Math.floor(Date.now() / 1000) - 86400,
  expiryDate: Math.floor(Date.now() / 1000) + 30 * 86400,
  applicationLink: "https://himalayas.app/companies/acme/jobs/backend-engineer/apply",
  guid: "https://himalayas.app/companies/acme/jobs/backend-engineer",
  ...over,
})

/* ─────────────── identifier / duplicate prevention ─────────────── */

test("idFromGuid: same guid -> same id (stable, dedup-safe across refreshes)", () => {
  const a = idFromGuid("https://himalayas.app/companies/acme/jobs/backend-engineer")
  const b = idFromGuid("https://himalayas.app/companies/acme/jobs/backend-engineer")
  assert.equal(a, b)
})

test("idFromGuid: different guids -> different ids, even for the SAME company slug (the bug this module avoids)", () => {
  // This is exactly the real, verified Himalayas shape: multiple distinct jobs
  // from one company share a `slug`, but each has its own unique `guid`.
  const a = idFromGuid("https://himalayas.app/companies/micro1/jobs/salesforce-specialist")
  const b = idFromGuid("https://himalayas.app/companies/micro1/jobs/senior-ndt-inspector-level-ii-iii")
  assert.notEqual(a, b)
})

test("idFromGuid: output is a valid Noble Job id (renderable.ts ID_RE) — alnum/:_.- only, no raw URL characters", () => {
  const id = idFromGuid("https://himalayas.app/companies/acme/jobs/backend-engineer?ref=abc&x=1")
  assert.ok(isValidJobId(id), `expected a valid job id, got "${id}"`)
  assert.doesNotMatch(id, /[/?&=]/)
  assert.ok(id.length <= 128)
  assert.match(id, /^himalayas:/)
})

test("toRow: two distinct source jobs upsert to two distinct wfh_jobs ids", () => {
  const rowA = toRow(rawJob({ guid: "https://himalayas.app/companies/acme/jobs/a" }))
  const rowB = toRow(rawJob({ guid: "https://himalayas.app/companies/acme/jobs/b" }))
  assert.notEqual(rowA.id, rowB.id)
})

test("toRow: the SAME source job maps to the SAME id every time (re-fetch upserts in place, never duplicates)", () => {
  const j = rawJob()
  assert.equal(toRow(j).id, toRow({ ...j }).id)
})

/* ─────────────── provenance: always AGGREGATED, never an owned employer job ─────────────── */

test("toRow: provenance is always AGGREGATED and employer_id is always null", () => {
  const row = toRow(rawJob())
  assert.equal(row.provenance, "AGGREGATED")
  assert.equal(row.employer_id, null)
})

test("mapped row classifies as AGGREGATED through the real provenance.ts classifier (source='Himalayas' + real apply_url)", () => {
  const row = toRow(rawJob())
  assert.equal(classifyProvenance(row), "AGGREGATED")
  assert.equal(isGenuine(row), true)
})

test("a row with no real application link is never genuine (defense in depth — the eligibility filter in ingestHimalayasWfhJobs() already excludes it earlier, before toRow() ever runs)", () => {
  const j = rawJob({ applicationLink: "" })
  const row = toRow(j)
  assert.equal(isGenuine(row), false)
  assert.equal(checkJobRecord(row, "wfh").renderable, false) // never shown as a job, never a misleading Apply
})

/* ─────────────── WFH classification / renderable gate ─────────────── */

test("a complete mapped row passes the renderable ('no empty jobs') gate", () => {
  const row = toRow(rawJob())
  const verdict = checkJobRecord(row, "wfh")
  assert.equal(verdict.renderable, true, verdict.reasons.join(","))
})

test("a row with a too-short/placeholder description is excluded, never shown as a job", () => {
  const row = toRow(rawJob({ description: "N/A", excerpt: "" }))
  const verdict = checkJobRecord(row, "wfh")
  assert.equal(verdict.renderable, false)
  assert.ok(verdict.reasons.includes("missing-description"))
})

test("stripHtml: HTML description is reduced to real, renderable plain text", () => {
  const text = stripHtml("<p>Build and ship <b>backend</b> services.</p>&nbsp;Remote-first team.")
  assert.doesNotMatch(text, /<[^>]+>/)
  assert.match(text, /Build and ship backend services\./)
})

/* ─────────────── aggregated jobs cannot get an external Apply, cannot get a JobPosting ─────────────── */

test("aggregated WFH row from this ingestion NEVER gets an external/employer apply route (route is 'none')", () => {
  const row = toRow(rawJob())
  assert.equal(applyRouteFor("wfh", row), "none")
})

test("aggregated WFH row NEVER qualifies for JobPosting JSON-LD (isJobPostingRoute requires an employer route)", () => {
  const row = toRow(rawJob())
  const route = applyRouteFor("wfh", row)
  assert.equal(isJobPostingRoute("wfh", row, route), false)
})

test("aggregated WFH row carries no candidate/resume data of any kind — the row shape has no resume/candidate field", () => {
  const row = toRow(rawJob())
  const keys = Object.keys(row)
  assert.ok(!keys.some(k => /resume|candidate/i.test(k)))
})

/* ─────────────── India-eligibility preserved / applicant_country honesty ─────────────── */

test("applicant_country: explicit India mention -> 'IN'", () => {
  assert.equal(explicitIndiaCountry(["India"]), "IN")
  assert.equal(explicitIndiaCountry(["Asia", "India", "Nepal"]), "IN")
})

test("applicant_country: 'Worldwide' / unrestricted / empty is NOT the same claim as 'India' — stays null (no default country)", () => {
  assert.equal(explicitIndiaCountry([]), null)
  assert.equal(explicitIndiaCountry(undefined), null)
  assert.equal(explicitIndiaCountry(["Worldwide"]), null)
  assert.equal(explicitIndiaCountry(["Global", "Remote", "Anywhere"]), null)
})

test("a row with no explicit India country never gets a JobPosting applicant-location claim (resolveApplicantCountry has nothing to read)", () => {
  const row = toRow(rawJob({ locationRestrictions: ["Worldwide"] }))
  assert.equal(row.applicant_country, null)
})

/* ─────────────── source dates: only the source's own pubDate/expiryDate, never invented ─────────────── */

test("unixToIso: converts a real unix-seconds timestamp to ISO", () => {
  const iso = unixToIso(1790651711)
  assert.match(iso!, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/)
})

test("unixToIso: missing / zero / NaN / absurd-year input -> null, never a fabricated date", () => {
  assert.equal(unixToIso(undefined), null)
  assert.equal(unixToIso(0), null)
  assert.equal(unixToIso(Number.NaN), null)
  assert.equal(unixToIso(10), null) // 1970 — corrupt/placeholder, not a real posting date
})

test("toRow: source_posted_at comes ONLY from the source's pubDate; application_deadline ONLY from expiryDate", () => {
  const row = toRow(rawJob())
  assert.notEqual(row.source_posted_at, null)
  assert.notEqual(row.application_deadline, null)
  const noDates = toRow(rawJob({ pubDate: undefined, expiryDate: undefined }))
  assert.equal(noDates.source_posted_at, null)
  assert.equal(noDates.application_deadline, null)
})

/* ─────────────── expiry: a real past deadline closes the row through the existing openness gate ─────────────── */

test("a row whose source expiryDate has already passed is NOT open (isOpen), even though status is still 'active'", () => {
  const past = Math.floor(Date.now() / 1000) - 3600
  const row = toRow(rawJob({ expiryDate: past }))
  assert.equal(row.status, "active")
  assert.equal(isOpen(row), false)
})

test("a row with a future (or no) expiryDate stays open", () => {
  const future = Math.floor(Date.now() / 1000) + 3600
  assert.equal(isOpen(toRow(rawJob({ expiryDate: future }))), true)
  assert.equal(isOpen(toRow(rawJob({ expiryDate: undefined }))), true)
})

/* ─────────────── quantities are never fabricated ─────────────── */

test("applicants is always 0 (real, not fabricated) on a freshly-mapped sourced row", () => {
  assert.equal(toRow(rawJob()).applicants, 0)
})

/* ─────────────── safe no-op without Supabase configured (no accidental network/DB call) ─────────────── */

test("ingestHimalayasWfhJobs(): with no Supabase admin credentials configured, returns a clean no-op and never fetches", async () => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  const summary = await ingestHimalayasWfhJobs()
  assert.equal(summary.ok, false)
  assert.equal(summary.reason, "supabase-admin-not-configured")
  assert.equal(summary.fetched, 0)
})

setTimeout(() => {
  console.log(`\nhimalayas WFH ingestion tests: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}, 0)
