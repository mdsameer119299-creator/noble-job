/**
 * govtNavStats.test.ts — REGRESSION for the misleading hub/category/state
 * "teaser count" bug found during Oct 2026 validation of PR #48's preview.
 *
 * `computeNavStats()` feeds the browse-grid cards rendered by `GovtNavGrids`
 * (the government hub's "Browse by Category" / "Govt Jobs by State / UT" /
 * "Govt Jobs by Qualification" sections) — e.g. a category card's "N+
 * notices" pill and a state card's "N national government jobs available"
 * line. Those numbers must never promise more than what the real, strictly
 * gated listing underneath them (`getGovtJobs()` / `getGovtJobsFiltered()`
 * in govtJobService.ts, both of which end with
 * `list.filter(isCurrentGovtNotification)`) will actually show.
 *
 * Confirmed live (2026-10-25): a category card read "132+ notices" and a
 * state card read "31 national government jobs available" while the
 * strictly-gated listing page for that exact category/state correctly
 * showed zero results. Root cause: `computeNavStats()` filtered job-type
 * rows by `isActiveGovtJob` only (status=active, last_date not passed) —
 * never by the 365-day source-publication-date freshness gate
 * (`isCurrentGovtNotification`) the real listings apply as their last step.
 * The two code paths had silently diverged.
 *
 * These tests exercise the exact, unmodified `computeNavStats()` export
 * against fixture pools — no Supabase, no Next.js runtime — matching this
 * repo's other dependency-free unit tests (govtListingFreshness.test.ts,
 * govtIntegrity.test.ts).
 *
 *   npx tsx src/lib/services/govtNavStats.test.ts
 */
import assert from "node:assert/strict"
import { computeNavStats } from "./govtNavStats"
import type { GovtJob } from "@/types/govtJob"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}

/** A minimal, realistic active GovtJob. Override only what each test needs. */
const job = (over: Partial<GovtJob> = {}): GovtJob => ({
  id: "job-1", slug: "job-1", title: "Test Recruitment 2026", org: "Test Org", short: "Test Org",
  post: "Clerk", vacancies: "100", qualification: "12th Pass", ageRange: "18-30", fee: "₹500",
  lastDate: "2027-01-01", salary: "As per rules", location: "India", tab: "latest",
  color: "#000", status: "active",
  recordType: "notification", sourcePublishedAt: "2026-10-01T00:00:00.000Z",
  ...over,
})

/* ------------------------------------------------------------------ */
/* The core bug: job-type category/state/qualification/national stats */
/* must agree with the real, gated listing — not just "active".       */
/* ------------------------------------------------------------------ */

test("REGRESSION — an active-but-stale (no real source_published_at) banking notification is NOT counted in the 'banking' category teaser, matching the real listing (which would also show zero)", () => {
  // Shaped like the real production gap: active, genuinely a notification, but
  // never had a publish date extracted (e.g. ibps/uppsc-style rows).
  const pool = [job({ id: "stale", org: "IBPS", title: "IBPS Clerk Recruitment 2026", sourcePublishedAt: undefined })]
  const stats = computeNavStats(pool)
  assert.equal(stats.categories["banking"].notifications, 0, "a dateless notification must not inflate the category teaser count")
})

test("REGRESSION — a stale (>365 day old) notification is excluded from category/state/qualification/national teaser counts", () => {
  const pool = [job({ id: "old", org: "IBPS", title: "IBPS Clerk Recruitment 2024", stateSlug: "madhya-pradesh", state: "Madhya Pradesh", qualificationTags: ["10th-pass"], sourcePublishedAt: "2024-01-01T00:00:00.000Z" })]
  const stats = computeNavStats(pool)
  assert.equal(stats.categories["banking"].notifications, 0)
  assert.equal(stats.states["madhya-pradesh"].notifications, 0)
  assert.equal(stats.qualifications["10th-pass"].notifications, 0)
  assert.equal(stats.national.notifications, 0)
})

