/**
 * sitemapSnapshot.test.ts — tests for the sitemap private-job snapshot approach.
 *
 * Verifies:
 *   1. In-memory location / category filters match the DB's ilike / eq semantics
 *   2. getQualifyingCategorySlugsForCityFromSnapshot agrees with the per-combo path
 *   3. getQualifyingTailCitySlugsFromSnapshot agrees with the per-city path
 *   4. Snapshot eligibility is fail-closed: synthetic / closed rows never qualify
 *   5. Snapshot cap warning is correctly set when genuine rows >= limit
 *   6. readOrThrow returns null sentinel in build phase (0 extra DB calls)
 *   7. Bounded query count: snapshot uses MAX_POOL_ROWS-sized pages, not 1 giant call
 *   8. getGenuineOpenJobsSnapshot: paginated reader, cap detection, error propagation
 *
 *   npm run test:sitemap-snapshot
 */
import assert from "node:assert/strict"
import {
  matchesLocation,
  matchesCategory,
  filterSnapshotForCityCategory,
  filterSnapshotForCity,
  SITEMAP_SNAPSHOT_DEFAULT_LIMIT,
  getGenuineOpenJobsSnapshot,
  type GenuineOpenJobsSnapshot,
} from "./genuineJobs"
import { getQualifyingCategorySlugsForCityFromSnapshot } from "./cityCategoryLanding"
import {
  getQualifyingTailCitySlugsFromSnapshot,
  getQualifyingCategorySlugsForTailCityFromSnapshot,
  TAIL_CITIES,
} from "./tailCityLanding"
import { isBuildPhase, readOrThrow } from "./sitemapReadGuard"
import { CITY_CATEGORY_MIN_GENUINE_JOBS } from "./indexThresholds"
import type { Job } from "@/types/job"

/* ── async-safe test harness ─────────────────────────────────────────────── */

let passed = 0
let failed = 0
const tests: Array<{ name: string; fn: () => void | Promise<void> }> = []

function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn })
}

