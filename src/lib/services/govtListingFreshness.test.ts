/**
 * govtListingFreshness.test.ts — REGRESSION for the empty-hub / empty-state-page
 * bug found during the Oct 2026 preview verification of the stacked PR chain
 * (#44 → #45 → #47 → #48).
 *
 * Root cause: `getGovtJobs()` / `getGovtJobsFiltered()` in govtJobService.ts
 * both finish with `list.filter(isCurrentGovtNotification)` for the
 * recruitment-job surfaces (the government hub, every state/category/qualification
 * listing, and the sitemap routes built from them). `isCurrentGovtNotification()`
 * requires a real `source_published_at`, which is 0% populated across the
 * 206-row production dataset today (no ingested row has ever had a publish date
 * extracted for it) — so, as written, merging the gate as-is empties every one
 * of those listing surfaces, even though plenty of genuinely current
 * notifications exist in the pool.
 *
 * These tests do NOT touch the database or the Next.js runtime: they exercise
 * the exact `list.filter(isCurrentGovtNotification)` predicate the two listing
 * functions use, and the real (unmodified) adapter-level date extractor, against
 * fixture pools shaped like the real production rows. This is deliberately the
 * same dependency-free, pure-function style as govtIntegrity.test.ts.
 *
 *   npm run test:govt-listing-freshness
 */
import assert from "node:assert/strict"
import { isCurrentGovtNotification } from "@/lib/govt/recordType"
import { extractStatedPublishDate } from "@/lib/ingest/extractPublishedDate"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}

type Fixture = {
  id: string
  recordType: string
  tab: string
  title: string
  sourcePublishedAt: string | null
}

const NOW = new Date("2026-10-25T00:00:00.000Z")

/** The exact filter the two listing surfaces apply (govtJobService.ts). */
const listingFilter = (pool: Fixture[]) => pool.filter(j => isCurrentGovtNotification(j, NOW))

/* ------------------------- zero-result listings ------------------------- */

test("REGRESSION — a pool of genuine notifications with NO populated source_published_at (today's real production shape) filters to an empty, non-crashing list", () => {
  // Shaped like the real 206-row production dataset: every row is a bona fide
  // recruitment notification, but source_published_at has never been populated
  // by any ingestion run.
  const pool: Fixture[] = [
    { id: "a", recordType: "notification", tab: "latest", title: "IBPS Clerk Recruitment 2026", sourcePublishedAt: null },
    { id: "b", recordType: "notification", tab: "ssc", title: "SSC CGL Recruitment 2026", sourcePublishedAt: null },
    { id: "c", recordType: "notification", tab: "state", title: "UPPSC PCS Recruitment 2026", sourcePublishedAt: null },
  ]
  const result = listingFilter(pool)
  assert.deepEqual(result, [], "an undated pool must filter to [] — never throw, never fall back to showing undated rows")
})

test("REGRESSION — an empty filtered list is an honest zero, not a fabricated placeholder: nothing in the gate ever substitutes a date to keep a row visible", () => {
  const pool: Fixture[] = [{ id: "a", recordType: "notification", tab: "latest", title: "RRB Group D Recruitment 2026", sourcePublishedAt: null }]
  const result = listingFilter(pool)
  assert.equal(result.length, 0)
  // The gate's own code path never reads a fetch timestamp, an application
  // deadline, or "now" as a stand-in for the missing publish date — confirmed
  // structurally: isCurrentGovtNotification returns false the moment raw is
  // falsy, before any date arithmetic runs.
  assert.equal(isCurrentGovtNotification({ ...pool[0] }, NOW), false)
})

/* ------------------------ legitimate current notifications ------------------------ */

test("a genuinely current, correctly dated notification survives the listing filter alongside undated and stale rows that are correctly dropped", () => {
  const pool: Fixture[] = [
    { id: "current", recordType: "notification", tab: "latest", title: "MPPSC Scientific Officer Recruitment 2026, Dated 16/03/2026", sourcePublishedAt: "2026-03-16T00:00:00.000Z" },
    { id: "stale", recordType: "notification", tab: "latest", title: "Old Recruitment 2024", sourcePublishedAt: "2024-01-01T00:00:00.000Z" },
    { id: "undated", recordType: "notification", tab: "latest", title: "IBPS PO Recruitment 2026", sourcePublishedAt: null },
  ]
  const result = listingFilter(pool)
  assert.deepEqual(result.map(j => j.id), ["current"])
})

test("a result/admit/answer row is never treated as a current notification, even with a fresh source_published_at", () => {
  const pool: Fixture[] = [
    { id: "result", recordType: "result", tab: "results", title: "Railway NTPC Result 2026", sourcePublishedAt: "2026-10-01T00:00:00.000Z" },
    { id: "notif", recordType: "notification", tab: "latest", title: "Railway NTPC Recruitment 2026", sourcePublishedAt: "2026-10-01T00:00:00.000Z" },
  ]
  const result = listingFilter(pool)
  assert.deepEqual(result.map(j => j.id), ["notif"], "only the genuine notification row should pass; a result row never becomes a job opening")
})

/* -------------------------- undated source records -------------------------- */

test("REGRESSION — undated-source titles (IBPS/UPPSC/UKSSSC-shaped: no 'Dated'/'दिनांक' marker) never yield an extracted date, and are therefore safely excluded rather than crashing or defaulting to a fabricated one", () => {
  // Representative of real, currently-registered adapters that deliberately
  // never supply publishedAt (ibps.ts, uppsc.ts) and of the real UKSSSC listing
  // page shape, where the date sits in a sibling column the htmlList adapter's
  // anchor-only text scan cannot reach.
  const undatedTitles = [
    "IBPS Clerk XV Online Form 2026",
    "UPPSC PCS 2026 Online Registration",
    "UKSSSC Forest Guard Recruitment 2026 Apply Online",
  ]
  for (const title of undatedTitles) {
    const extracted = extractStatedPublishDate(title, NOW)
    assert.equal(extracted, undefined, `"${title}" must not yield a fabricated date`)
    const passes = isCurrentGovtNotification(
      { recordType: "notification", tab: "latest", title, sourcePublishedAt: extracted ?? null },
      NOW,
    )
    assert.equal(passes, false, `"${title}" must be safely excluded, not crash or pass with no real date`)
  }
})

test("sanity — a dated-source title (MPPSC-shaped, with an explicit 'Dated' marker) DOES yield a real date and correctly passes the gate when recent", () => {
  const title = "Madhya Pradesh Public Service Commission Recruitment Advertisement for State Service Exam 2026 (Advt. No./29/2025), Dated 16/09/2026"
  const extracted = extractStatedPublishDate(title, NOW)
  assert.ok(extracted, "expected a real extracted date")
  const passes = isCurrentGovtNotification({ recordType: "notification", tab: "latest", title, sourcePublishedAt: extracted }, NOW)
  assert.equal(passes, true)
})

console.log(`\ngovt listing freshness tests: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
