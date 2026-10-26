/**
 * hubCounts.test.ts — regression for the two unsupported government claims found in the PR #54 release review.
 *
 *   npm run test:govt-hub-counts
 *
 *   • "61,352 Roles to Explore" (homepage Government card): a vacancy total over every active row, labelled as roles,
 *     while the page it opens lists the current notifications only.
 *   • "36 States Covered": the size of the state taxonomy, not a property of any listing.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { currentNotifications, notificationCountFor, countStatesWithListings } from "./hubCounts"
import { INDIAN_STATES } from "../config/govtTaxonomy"
import { computeNavStats } from "../services/govtNavStats"
import type { GovtJob } from "@/types/govtJob"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8")
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()
const job = (over: Partial<GovtJob> = {}): GovtJob => ({
  id: "job-1", slug: "job-1", title: "Test Recruitment 2026", org: "Test Org", short: "Test Org",
  post: "Clerk", vacancies: "100", qualification: "12th Pass", ageRange: "18-30", fee: "₹500",
  lastDate: "2099-01-01", salary: "As per rules", location: "India", tab: "latest",
  color: "#000", status: "active", recordType: "notification", sourcePublishedAt: daysAgo(10),
  ...over,
})

// A pool shaped like the live one: current notices (national + state-specific), a stale one, a non-notification,
// and one outlier row with a huge stated vacancy count.
const pool: GovtJob[] = [
  job({ id: "n1", state: "All India", org: "SSC", title: "SSC CGL Recruitment 2026", vacancies: "5000" }),
  job({ id: "n2", state: "All India", org: "Indian Army", title: "Army Agniveer Recruitment 2026", vacancies: "3000" }),
  job({ id: "s1", state: "Madhya Pradesh", stateSlug: "madhya-pradesh", org: "MPPSC", title: "MPPSC Recruitment 2026" }),
  job({ id: "s2", state: "Madhya Pradesh", stateSlug: "madhya-pradesh", org: "MPPSC", title: "MPPSC Assistant Recruitment 2026" }),
  job({ id: "s3", state: "Gujarat", stateSlug: "gujarat", org: "GPSC", title: "GPSC Recruitment 2026" }),
  job({ id: "x1", state: "Delhi (NCT)", stateSlug: "delhi", org: "DHC", title: "Delhi Recruitment 2024", sourcePublishedAt: daysAgo(900), vacancies: "42564" }),
  job({ id: "x2", state: "Kerala", stateSlug: "kerala", org: "KPSC", title: "KPSC Result 2026", tab: "results", recordType: "result" }),
  job({ id: "x3", state: "Assam", stateSlug: "assam", org: "APSC", title: "APSC Recruitment 2026", sourcePublishedAt: undefined }),
]

test("current notifications exclude stale, dateless and non-notification rows", () => {
  assert.deepEqual(currentNotifications(pool).map(j => j.id).sort(), ["n1", "n2", "s1", "s2", "s3"])
})

test("the government card count equals the notifications the government page lists (not a vacancy total over all active rows)", () => {
  assert.equal(notificationCountFor(pool), 5)
  const naive = pool.reduce((s, j) => s + (Number(j.vacancies) || 0), 0)
  assert.notEqual(notificationCountFor(pool), naive)
  assert.ok(naive > 40000, "premise: the all-rows vacancy total is the inflated number the card used to show")
})

test("a category card count matches the hub's own category teaser (same pool, same predicate)", () => {
  const nav = computeNavStats(pool)
  for (const slug of ["defence", "railway", "ssc", "banking"]) {
    assert.equal(notificationCountFor(pool, slug), nav.categories[slug].notifications, slug)
  }
})

test("states: counts only states / UTs with a state-specific CURRENT notice — never the taxonomy size", () => {
  assert.equal(countStatesWithListings(pool), 2) // madhya-pradesh, gujarat (delhi is stale, kerala is a result, assam has no date)
  assert.ok(INDIAN_STATES.length > 30)
  assert.notEqual(countStatesWithListings(pool), INDIAN_STATES.length)
  assert.equal(countStatesWithListings([]), 0)
})

test("states: agrees with the state grid's own per-state notice counts", () => {
  const nav = computeNavStats(pool)
  const withOwn = INDIAN_STATES.filter(s => nav.states[s.slug].notifications > 0).length
  assert.equal(countStatesWithListings(pool), withOwn)
})

test("states: national notices are not attributed to any state; unknown slugs are ignored", () => {
  assert.equal(countStatesWithListings([job({ state: "All India" }), job({ id: "z", stateSlug: "atlantis", state: "Atlantis" })]), 0)
})

test("wiring: no surface derives a govt count from the taxonomy length or an unfiltered vacancy sum", () => {
  const hub = strip(read("src/lib/services/govtHubStats.ts"))
  assert.doesNotMatch(hub, /INDIAN_STATES\.length/)
  assert.match(hub, /countStatesWithListings\(jobs\)/)
  const cards = strip(read("src/lib/services/categoryMarketplaceStats.ts"))
  assert.doesNotMatch(cards, /sumRealVacancies/)
  assert.match(cards, /notificationCountFor\(pool/)
  assert.doesNotMatch(strip(read("src/components/heroes/CategoryHero.tsx")), /States Covered/)
})

test("wiring: government cards are labelled as notifications, job-board cards stay 'Roles to Explore'", () => {
  const cards = strip(read("src/lib/services/categoryMarketplaceStats.ts"))
  assert.match(cards, /GOVT_CARDS\s*=\s*new Set<[^>]*>\(\["government-jobs", "defence", "railway"\]\)/)
  assert.match(cards, /unit === "roles" \? "Roles to Explore"/)
})

test("exact counters carry no '+' suffix", () => {
  assert.doesNotMatch(read("src/components/govt/GovtStatsClient.tsx"), /<span[^>]*>\+<\/span>/)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
