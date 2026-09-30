/**
 * himalayasService.test.ts — Private-overlay Himalayas identity/dedup fix
 * (strategy/internal-applications-admin-gate follow-up).
 *   npx tsx src/lib/services/himalayasService.test.ts
 *
 * Exercises the pure, exported `idFromGuid()` / `mapRawHimalayasJob()` with no
 * network call (matching this repo's other dependency-free unit tests — see
 * govtAutoUpdate.test.ts / himalayasWfhIngest.test.ts).
 *
 * Root cause this proves fixed: the raw Himalayas API has no `id` field, and
 * `slug` is the COMPANY's slug — identical across a company's distinct job
 * postings (verified live against the real API: 5 different job titles from
 * company "micro1" all returned `slug: "micro1"`). The previous
 * `j.slug || j.id` derivation collided distinct jobs from the same company
 * onto one id, silently dropping every posting after the first in both the
 * in-request dedup Set and the himalayas_jobs_cache upsert. `guid` (the
 * job's own unique permalink) is now used instead.
 */
import assert from "node:assert/strict"
import { idFromGuid, mapRawHimalayasJob, type HimalayasJob } from "./himalayasService"
import { isUsableLiveJob } from "../jobs/renderable"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}

const rawJob = (over: Partial<Record<string, unknown>> = {}): Record<string, unknown> => ({
  title: "Backend Engineer",
  companyName: "micro1",
  companySlug: "micro1", // the real, verified shape: COMPANY slug, identical across that company's jobs
  companyLogo: "https://example.com/logo.png",
  employmentType: "Full-time",
  seniority: ["Mid-level"],
  currency: "USD",
  minSalary: 60000,
  maxSalary: 90000,
  categories: ["software-engineering"],
  locationRestrictions: [],
  excerpt: "Build and ship backend services.",
  applicationLink: "https://himalayas.app/companies/micro1/jobs/backend-engineer/apply",
  guid: "https://himalayas.app/companies/micro1/jobs/backend-engineer",
  ...over,
})

/* ─────────────── root cause: same-company distinct jobs no longer collide ─────────────── */

test("REGRESSION: two different jobs from the SAME company (same slug) get DIFFERENT ids", () => {
  const jobA = rawJob({ title: "Salesforce Specialist", guid: "https://himalayas.app/companies/micro1/jobs/salesforce-specialist" })
  const jobB = rawJob({ title: "Senior NDT Inspector", guid: "https://himalayas.app/companies/micro1/jobs/senior-ndt-inspector-level-ii-iii" })
  assert.equal(jobA.companySlug, jobB.companySlug) // same company, confirming this is the collision scenario
  const idA = idFromGuid(jobA.guid as string)
  const idB = idFromGuid(jobB.guid as string)
  assert.notEqual(idA, idB)
})

test("REGRESSION: mapRawHimalayasJob — two distinct same-company jobs BOTH survive the in-request dedup Set (neither is dropped)", () => {
  const seen = new Set<string>()
  const jobA = rawJob({ title: "Salesforce Specialist", guid: "https://himalayas.app/companies/micro1/jobs/salesforce-specialist" })
  const jobB = rawJob({ title: "Senior NDT Inspector", guid: "https://himalayas.app/companies/micro1/jobs/senior-ndt-inspector-level-ii-iii" })
  const jobC = rawJob({ title: "Open Source GitHub Maintainer", guid: "https://himalayas.app/companies/micro1/jobs/open-source-github-maintainer" })
  const mappedA = mapRawHimalayasJob(jobA, seen)
  const mappedB = mapRawHimalayasJob(jobB, seen)
  const mappedC = mapRawHimalayasJob(jobC, seen)
  assert.ok(mappedA && mappedB && mappedC, "all three distinct postings must survive mapping")
  const ids = [mappedA!.id, mappedB!.id, mappedC!.id]
  assert.equal(new Set(ids).size, 3, `expected 3 distinct ids, got ${JSON.stringify(ids)}`)
  // Sanity: this is exactly what the OLD `slug || id` logic would have collapsed —
  // confirm the fixed id is NOT simply the shared company slug.
  for (const id of ids) assert.notEqual(id, "micro1")
})

/* ─────────────── stability across refreshes ─────────────── */

test("idFromGuid: the SAME job fetched twice (e.g. two separate refreshes) produces the SAME stable id", () => {
  const guid = "https://himalayas.app/companies/acme/jobs/backend-engineer"
  assert.equal(idFromGuid(guid), idFromGuid(guid))
})

