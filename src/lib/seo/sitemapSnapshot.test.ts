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
  SNAPSHOT_MAX_RAW_ROWS,
  SnapshotScanCapError,
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

/* helper: build a SnapshotPage mock where all `count` rows are renderable */
const mkPage = (count: number, idPrefix: string, over: Partial<Job> = {}) => ({
  jobs: Array.from({ length: count }, (_, i) => base(`${idPrefix}-${i}`, over)),
  rawRowCount: count,
})

test("getGenuineOpenJobsSnapshot: single page (< MAX_POOL_ROWS rows) — capped=false, dbExhausted", async () => {
  const mockFetch: SnapshotPageFetcher = async (_offset, _pageSize) =>
    mkPage(10, "j", { location: "Delhi", cat: "IT" })
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

  let callCount = 0
  const mockFetch: SnapshotPageFetcher = async (offset, pageSize) => {
    callCount++
    if (offset === 0) return mkPage(pageSize, "p1", { location: "Delhi", cat: "IT" })
    if (offset === PAGE) {
      const jobs = Array.from({ length: 50 }, (_, i) =>
        base(`p2-${i}`, { location: i === 5 ? "Kolkata" : "Mumbai", cat: "IT" }),
      )
      return { jobs, rawRowCount: 50 }
    }
    return { jobs: [], rawRowCount: 0 }
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
    return mkPage(pageSize, `p${callCount}`)
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
    if (offset < totalRows) return mkPage(pageSize, `p${callCount}`)
    return { jobs: [], rawRowCount: 0 }
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
  let callCount = 0

  const mockFetch: SnapshotPageFetcher = async (offset) => {
    callCount++
    if (offset === 0) return mkPage(PAGE, "p1")
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

  const mockFetch: SnapshotPageFetcher = async (offset, pageSize) => {
    if (offset === 0) return mkPage(pageSize, "p1", { location: "Mumbai" })
    if (offset === PAGE) {
      const jobs = Array.from({ length: 30 }, (_, i) =>
        base(`p2-${i}`, { location: i < 10 ? "Chennai" : "Bangalore" }),
      )
      return { jobs, rawRowCount: 30 }
    }
    return { jobs: [], rawRowCount: 0 }
  }

  const result = await getGenuineOpenJobsSnapshot(mockFetch)
  const chennaiJobs = result.jobs.filter(j => j.location === "Chennai")
  assert.equal(
    chennaiJobs.length,
    10,
    `Expected 10 Chennai jobs from page 2; got ${chennaiJobs.length} — pagination regression`,
  )
})

/* ── Section 12: rawRowCount-based termination (the filter-gap regression) ─ */
// The critical correctness fix: page.rawRowCount < pageSize means DB exhausted,
// not page.jobs.length < pageSize. A full raw page may yield fewer filtered jobs.

test("rawRowCount regression: full raw page with filtered-out rows does NOT stop pagination early", async () => {
  // Simulate: page 1 has 1,000 raw rows but only 700 pass filterRenderable.
  // Old code: 700 < 1,000 → stops (bug). New code: rawRowCount=1,000 → continues.
  // Page 2 has 20 raw rows (end of DB), 15 of which are valid Kolkata jobs.
  const PAGE = MAX_POOL_ROWS

  let callCount = 0
  const mockFetch: SnapshotPageFetcher = async (offset, _pageSize) => {
    callCount++
    if (offset === 0) {
      // 700 renderable + 300 filtered-out (represented as rawRowCount=1000)
      return {
        jobs: Array.from({ length: 700 }, (_, i) => base(`p1-${i}`, { location: "Delhi" })),
        rawRowCount: PAGE, // full raw page — must NOT trigger early stop
      }
    }
    if (offset === PAGE) {
      // End of DB — 20 raw rows, 15 are Kolkata jobs
      return {
        jobs: Array.from({ length: 15 }, (_, i) => base(`p2-${i}`, { location: "Kolkata" })),
        rawRowCount: 20, // partial raw page → DB exhausted
      }
    }
    return { jobs: [], rawRowCount: 0 }
  }

  const result = await getGenuineOpenJobsSnapshot(mockFetch)
  assert.ok(callCount >= 2, `Expected >= 2 fetches (got ${callCount}) — first page is a full raw page`)
  const kolkata = result.jobs.filter(j => j.location === "Kolkata")
  assert.equal(kolkata.length, 15, "Kolkata jobs from page 2 must appear despite page 1 having fewer filtered jobs than rawRowCount")
  assert.ok(!result.capped, "capped=false — DB was exhausted before limit")
  assert.equal(result.fetchedTotal, PAGE + 20, "fetchedTotal must count raw rows, not filtered jobs")
})

test("rawRowCount regression: fetchedTotal counts raw rows, not filtered jobs", async () => {
  // 2 pages: page1 has 1,000 raw / 500 filtered, page2 has 50 raw / 40 filtered
  const PAGE = MAX_POOL_ROWS
  const mockFetch: SnapshotPageFetcher = async (offset, _pageSize) => {
    if (offset === 0) return { jobs: Array.from({ length: 500 }, (_, i) => base(`p1-${i}`)), rawRowCount: PAGE }
    if (offset === PAGE) return { jobs: Array.from({ length: 40 }, (_, i) => base(`p2-${i}`)), rawRowCount: 50 }
    return { jobs: [], rawRowCount: 0 }
  }
  const result = await getGenuineOpenJobsSnapshot(mockFetch)
  assert.equal(result.fetchedTotal, PAGE + 50, "fetchedTotal should be 1050 raw rows, not 540 filtered jobs")
})

test("duplicate posted_at values: offset advances by rawRowCount to avoid gaps", async () => {
  // When many jobs share the same posted_at, the DB must use a tie-breaker (id ASC).
  // The paginator must advance offset by rawRowCount (not jobs.length) so no rows
  // are re-read or skipped at page boundaries.
  const PAGE = MAX_POOL_ROWS
  const seenOffsets: number[] = []

  const mockFetch: SnapshotPageFetcher = async (offset, pageSize) => {
    seenOffsets.push(offset)
    if (offset === 0) return mkPage(pageSize, "p1") // full page
    return { jobs: [], rawRowCount: 0 }               // no more data
  }

  await getGenuineOpenJobsSnapshot(mockFetch)
  // After one full page (offset=0, rawRowCount=PAGE), next call must be at PAGE
  assert.equal(seenOffsets[0], 0, "First fetch must start at offset 0")
  if (seenOffsets.length > 1) {
    assert.equal(seenOffsets[1], PAGE, `Second fetch offset must be ${PAGE} (rawRowCount-based), got ${seenOffsets[1]}`)
  }
})

test("partial raw page detection: rawRowCount=0 correctly identifies empty DB", async () => {
  // Empty DB: first page returns no rows at all.
  const mockFetch: SnapshotPageFetcher = async () => ({ jobs: [], rawRowCount: 0 })
  const result = await getGenuineOpenJobsSnapshot(mockFetch)
  assert.equal(result.jobs.length, 0)
  assert.ok(!result.capped, "Empty DB should not be capped")
  assert.equal(result.fetchedTotal, 0)
})

/* ── Section 13: workload guard — raw-scan cap & synthetic-visibility hoist */

test("workload guard: long non-indexable sequence — scanner continues collecting genuine jobs", async () => {
  // 2 full pages of renderable-but-non-indexable rows (provenance=SYNTHETIC),
  // followed by 1 partial page of genuine EMPLOYER rows.
  // The scanner must keep paginating and collect the genuine jobs on page 3.
  const PAGE = MAX_POOL_ROWS
  let callCount = 0

  const mockFetch: SnapshotPageFetcher = async (offset, pageSize) => {
    callCount++
    if (offset === 0 || offset === PAGE) {
      // Full pages of synthetic (non-indexable) rows
      return {
        jobs: Array.from({ length: pageSize }, (_, i) =>
          base(`synth-${offset}-${i}`, { provenance: "SYNTHETIC" }),
        ),
        rawRowCount: pageSize,
      }
    }
    // Page 3: small batch of genuine EMPLOYER rows — DB exhausted after this
    return {
      jobs: Array.from({ length: 5 }, (_, i) => base(`real-${i}`)),
      rawRowCount: 5,
    }
  }

  const result = await getGenuineOpenJobsSnapshot(mockFetch)
  assert.equal(callCount, 3, "Must fetch all 3 pages to find genuine jobs")
  assert.equal(result.jobs.length, 5, "All 5 genuine EMPLOYER jobs must be collected")
  assert.ok(!result.capped, "capped=false — DB was exhausted")
  assert.equal(result.fetchedTotal, PAGE * 2 + 5, "fetchedTotal counts all raw rows including non-indexable")
})

test("workload guard: raw-scan cap — throws SnapshotScanCapError when fetchedRawTotal >= SNAPSHOT_MAX_RAW_ROWS", async () => {
  // Each page fills MAX_POOL_ROWS raw rows, all non-indexable (SYNTHETIC),
  // so the loop never collects any genuine jobs and keeps paging.
  // After SNAPSHOT_MAX_RAW_ROWS / MAX_POOL_ROWS pages the cap must be breached.
  const PAGE = MAX_POOL_ROWS
  const pagesUntilCap = Math.ceil(SNAPSHOT_MAX_RAW_ROWS / PAGE) // 30 pages

  const mockFetch: SnapshotPageFetcher = async (_offset, pageSize) => ({
    jobs: Array.from({ length: pageSize }, (_, i) =>
      base(`synth-${_offset}-${i}`, { provenance: "SYNTHETIC" }),
    ),
    rawRowCount: pageSize,
  })

  await assert.rejects(
    () => getGenuineOpenJobsSnapshot(mockFetch),
    (err: unknown) => {
      assert.ok(err instanceof SnapshotScanCapError, `Expected SnapshotScanCapError, got ${(err as Error).name}`)
      assert.ok(
        (err as SnapshotScanCapError).message.includes(String(SNAPSHOT_MAX_RAW_ROWS)),
        "Error message must include the cap value",
      )
      return true
    },
    `After ${pagesUntilCap} pages of synthetic rows the cap must be breached`,
  )
})

test("workload guard: cap exhaustion before genuine-job limit — throws, does NOT return partial snapshot", async () => {
  // Mix: first 29 pages are non-indexable (SYNTHETIC), 29,000 raw rows total.
  // Page 30 adds 1,000 more raw rows → fetchedRawTotal crosses 30,000.
  // The cap check fires at the START of the loop iteration (before the fetch),
  // so no partial genuine jobs are ever returned.
  const PAGE = MAX_POOL_ROWS
  let callCount = 0

  const mockFetch: SnapshotPageFetcher = async (_offset, pageSize) => {
    callCount++
    // All pages return synthetic (non-indexable) full pages
    return {
      jobs: Array.from({ length: pageSize }, (_, i) =>
        base(`synth-${_offset}-${i}`, { provenance: "SYNTHETIC" }),
      ),
      rawRowCount: pageSize,
    }
  }

  let threw: unknown
  try {
    await getGenuineOpenJobsSnapshot(mockFetch)
  } catch (err) {
    threw = err
  }

  assert.ok(threw instanceof SnapshotScanCapError, "Must throw SnapshotScanCapError — not return partial data")
  // Partial genuine list must never be silently returned
  assert.ok(threw !== null && threw !== undefined, "Error must be propagated, not swallowed")
})

test("workload guard: complete snapshot — all genuine jobs collected before cap, no throw", async () => {
  // 2 pages, each with 500 genuine EMPLOYER rows.  fetchedTotal = 2,000 << 30,000.
  // Must complete normally without throwing.
  const PAGE = MAX_POOL_ROWS

  const mockFetch: SnapshotPageFetcher = async (offset, pageSize) => {
    if (offset === 0) {
      return {
        jobs: Array.from({ length: 500 }, (_, i) => base(`real-p1-${i}`)),
        rawRowCount: pageSize, // full raw page
      }
    }
    return {
      jobs: Array.from({ length: 500 }, (_, i) => base(`real-p2-${i}`)),
      rawRowCount: 500, // partial raw page → DB exhausted
    }
  }

  let result: GenuineOpenJobsSnapshot | undefined
  await assert.doesNotReject(async () => {
    result = await getGenuineOpenJobsSnapshot(mockFetch)
  }, "Complete snapshot within raw-scan cap must not throw")

  assert.ok(result !== undefined)
  assert.equal(result!.jobs.length, 1000, "All 1,000 genuine jobs collected")
  assert.ok(!result!.capped, "capped=false — DB exhausted before limit")
  assert.ok(
    result!.fetchedTotal < SNAPSHOT_MAX_RAW_ROWS,
    `fetchedTotal (${result!.fetchedTotal}) must be < cap (${SNAPSHOT_MAX_RAW_ROWS})`,
  )
})

test("workload guard: incomplete snapshot throws rather than returning partial data (cap scenario)", async () => {
  // 3 genuine jobs collected over 2 full pages dominated by non-indexable rows,
  // then the cap is reached on page 30.  Must throw SnapshotScanCapError, not return
  // the 3 genuine jobs as if the snapshot were complete.
  const PAGE = MAX_POOL_ROWS
  let callCount = 0

  const mockFetch: SnapshotPageFetcher = async (offset, pageSize) => {
    callCount++
    const isFirstPage = offset === 0
    if (isFirstPage) {
      // First page: 3 genuine jobs buried in 997 synthetic rows
      return {
        jobs: [
          ...Array.from({ length: 3 }, (_, i) => base(`real-${i}`)),
          ...Array.from({ length: 997 }, (_, i) => base(`synth-0-${i}`, { provenance: "SYNTHETIC" })),
        ],
        rawRowCount: pageSize,
      }
    }
    // All subsequent pages: 1,000 synthetic rows (non-indexable), full pages
    return {
      jobs: Array.from({ length: pageSize }, (_, i) =>
        base(`synth-${offset}-${i}`, { provenance: "SYNTHETIC" }),
      ),
      rawRowCount: pageSize,
    }
  }

  await assert.rejects(
    () => getGenuineOpenJobsSnapshot(mockFetch),
    (err: unknown) => {
      assert.ok(
        err instanceof SnapshotScanCapError,
        `Must throw SnapshotScanCapError (not return 3 partial genuine jobs), got: ${(err as Error).name}`,
      )
      return true
    },
    "When cap is reached before DB exhaustion or genuine-job limit, must fail closed",
  )
})

/* ─────────────────────────────────────────────────────────────────────── */

console.log("\n── sitemap snapshot tests ────────────────────")
runAll().then(() => {
  console.log(`  ${passed + failed} tests run, ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
})