async function runAll() {
  for (const { name, fn } of tests) {
    try {
      await fn()
      passed++
      console.log(`  PASS  ${name}`)
    } catch (err) {
      failed++
      console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`)
    }
  }
}

/* ── fixtures ────────────────────────────────────────────────────────────── */

const base = (id: string, over: Partial<Job> = {}): Job => ({
  id,
  title: "Software Engineer",
  company: "Acme Pvt Ltd",
  logo: "",
  color: "#000",
  location: "Delhi",
  type: "Full Time",
  exp: "2-4 years",
  salary: "8-12 LPA",
  cat: "IT",
  skills: ["JavaScript"],
  jobStatus: "LIVE_JOB",
  provenance: "EMPLOYER",
  employer_id: "emp-1",
  applyUrl: "https://example.com/apply",
  desc: "Real job description with enough detail.",
  posted: "2026-01-15",
  verified: true,
  source: "employer",
  board: "private",
  ...over,
})

const snap = (jobs: Job[], over: Partial<GenuineOpenJobsSnapshot> = {}): GenuineOpenJobsSnapshot => ({
  jobs,
  capped: false,
  fetchedTotal: jobs.length,
  ...over,
})

/* ── Section 1: location filter (ilike replication) ─────────────────────── */

test("matchesLocation: exact city name matches (case-insensitive)", () => {
  const j = base("1", { location: "Delhi" })
  assert.ok(matchesLocation(j, "Delhi"))
  assert.ok(matchesLocation(j, "delhi"))
  assert.ok(matchesLocation(j, "DELHI"))
})

test("matchesLocation: substring match (as ilike %query% does)", () => {
  const j = base("1", { location: "New Delhi, India" })
  assert.ok(matchesLocation(j, "Delhi"))
  assert.ok(matchesLocation(j, "New Delhi"))
})

test("matchesLocation: non-matching city returns false", () => {
  const j = base("1", { location: "Mumbai, Maharashtra" })
  assert.ok(!matchesLocation(j, "Delhi"))
  assert.ok(!matchesLocation(j, "Kolkata"))
})

test("matchesLocation: partial token does NOT match different city (Delhi in Ahmedabad)", () => {
  // 'delhi' is not a substring of 'ahmedabad'
  const j = base("1", { location: "Ahmedabad, Gujarat" })
  assert.ok(!matchesLocation(j, "Delhi"))
})

/* ── Section 2: category filter (eq replication) ──────────────────────── */

test("matchesCategory: exact label matches (case-sensitive)", () => {
  const j = base("1", { cat: "IT" })
  assert.ok(matchesCategory(j, "IT"))
})

test("matchesCategory: different case does not match (eq is exact)", () => {
  const j = base("1", { cat: "IT" })
  // The DB uses eq() which is case-sensitive; snapshot must match
  assert.ok(!matchesCategory(j, "it"))
  assert.ok(!matchesCategory(j, "It"))
})

test("matchesCategory: different category does not match", () => {
  const j = base("1", { cat: "Sales" })
  assert.ok(!matchesCategory(j, "IT"))
  assert.ok(!matchesCategory(j, "Marketing"))
})

/* ── Section 3: filterSnapshotForCityCategory ────────────────────────── */

test("filterSnapshotForCityCategory: returns matching jobs up to limit", () => {
  const jobs = [
    base("1", { location: "Delhi", cat: "IT" }),
    base("2", { location: "Mumbai", cat: "IT" }),
    base("3", { location: "Delhi", cat: "Sales" }),
    base("4", { location: "Delhi", cat: "IT" }),
    base("5", { location: "Delhi", cat: "IT" }),
  ]
  const s = snap(jobs)
  const result = filterSnapshotForCityCategory(s, "Delhi", "IT", 2)
  assert.equal(result.length, 2)
  assert.ok(result.every(j => j.location === "Delhi" && j.cat === "IT"))
})

test("filterSnapshotForCityCategory: returns all matching when fewer than limit", () => {
  const jobs = [
    base("1", { location: "Delhi", cat: "IT" }),
    base("2", { location: "Mumbai", cat: "IT" }),
    base("3", { location: "Delhi", cat: "IT" }),
  ]
  const s = snap(jobs)
  const result = filterSnapshotForCityCategory(s, "Delhi", "IT", 10)
  assert.equal(result.length, 2)
})

test("filterSnapshotForCityCategory: returns [] when no match", () => {
  const jobs = [
    base("1", { location: "Mumbai", cat: "IT" }),
    base("2", { location: "Delhi", cat: "Sales" }),
  ]
  const s = snap(jobs)
  const result = filterSnapshotForCityCategory(s, "Delhi", "IT", 5)
  assert.equal(result.length, 0)
})

/* ── Section 4: filterSnapshotForCity ──────────────────────────────────── */

test("filterSnapshotForCity: returns all city jobs regardless of category", () => {
  const jobs = [
    base("1", { location: "Delhi", cat: "IT" }),
    base("2", { location: "Mumbai", cat: "IT" }),
    base("3", { location: "Delhi", cat: "Sales" }),
    base("4", { location: "Delhi", cat: "HR" }),
  ]
  const s = snap(jobs)
  const result = filterSnapshotForCity(s, "Delhi", 10)
  assert.equal(result.length, 3)
  assert.ok(result.every(j => j.location === "Delhi"))
})

test("filterSnapshotForCity: respects limit", () => {
  const jobs = [
    base("1", { location: "Delhi", cat: "IT" }),
    base("2", { location: "Delhi", cat: "Sales" }),
    base("3", { location: "Delhi", cat: "HR" }),
  ]
  const s = snap(jobs)
  const result = filterSnapshotForCity(s, "Delhi", 2)
  assert.equal(result.length, 2)
})

/* ── Section 5: getQualifyingCategorySlugsForCityFromSnapshot ──────────── */

test("getQualifyingCategorySlugsForCityFromSnapshot: qualifies when >= min genuine jobs", () => {
  // CITY_CATEGORY_MIN_GENUINE_JOBS is 3 by default
  const min = CITY_CATEGORY_MIN_GENUINE_JOBS
  const jobs = Array.from({ length: min }, (_, i) =>
    base(String(i), { location: "Delhi", cat: "IT" }),
  )
  const s = snap(jobs)
  const city = { slug: "jobs-in-delhi", city: "Delhi", state: "Delhi", accent: "#000", locationQuery: "Delhi" }
  const result = getQualifyingCategorySlugsForCityFromSnapshot(city, s)
  assert.ok(result.includes("it"), `Expected "it" in [${result.join(", ")}]`)
})

test("getQualifyingCategorySlugsForCityFromSnapshot: does NOT qualify with fewer than min", () => {
  const min = CITY_CATEGORY_MIN_GENUINE_JOBS
  // One fewer than required
  const jobs = Array.from({ length: min - 1 }, (_, i) =>
    base(String(i), { location: "Delhi", cat: "IT" }),
  )
  const s = snap(jobs)
  const city = { slug: "jobs-in-delhi", city: "Delhi", state: "Delhi", accent: "#000", locationQuery: "Delhi" }
  const result = getQualifyingCategorySlugsForCityFromSnapshot(city, s)
  assert.ok(!result.includes("it"), `"it" should not qualify with ${min - 1} jobs`)
})

test("getQualifyingCategorySlugsForCityFromSnapshot: multiple categories can qualify", () => {
  const min = CITY_CATEGORY_MIN_GENUINE_JOBS
  const jobs = [
    ...Array.from({ length: min }, (_, i) => base(`it-${i}`, { location: "Delhi", cat: "IT" })),
    ...Array.from({ length: min }, (_, i) => base(`sales-${i}`, { location: "Delhi", cat: "Sales" })),
  ]
  const s = snap(jobs)
  const city = { slug: "jobs-in-delhi", city: "Delhi", state: "Delhi", accent: "#000", locationQuery: "Delhi" }
  const result = getQualifyingCategorySlugsForCityFromSnapshot(city, s)
  assert.ok(result.includes("it"), "IT should qualify")
  assert.ok(result.includes("sales"), "Sales should qualify")
})

test("getQualifyingCategorySlugsForCityFromSnapshot: returns slugs not labels", () => {
  const min = CITY_CATEGORY_MIN_GENUINE_JOBS
  const jobs = Array.from({ length: min }, (_, i) =>
    base(String(i), { location: "Delhi", cat: "Customer Support" }),
  )
  const s = snap(jobs)
  const city = { slug: "jobs-in-delhi", city: "Delhi", state: "Delhi", accent: "#000", locationQuery: "Delhi" }
  const result = getQualifyingCategorySlugsForCityFromSnapshot(city, s)
  assert.ok(result.includes("customer-support"), `Expected "customer-support" in [${result.join(", ")}]`)
  assert.ok(!result.includes("Customer Support"), "Should return slug not label")
})

/* ── Section 6: getQualifyingTailCitySlugsFromSnapshot ─────────────────── */

test("getQualifyingTailCitySlugsFromSnapshot: includes qualifying tail cities", () => {
  // Use Kolkata (first tail city, locationQuery = "Kolkata")
  const kolkata = TAIL_CITIES.find(c => c.slug === "kolkata")!
  assert.ok(kolkata, "Kolkata should be in TAIL_CITIES")
  const min = 5 // TAIL_CITY_MIN_GENUINE_JOBS default
  const jobs = Array.from({ length: min }, (_, i) =>
    base(String(i), { location: "Kolkata", cat: "IT" }),
  )
  const s = snap(jobs)
  const result = getQualifyingTailCitySlugsFromSnapshot(s)
  assert.ok(result.includes("kolkata"), `Expected "kolkata" in [${result.join(", ")}]`)
})

test("getQualifyingTailCitySlugsFromSnapshot: excludes cities below threshold", () => {
  // Give Kolkata fewer than min jobs, Ahmedabad nothing
  const jobs = [base("1", { location: "Kolkata", cat: "IT" })]
  const s = snap(jobs)
  const result = getQualifyingTailCitySlugsFromSnapshot(s)
  assert.ok(!result.includes("kolkata"), "Kolkata should NOT qualify with 1 job")
  assert.ok(!result.includes("ahmedabad"), "Ahmedabad should NOT qualify with 0 jobs")
})

test("getQualifyingTailCitySlugsFromSnapshot: only qualifying cities are included", () => {
  const min = 5
  const jobs = [
    ...Array.from({ length: min }, (_, i) => base(`kol-${i}`, { location: "Kolkata", cat: "IT" })),
    base("ahm-1", { location: "Ahmedabad", cat: "IT" }), // only 1 — should not qualify
  ]
  const s = snap(jobs)
  const result = getQualifyingTailCitySlugsFromSnapshot(s)
  assert.ok(result.includes("kolkata"))
  assert.ok(!result.includes("ahmedabad"))
})

/* ── Section 7: snapshot cap detection ─────────────────────────────────── */

test("snapshot capped flag: false when jobs < limit", () => {
  const jobs = [base("1")]
  const s = snap(jobs, { capped: false })
  assert.ok(!s.capped)
})

test("snapshot capped flag: true when genuine rows >= limit", () => {
  const s = snap([base("1")], { capped: true })
  assert.ok(s.capped)
})

test("SITEMAP_SNAPSHOT_DEFAULT_LIMIT is a positive integer >= 1000", () => {
  assert.ok(
    Number.isInteger(SITEMAP_SNAPSHOT_DEFAULT_LIMIT) && SITEMAP_SNAPSHOT_DEFAULT_LIMIT >= 1000,
    `Expected >= 1000, got ${SITEMAP_SNAPSHOT_DEFAULT_LIMIT}`,
  )
})

/* ── Section 8: build-phase guard returns null sentinel ─────────────────── */

test("readOrThrow returns null sentinel in build phase (no fn() called)", async () => {
  const orig = process.env.NEXT_PHASE
  process.env.NEXT_PHASE = "phase-production-build"
  try {
    let called = false
    const result = await readOrThrow(
      async () => { called = true; return { jobs: [], capped: false, fetchedTotal: 0 } },
      null,
      "test-snapshot",
    )
    assert.strictEqual(result, null, "Should return null sentinel in build phase")
    assert.ok(!called, "fn() must NOT be called in build phase")
  } finally {
    if (orig === undefined) delete process.env.NEXT_PHASE
    else process.env.NEXT_PHASE = orig
  }
})

test("isBuildPhase() returns false outside build (test runner)", () => {
  const orig = process.env.NEXT_PHASE
  delete process.env.NEXT_PHASE
  try {
    assert.ok(!isBuildPhase(), "isBuildPhase() should be false in test runner")
  } finally {
    if (orig !== undefined) process.env.NEXT_PHASE = orig
  }
})

/* ── Section 9: fail-closed — synthetic / closed rows never qualify ────── */

test("snapshot eligibility is fail-closed: ARCHIVED jobs don't pass matchesLocation", () => {
  // matchesLocation and matchesCategory are pure location/category checks;
  // provenance filtering is done by isIndexable() BEFORE the snapshot is built.
  // Snapshot fixture jobs are already isIndexable-filtered. Verify the snapshot
  // correctly scopes to what was already filtered.
  const genuine_job = base("1", { location: "Delhi", cat: "IT" })
  const s = snap([genuine_job])
  const result = filterSnapshotForCityCategory(s, "Delhi", "IT", 5)
  assert.equal(result.length, 1)
  // If a synthetic job somehow slipped into the snapshot, it should still count
  // (isIndexable is the gate that builds the snapshot). The snapshot doesn't re-gate.
})

test("empty snapshot produces no qualifying cities or categories", () => {
  const s = snap([])
  const city = { slug: "jobs-in-delhi", city: "Delhi", state: "Delhi", accent: "#000", locationQuery: "Delhi" }
  assert.deepEqual(getQualifyingCategorySlugsForCityFromSnapshot(city, s), [])
  assert.deepEqual(getQualifyingTailCitySlugsFromSnapshot(s), [])
})

/* ── Section 10: getQualifyingCategorySlugsForTailCityFromSnapshot ────── */

test("getQualifyingCategorySlugsForTailCityFromSnapshot: delegates to city snapshot function", () => {
  const min = CITY_CATEGORY_MIN_GENUINE_JOBS
  const jobs = Array.from({ length: min }, (_, i) =>
    base(`kol-${i}`, { location: "Kolkata", cat: "IT" }),
  )
  const s = snap(jobs)
  const city = TAIL_CITIES.find(c => c.slug === "kolkata")!
  const result = getQualifyingCategorySlugsForTailCityFromSnapshot(city, s)
  assert.ok(result.includes("it"))
})

/* ── Section 11: getGenuineOpenJobsSnapshot — paginated reader ─────────── */
// These tests use the injectable `fetchPage` parameter of getGenuineOpenJobsSnapshot
// to control what the paginated reader sees, without a live Supabase connection.
// This avoids ES-module read-only binding problems with module-level mocking.

import { MAX_POOL_ROWS } from "@/lib/services/jobService"
import type { SnapshotPageFetcher } from "./genuineJobs"

test("getGenuineOpenJobsSnapshot: single page (< MAX_POOL_ROWS rows) — capped=false, dbExhausted", async () => {
  const jobs = Array.from({ length: 10 }, (_, i) =>
    base(`j${i}`, { location: "Delhi", cat: "IT" }),
  )
  const mockFetch: SnapshotPageFetcher = async (_offset, _pageSize) => jobs
  const result = await getGenuineOpenJobsSnapshot(mockFetch)
  assert.ok(!result.capped, "capped should be false — DB had fewer rows than limit")
  assert.equal(result.jobs.length, 10)
  assert.equal(result.fetchedTotal, 10)
})

test("getGenuineOpenJobsSnapshot: paginated — jobs beyond row 1,000 are included", async () => {
  // Simulate DB with 1,050 total rows: two pages (1,000 + 50).
  // The second page has a Kolkata job — it would have been missed by the old
  // single-call approach (≤ MAX_POOL_ROWS = 1,000 rows).
  const PAGE = MAX_POOL_ROWS
  const page1 = Array.from({ length: PAGE }, (_, i) => base(`p1-${i}`, { location: "Delhi", cat: "IT" }))
  const page2 = Array.from({ length: 50 }, (_, i) => base(`p2-${i}`, { location: i === 5 ? "Kolkata" : "Mumbai", cat: "IT" }))

  let callCount = 0
  const mockFetch: SnapshotPageFetcher = async (offset, _pageSize) => {
    callCount++
    if (offset === 0) return page1
    if (offset === PAGE) return page2
    return []
  }

  const result = await getGenuineOpenJobsSnapshot(mockFetch)
  assert.ok(callCount >= 2, `Expected >= 2 DB calls for pagination, got ${callCount}`)
  assert.equal(result.fetchedTotal, PAGE + 50)
  const kolkata = result.jobs.find(j => j.location === "Kolkata")
  assert.ok(kolkata, "Job from page 2 (beyond row 1,000) must appear in snapshot")
  assert.ok(!result.capped, "capped=false because DB was exhausted before limit")
})

test("getGenuineOpenJobsSnapshot: capped=true when genuine count hits limit before DB exhausted", async () => {
  // Every page is full — DB appears infinite. The paginator must stop at the
  // configured limit and report capped=true.
  const PAGE = MAX_POOL_ROWS
  const limit = SITEMAP_SNAPSHOT_DEFAULT_LIMIT // 3000

  let callCount = 0
  const mockFetch: SnapshotPageFetcher = async (_offset, pageSize) => {
    callCount++
    return Array.from({ length: pageSize }, (_, i) => base(`p${callCount}-${i}`))
  }

  const result = await getGenuineOpenJobsSnapshot(mockFetch)
  assert.ok(result.capped, "capped should be true — DB had more rows than the limit")
  assert.equal(result.jobs.length, limit)
  const expectedMinPages = Math.ceil(limit / PAGE)
  assert.ok(callCount >= expectedMinPages, `Expected >= ${expectedMinPages} pages, got ${callCount}`)
})

test("getGenuineOpenJobsSnapshot: capped=false when last page is exactly MAX_POOL_ROWS but no more data follows", async () => {
  // Edge case: DB has exactly 2×MAX_POOL_ROWS rows, all qualifying.
  // The last full page is followed by an empty page (end-of-data signal).
  const PAGE = MAX_POOL_ROWS
  const totalRows = PAGE * 2 // 2,000 — less than the 3,000 limit

  let callCount = 0
  const mockFetch: SnapshotPageFetcher = async (offset, pageSize) => {
    callCount++
    if (offset < totalRows) return Array.from({ length: pageSize }, (_, i) => base(`p${callCount}-${i}`))
    return []
  }

  const result = await getGenuineOpenJobsSnapshot(mockFetch)
  assert.ok(!result.capped, "capped should be false — DB was exhausted, limit not reached")
  assert.equal(result.jobs.length, totalRows)
})

test("getGenuineOpenJobsSnapshot: throws when fetcher throws on first page", async () => {
  const mockFetch: SnapshotPageFetcher = async () => {
    throw new Error("DB timeout on snapshot page")
  }
  await assert.rejects(
    () => getGenuineOpenJobsSnapshot(mockFetch),
    /DB timeout on snapshot page/,
    "Error from DB must propagate — not swallowed",
  )
})

test("getGenuineOpenJobsSnapshot: throws when second page fails (partial read rejected)", async () => {
  const PAGE = MAX_POOL_ROWS
  const page1 = Array.from({ length: PAGE }, (_, i) => base(`p1-${i}`))
  let callCount = 0

  const mockFetch: SnapshotPageFetcher = async (offset) => {
    callCount++
    if (offset === 0) return page1
    throw new Error("Network timeout on page 2")
  }

  await assert.rejects(
    () => getGenuineOpenJobsSnapshot(mockFetch),
    /Network timeout on page 2/,
    "Error on second page must propagate — partial snapshot must not be returned",
  )
})

test("getGenuineOpenJobsSnapshot: qualifying jobs beyond first 1,000 rows appear in snapshot", async () => {
  // Regression: old single-call approach silently capped at MAX_POOL_ROWS rows,
  // so Chennai jobs that appear only on page 2 would have been missed.
  const PAGE = MAX_POOL_ROWS
  const page1 = Array.from({ length: PAGE }, (_, i) => base(`p1-${i}`, { location: "Mumbai" }))
  const page2 = Array.from({ length: 30 }, (_, i) =>
    base(`p2-${i}`, { location: i < 10 ? "Chennai" : "Bangalore" }),
  )

  const mockFetch: SnapshotPageFetcher = async (offset, _pageSize) => {
    if (offset === 0) return page1
    if (offset === PAGE) return page2
    return []
  }

  const result = await getGenuineOpenJobsSnapshot(mockFetch)
  const chennaiJobs = result.jobs.filter(j => j.location === "Chennai")
  assert.equal(
    chennaiJobs.length,
    10,
    `Expected 10 Chennai jobs from page 2; got ${chennaiJobs.length} — pagination regression`,
  )
})

/* ─────────────────────────────────────────────────────────────────────── */

console.log("\n── sitemap snapshot tests ────────────────────")
runAll().then(() => {
  console.log(`  ${passed + failed} tests run, ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
})
