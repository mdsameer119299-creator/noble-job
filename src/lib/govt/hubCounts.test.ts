/**
 * hubCounts.test.ts — regression for the two unsupported government claims found in the PR #54 release review.
 *
 *   npm run test:govt-hub-counts
 *
 *   • "61,352 Roles to Explore" (homepage Government card): a vacancy total over every active row, labelled as roles,
 *     while the page it opens lists the current notifications only.
 *   • "36 States Covered": the size of the state taxonomy, not a property of any listing.
 *   • "42,566 Vacancies": 42,564 of it came from ONE row (JNU Advt RC/75/2026) whose official notice states no total
 *     (122 faculty posts, no counts — the figure appears nowhere in it). An aggregate that adds up an unsupported
 *     number is withheld; the notification count stays.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { currentNotifications, notificationCountFor, countStatesWithListings } from "./hubCounts"
import { INDIAN_STATES } from "../config/govtTaxonomy"
import { computeNavStats } from "../services/govtNavStats"
import { sumRealVacancies, isSubstantiatedVacancy, isCleanPostText, hasSupportedVacancyAggregate } from "../data/govtVacancies"
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

/* ---- vacancy aggregate: an unsupported figure must not reach a total ---- */

// The exact stored values of the two rows that made the live "42,566 Vacancies" (read-only SELECT, 2026-10-26).
const JNU = job({
  id: "jnu:jnu-rc-75-2026", org: "Jawaharlal Nehru University (JNU)", title: "Jawaharlal Nehru University (JNU) Recruitment (Advt RC/75/2026) 2026",
  post: "teachers and other equivalent cadres at any level. (ii)", vacancies: "42,564", state: "All India",
})
const DRDO = job({
  id: "drdo-rac:drdo-rac-152", org: "DRDO (Recruitment & Assessment Centre)", title: "DRDO (Recruitment & Assessment Centre) Recruitment (Advt 152) 2025",
  post: "SCIENTISTS IN DRDO Closing date of Advertisement", vacancies: "2", state: "All India",
})
const CLEAN = job({ id: "clean-1", org: "SSC", title: "SSC CGL Recruitment 2026", post: "Combined Graduate Level Examiner", vacancies: "5000", state: "All India" })

test("REGRESSION — the JNU row (post text is a sentence fragment, no source states a total) is not a substantiated vacancy figure", () => {
  assert.equal(isSubstantiatedVacancy(JNU), false)
  assert.equal(isCleanPostText(JNU.post), false)
})

test("REGRESSION — a total containing the JNU figure is withheld (0 = no aggregate), not shown and not replaced by a partial sum", () => {
  assert.equal(sumRealVacancies([JNU]), 0)
  assert.equal(sumRealVacancies([JNU, CLEAN]), 0, "one unsupported figure taints the whole aggregate: no '5,000' substitute either")
  assert.equal(hasSupportedVacancyAggregate([JNU, CLEAN]), false)
})

test("scraped label noise in the post field is unsubstantiated too (the DRDO row)", () => {
  assert.equal(isSubstantiatedVacancy(DRDO), false)
  assert.equal(sumRealVacancies([JNU, DRDO]), 0)
})

test("clean rows still sum exactly; TBA / absent figures claim nothing and never taint", () => {
  assert.equal(sumRealVacancies([CLEAN, job({ id: "c2", vacancies: "250", post: "Junior Engineer" })]), 5250)
  assert.equal(sumRealVacancies([CLEAN, job({ id: "tba", vacancies: "TBA", post: "teachers and other equivalent cadres at any level. (ii)" })]), 5000)
  assert.equal(sumRealVacancies([]), 0)
})

test("an admin-verified record (verifiedAt) is trusted even when its post text is unusual", () => {
  assert.equal(isSubstantiatedVacancy({ ...JNU, verifiedAt: "2026-10-26T00:00:00.000Z" }), true)
  assert.equal(sumRealVacancies([{ ...JNU, verifiedAt: "2026-10-26T00:00:00.000Z" }]), 42564)
})

test("post-text rules: fragments, list markers, label noise and over-long text fail; real post names pass", () => {
  for (const bad of ["teachers and other equivalent cadres", "Junior Assistant (ii)", "Clerk. (a)", "Scientists Closing date of Advertisement", "Click here to download", "x".repeat(121)]) assert.equal(isCleanPostText(bad), false, bad)
  for (const good of ["Station Master, Goods Guard, Sr. Clerk", "Constable (Tradesman)", "Assistant Professor (Economics)", "Group B & C", "सहायक अध्यापक", "SCIENTISTS IN DRDO", undefined, ""]) assert.equal(isCleanPostText(good), true, String(good))
})

test("every aggregate surface goes through the gate: nav stats keep the NOTICE count and withhold the vacancy total", () => {
  const nav = computeNavStats([JNU, CLEAN, job({ id: "s", state: "Gujarat", stateSlug: "gujarat", org: "GPSC", title: "GPSC Recruitment 2026" })])
  assert.equal(nav.national.notifications, 2)
  assert.equal(nav.national.vacancies, 0)
  assert.equal(nav.states["gujarat"].notifications, 1)
  assert.equal(nav.states["gujarat"].opportunities.notifications, 3, "notifications are preserved")
  // the same rows without the unsupported figure still total normally
  assert.equal(computeNavStats([CLEAN]).national.vacancies, 5000)
})

test("wiring: a withheld total is OMITTED by every display (never '0 Vacancies' / '0 posts')", () => {
  assert.match(strip(read("src/lib/services/govtHubStats.ts")), /vacancies > 0 \? \[\{ key: "vacancies"/)
  assert.match(strip(read("src/components/heroes/CategoryHero.tsx")), /n\('vacancies'\) > 0 \?/)
  assert.match(strip(read("src/components/govt/GovtScopeHero.tsx")), /stat\.vacancies > 0 \? \[\{ label: "Vacancies"/)
  assert.match(strip(read("src/components/govt/GovtNavGrids.tsx")), /stat\.vacancies > 0 \? ` · /)
  // The database-backed aggregates (hub counters, nav-grid stats, listing/category/state/qualification totals) all use the gate.
  assert.match(strip(read("src/lib/services/govtHubStats.ts")), /sumRealVacancies\(jobs\.filter\(isVacancyBearingJob\)\)/)
  assert.match(strip(read("src/lib/services/govtJobService.ts")), /vacanciesTotal: sumRealVacancies\(/)
  assert.match(strip(read("src/lib/services/govtJobService.ts")), /totalVacancies = sumRealVacancies\(/)
  const nav = strip(read("src/lib/services/govtNavStats.ts"))
  assert.match(nav, /function realStatsFromRows[\s\S]{0,200}sumRealVacancies\(active\.filter\(isVacancyBearingJob\)\)/)
  assert.doesNotMatch(strip(read("src/lib/services/govtHubStats.ts")), /sumGovtVacancies\(/)
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