test("a genuinely current, correctly dated notification IS counted in every job-type teaser it matches", () => {
  const pool = [job({ id: "fresh", org: "IBPS", title: "IBPS Clerk Recruitment 2026", stateSlug: "madhya-pradesh", state: "Madhya Pradesh", qualificationTags: ["10th-pass"], sourcePublishedAt: "2026-10-01T00:00:00.000Z" })]
  const stats = computeNavStats(pool)
  assert.equal(stats.categories["banking"].notifications, 1)
  assert.equal(stats.states["madhya-pradesh"].notifications, 1)
  assert.equal(stats.qualifications["10th-pass"].notifications, 1)
})

test("REGRESSION — the national pool (feeding every state card's 'N national jobs available' line) excludes stale/dateless rows exactly like getGovtJobsFiltered() would", () => {
  const pool = [
    job({ id: "national-stale", stateSlug: undefined, state: "All India", sourcePublishedAt: undefined }),
    job({ id: "national-fresh", stateSlug: undefined, state: "All India", sourcePublishedAt: "2026-10-01T00:00:00.000Z" }),
  ]
  const stats = computeNavStats(pool)
  assert.equal(stats.national.notifications, 1, "only the dated national row should count")
  // A state with no state-specific jobs of its own still sees this exact national figure.
  assert.equal(stats.states["kerala"].national.notifications, 1)
  assert.equal(stats.states["kerala"].notifications, 0)
})

test("REGRESSION — 'latest' category's fallback branch (used when no row matches its own scope) is also gated, not just the primary match", () => {
  // jobMatchesCategory's "latest" scope matches tab==="latest" directly, so the
  // fallback branch in computeNavStats only fires when the primary match is
  // empty. Exercise it with a stale/dateless latest-tab row: the fallback must
  // not resurrect it.
  const pool = [job({ id: "stale-latest", tab: "latest", sourcePublishedAt: undefined })]
  const stats = computeNavStats(pool)
  assert.equal(stats.categories["latest-notifications"].notifications, 0)
})

/* ------------------------------------------------------------------ */
/* Content categories (results / admit cards / answer keys) must stay */
/* UNGATED — isCurrentGovtNotification always rejects them by design, */
/* and getGovtJobs() never gates those tabs either.                   */
/* ------------------------------------------------------------------ */

test("a result row is counted in the 'results' content-category teaser even though it can never pass isCurrentGovtNotification", () => {
  const pool = [job({ id: "res-1", tab: "results", recordType: "result", sourcePublishedAt: "2026-10-01T00:00:00.000Z" })]
  const stats = computeNavStats(pool)
  assert.equal(stats.categories["results"].notifications, 1, "content categories read from the unfiltered active pool, not activeNotifications")
})

test("a result row with NO source_published_at at all is still counted in the 'results' teaser (content categories were never subject to this gate)", () => {
  const pool = [job({ id: "res-2", tab: "results", recordType: "result", sourcePublishedAt: undefined })]
  const stats = computeNavStats(pool)
  assert.equal(stats.categories["results"].notifications, 1)
})

test("admit-card and answer-key teasers behave the same way (ungated)", () => {
  const pool = [
    job({ id: "ac-1", tab: "admit", recordType: "admit_card", sourcePublishedAt: undefined }),
    job({ id: "ak-1", tab: "answer", recordType: "answer_key", sourcePublishedAt: undefined }),
  ]
  const stats = computeNavStats(pool)
  assert.equal(stats.categories["admit-cards"].notifications, 1)
  assert.equal(stats.categories["answer-keys"].notifications, 1)
})

/* ------------------------------------------------------------------ */
/* Expired rows must never leak into either pool.                     */
/* ------------------------------------------------------------------ */

test("an expired row is excluded from both the job-type AND the content-category teasers", () => {
  const pool = [
    job({ id: "expired-notif", status: "expired", sourcePublishedAt: "2026-10-01T00:00:00.000Z" }),
    job({ id: "expired-result", tab: "results", recordType: "result", status: "expired" }),
  ]
  const stats = computeNavStats(pool)
  assert.equal(stats.categories["latest-notifications"].notifications, 0)
  assert.equal(stats.categories["results"].notifications, 0)
})

console.log(`\ngovtNavStats (teaser-count freshness-gate) tests: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