test("mapRawHimalayasJob: re-mapping the identical raw job object (a later refresh) yields the identical id", () => {
  const j = rawJob()
  const idFirstRun = mapRawHimalayasJob(j, new Set())!.id
  const idSecondRun = mapRawHimalayasJob({ ...j }, new Set())!.id
  assert.equal(idFirstRun, idSecondRun)
})

/* ─────────────── identity depends on guid, not on company name/slug ─────────────── */

test("a company renaming itself (companyName/companySlug change) does NOT change the job's id, as long as the posting guid is unchanged — no accidental duplicate", () => {
  const before = rawJob({ companyName: "Acme Corp", companySlug: "acme-corp" })
  const after = rawJob({ companyName: "Acme Corporation Inc.", companySlug: "acme-corporation-inc" }) // same guid
  const idBefore = mapRawHimalayasJob(before, new Set())!.id
  const idAfter = mapRawHimalayasJob(after, new Set())!.id
  assert.equal(idBefore, idAfter)
})

test("company slug is NEVER used as the id (even alone, with no other job to collide with)", () => {
  const j = rawJob({ companySlug: "acme" })
  const mapped = mapRawHimalayasJob(j, new Set())!
  assert.notEqual(mapped.id, "acme")
  assert.notEqual(mapped.id, j.companySlug)
})

/* ─────────────── id shape: usable as a Noble Job identifier ─────────────── */

test("idFromGuid: output has no raw URL characters (safe id, no slashes/query strings) and a stable 'himalayas:' prefix", () => {
  const id = idFromGuid("https://himalayas.app/companies/acme/jobs/x?ref=abc&y=1")
  assert.doesNotMatch(id, /[/?&=]/)
  assert.match(id, /^himalayas:[a-f0-9]{32}$/)
})

test("a mapped job passes isUsableLiveJob (id/title/company/apply-url all real)", () => {
  const mapped = mapRawHimalayasJob(rawJob(), new Set())!
  assert.equal(isUsableLiveJob(mapped as unknown as Record<string, unknown>), true)
})

/* ─────────────── no job with no guid is silently faked ─────────────── */

test("a raw job with no guid at all is dropped, never assigned a made-up id", () => {
  const j = rawJob({ guid: undefined })
  assert.equal(mapRawHimalayasJob(j, new Set()), null)
})

/* ─────────────── existing Private-overlay behavior is unchanged ─────────────── */

test("existing filters are preserved: missing title/company -> dropped", () => {
  assert.equal(mapRawHimalayasJob(rawJob({ title: "" }), new Set()), null)
  assert.equal(mapRawHimalayasJob(rawJob({ companyName: "" }), new Set()), null)
})

test("existing filter preserved: scam-keyword titles are dropped", () => {
  const j = rawJob({ title: "Data Entry Job — registration fee required" })
  assert.equal(mapRawHimalayasJob(j, new Set()), null)
})

test("existing filter preserved: India-ineligible location restrictions are dropped", () => {
  const j = rawJob({ locationRestrictions: ["United States only"] })
  assert.equal(mapRawHimalayasJob(j, new Set()), null)
})

test("existing behavior preserved: applicationLink is used as applyUrl when present (guid is only a fallback)", () => {
  const mapped = mapRawHimalayasJob(rawJob(), new Set())!
  assert.equal(mapped.applyUrl, "https://himalayas.app/companies/micro1/jobs/backend-engineer/apply")
})

test("fallback improved, not broken: when applicationLink is missing, applyUrl falls back to guid (a REAL per-job URL) instead of a constructed link built from the id", () => {
  const j = rawJob({ applicationLink: undefined })
  const mapped = mapRawHimalayasJob(j, new Set())!
  assert.equal(mapped.applyUrl, j.guid)
  assert.match(mapped.applyUrl, /^https:\/\//)
})

test("existing output shape unchanged: badge/source/posted/verified/field mapping are exactly as before", () => {
  const mapped = mapRawHimalayasJob(rawJob(), new Set())! as HimalayasJob
  assert.equal(mapped.badge, "New")
  assert.equal(mapped.source, "Himalayas (Verified Remote)")
  assert.equal(mapped.posted, "Recent")
  assert.equal(mapped.verified, true)
  assert.equal(mapped.title, "Backend Engineer")
  assert.equal(mapped.company, "micro1")
})

console.log(`\nhimalayas private-overlay id/dedup tests: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
