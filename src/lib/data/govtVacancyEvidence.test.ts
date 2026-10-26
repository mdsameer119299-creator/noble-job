/**
 * govtVacancyEvidence.test.ts — a stored vacancy figure may be ADDED UP only with affirmative evidence.
 *
 *   npm run test:govt-vacancy-evidence
 *
 * Background: the govt hub read "42,566 Vacancies"; 42,564 of it was ONE row (jnu:jnu-rc-75-2026) whose official notice
 * (Advt RC/75/2026) lists 122 faculty posts and states NO total. A clean-looking `post` string is not evidence that a
 * count is printed in the notice, so the gate now requires a documented verification (verified_at / verified_by, with
 * content_changed_at showing the figure was not altered afterwards). See data/govtVacancies.ts for the contract.
 *
 * Section A — the gate. Section B — EVERY rendered aggregate path, run for real. Section C — static guards so a new
 * path cannot be added around the gate.
 */
import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import {
  sumRealVacancies, aggregateVacancies, isSubstantiatedVacancy, hasSupportedVacancyAggregate, vacancyVerdict, isObviousScrapedFragment,
  isVacancyBearingJob, parseVacancyCount,
} from "./govtVacancies"
import { GOVT_JOBS } from "./govtData"
import { computeNavStats, getCategoryNavStat, getStateNavStat, getQualificationNavStat } from "../services/govtNavStats"
import { getGovtStatsLocal } from "../services/govtJobLocal"
import { buildGovtHubStats, buildGovtStats, listingVacanciesTotal } from "../govt/hubCounts"
import { GOVT_TOP_CATEGORIES, INDIAN_STATES, GOVT_QUALIFICATIONS } from "../config/govtTaxonomy"
import type { GovtJob } from "@/types/govtJob"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8")
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()
const job = (over: Partial<GovtJob> = {}): GovtJob => ({
  id: "job-1", slug: "job-1", title: "Test Recruitment 2026", org: "Test Org", short: "Test Org",
  post: "Combined Graduate Level Examiner", vacancies: "5000", qualification: "Graduate", ageRange: "18-30", fee: "₹500",
  lastDate: "2099-01-01", salary: "As per rules", location: "India", tab: "latest",
  color: "#000", status: "active", recordType: "notification", sourcePublishedAt: daysAgo(10), state: "All India",
  contentChangedAt: "2026-06-12T15:29:28.905178+00:00",
  ...over,
})
/** Verified by a person AFTER the last content change (the contract's good case). */
const VERIFIED = { verifiedAt: "2026-10-20T10:00:00.000Z", verifiedBy: "admin-user-7d2f", contentChangedAt: "2026-06-12T15:29:28.905178+00:00" }

// The exact stored values of the two rows behind the live "42,566 Vacancies" (read-only SELECT, 2026-10-26).
const JNU = job({
  id: "jnu:jnu-rc-75-2026", org: "Jawaharlal Nehru University (JNU)", title: "Jawaharlal Nehru University (JNU) Recruitment (Advt RC/75/2026) 2026",
  post: "teachers and other equivalent cadres at any level. (ii)", vacancies: "42,564", contentChangedAt: "2026-06-12 15:29:28.905178+00",
})
const DRDO = job({
  id: "drdo-rac:drdo-rac-152", org: "DRDO (Recruitment & Assessment Centre)", title: "DRDO (Recruitment & Assessment Centre) Recruitment (Advt 152) 2025",
  post: "SCIENTISTS IN DRDO Closing date of Advertisement", vacancies: "2", contentChangedAt: "2026-06-12 15:29:28.905178+00",
})
const CLEAN_UNVERIFIED = job({ id: "clean-1", post: "Combined Graduate Level Examiner", vacancies: "5000" })
const CLEAN_VERIFIED = job({ id: "clean-2", post: "Junior Engineer", vacancies: "250", ...VERIFIED })

/* ======================= A. THE GATE ======================= */

test("a CLEAN post name with an unverified numeric count does NOT qualify", () => {
  assert.equal(isSubstantiatedVacancy(CLEAN_UNVERIFIED), false)
  assert.equal(vacancyVerdict(CLEAN_UNVERIFIED), "unverified")
  assert.equal(sumRealVacancies([CLEAN_UNVERIFIED]), 0)
  assert.equal(aggregateVacancies([CLEAN_UNVERIFIED]), null)
})

test("a MISSING or EMPTY post name with an unverified numeric count does NOT qualify", () => {
  for (const post of [undefined, "", "   "]) {
    const j = job({ post: post as string | undefined, vacancies: "300" })
    assert.equal(isSubstantiatedVacancy(j), false, JSON.stringify(post))
    assert.equal(sumRealVacancies([j]), 0, JSON.stringify(post))
  }
})

test("JNU (42,564) and DRDO (2) cannot support an aggregate without affirmative evidence — alone, together, or beside clean verified rows", () => {
  for (const set of [[JNU], [DRDO], [JNU, DRDO], [JNU, CLEAN_VERIFIED], [DRDO, CLEAN_VERIFIED], [CLEAN_VERIFIED, JNU, DRDO]]) {
    assert.equal(sumRealVacancies(set), 0)
    assert.equal(aggregateVacancies(set), null)
    assert.equal(hasSupportedVacancyAggregate(set), false)
  }
  assert.equal(vacancyVerdict(JNU), "scraped-fragment")
  assert.equal(vacancyVerdict(DRDO), "scraped-fragment")
})

test("only AFFIRMATIVE evidence counts: no other field substitutes for a verification record", () => {
  const notEvidence: Partial<GovtJob>[] = [
    { vacanciesStated: "5000" }, { status: "active" }, { sourcePublishedAt: daysAgo(1) },
    { officialUrl: "https://example.gov.in/notice.pdf" }, { notificationPdf: "https://example.gov.in/notice.pdf" },
    { vacancyBreakup: [{ post: "Examiner", total: "5,000" }] } as Partial<GovtJob>, { recordType: "notification" },
  ]
  for (const extra of notEvidence) assert.equal(isSubstantiatedVacancy(job({ ...extra })), false, JSON.stringify(Object.keys(extra)))
})

test("a verification record must be complete, current and human: each defect leaves the figure unsupported", () => {
  const base = { verifiedAt: "2026-10-20T10:00:00.000Z", verifiedBy: "admin-user-7d2f", contentChangedAt: "2026-06-12T15:29:28.905178+00:00" }
  assert.equal(vacancyVerdict(job(base)), "verified")
  assert.equal(vacancyVerdict(job({ ...base, verifiedAt: undefined })), "unverified")
  assert.equal(vacancyVerdict(job({ ...base, verifiedAt: "not a date" })), "unverified")
  assert.equal(vacancyVerdict(job({ ...base, verifiedAt: new Date(Date.now() + 30 * 86_400_000).toISOString() })), "unverified", "future timestamp")
  assert.equal(vacancyVerdict(job({ ...base, verifiedBy: undefined })), "unverified", "who verified is unknown")
  assert.equal(vacancyVerdict(job({ ...base, verifiedBy: "   " })), "unverified")
  assert.equal(vacancyVerdict(job({ ...base, verifiedBy: "ingestion:jnu" })), "automated-verification", "the adapter that scraped the number cannot vouch for it")
  assert.equal(vacancyVerdict(job({ ...base, verifiedBy: " Ingestion:uppsc" })), "automated-verification")
  assert.equal(vacancyVerdict(job({ ...base, contentChangedAt: "2026-10-25T00:00:00.000Z" })), "stale-verification", "figure changed after it was verified")
  assert.equal(vacancyVerdict(job({ ...base, contentChangedAt: undefined })), "stale-verification", "cannot show it is unchanged")
})

test("an explicitly source-verified figure is handled by the verification contract: counted, exactly", () => {
  assert.equal(isSubstantiatedVacancy(CLEAN_VERIFIED), true)
  assert.equal(sumRealVacancies([CLEAN_VERIFIED]), 250)
  assert.equal(sumRealVacancies([CLEAN_VERIFIED, job({ id: "v2", vacancies: "1,750", ...VERIFIED })]), 2000)
  // verified at the very moment of the last change is still current (<=), and Postgres' textual timestamps parse
  assert.equal(vacancyVerdict(job({ verifiedAt: "2026-06-12 15:29:28.905178+00", verifiedBy: "admin-1", contentChangedAt: "2026-06-12 15:29:28.905178+00" })), "verified")
})

test("verification does not launder a scraped fragment: post-text validation still VETOES (fix the data, not the gate)", () => {
  const verifiedJnu = job({ ...JNU, ...VERIFIED })
  assert.equal(vacancyVerdict(verifiedJnu), "scraped-fragment")
  assert.equal(sumRealVacancies([verifiedJnu]), 0)
  assert.equal(sumRealVacancies([job({ ...JNU, post: "Professor, Associate Professor, Assistant Professor", ...VERIFIED })]), 42564, "once the record is corrected AND verified, it counts")
})

test("a MIXED set containing any unsupported figure suppresses the ENTIRE total (no partial sum, no zero shown as a number)", () => {
  const mixed = [CLEAN_VERIFIED, job({ id: "v2", vacancies: "1,750", ...VERIFIED }), CLEAN_UNVERIFIED]
  assert.equal(sumRealVacancies(mixed), 0)
  assert.equal(aggregateVacancies(mixed), null)
  assert.equal(aggregateVacancies(mixed.slice(0, 2)), 2000, "premise: without the unsupported row the rest does total")
})

test("figures that claim nothing (TBA, Not Specified, '-', 0, empty) do NOT invalidate otherwise supported figures", () => {
  for (const v of ["TBA", "Not Specified", "-", "0", "", "tba"]) {
    const none = job({ id: "n", vacancies: v, post: "teachers and other equivalent cadres (ii)" })
    assert.equal(isSubstantiatedVacancy(none), true, v)
    assert.equal(sumRealVacancies([CLEAN_VERIFIED, none]), 250, v)
  }
  assert.equal(aggregateVacancies([job({ vacancies: "TBA" })]), null, "nothing to add up → no total")
  assert.equal(aggregateVacancies([]), null)
})

test("post-text screen: rejects obvious fragments only; clean, missing and non-Latin text pass it", () => {
  for (const bad of ["teachers and other equivalent cadres", "Junior Assistant (ii)", "Clerk. (a)", "Scientists Closing date of Advertisement", "Click here to download", "x".repeat(121)]) assert.equal(isObviousScrapedFragment(bad), true, bad)
  for (const ok of ["Station Master, Goods Guard, Sr. Clerk", "Constable (Tradesman)", "Assistant Professor (Economics)", "Group B & C", "सहायक अध्यापक", undefined, "", null]) assert.equal(isObviousScrapedFragment(ok), false, String(ok))
})

/* ======================= B. EVERY RENDERED AGGREGATE PATH ======================= */

const UNVERIFIED_POOL = [CLEAN_UNVERIFIED, JNU, DRDO, job({ id: "s", state: "Gujarat", stateSlug: "gujarat", org: "GPSC", title: "GPSC Recruitment 2026", vacancies: "40", post: "Deputy Collector" })]
const VERIFIED_POOL = [CLEAN_VERIFIED, job({ id: "v2", org: "SSC", title: "SSC CGL Recruitment 2026", vacancies: "1,750", ...VERIFIED })]

test("path 1 — hub / hero counters (getGovtHubStats → CategoryHero, GovtStats): vacancy item omitted, notification count intact", () => {
  const items = buildGovtHubStats(UNVERIFIED_POOL)
  assert.equal(items.some(i => i.key === "vacancies"), false)
  assert.equal(items.find(i => i.key === "notifications")?.num, 4)
  assert.equal(buildGovtHubStats(UNVERIFIED_POOL, "defence").some(i => i.key === "vacancies"), false)
  const ok = buildGovtHubStats(VERIFIED_POOL)
  assert.equal(ok.find(i => i.key === "vacancies")?.num, 2000, "a fully verified pool still shows its exact total")
})

test("path 2 — nav grids (computeNavStats: national / category / state / qualification): totals 0, notices intact", () => {
  const nav = computeNavStats(UNVERIFIED_POOL)
  assert.equal(nav.national.notifications, 3)
  assert.equal(nav.national.vacancies, 0)
  assert.equal(nav.states["gujarat"].notifications, 1)
  assert.equal(nav.states["gujarat"].vacancies, 0)
  assert.equal(nav.states["gujarat"].opportunities.vacancies, 0)
  for (const c of Object.values(nav.categories)) assert.equal(c.vacancies, 0)
  for (const q of Object.values(nav.qualifications)) assert.equal(q.vacancies, 0)
  assert.equal(computeNavStats(VERIFIED_POOL).national.vacancies, 2000)
})

test("path 3 — listing heroes (getGovtJobsFiltered.vacanciesTotal → GovtScopeHero): withheld unless every figure is verified", () => {
  assert.equal(listingVacanciesTotal(UNVERIFIED_POOL), 0)
  assert.equal(listingVacanciesTotal([...VERIFIED_POOL, JNU]), 0)
  assert.equal(listingVacanciesTotal(VERIFIED_POOL), 2000)
})

test("path 4 — public stats payload (/api/govt-jobs/stats): totalVacancies is null, not 0 or a partial sum", () => {
  const s = buildGovtStats(UNVERIFIED_POOL)
  assert.equal(s.totalVacancies, null)
  assert.equal(s.totalExams, 4)
  assert.equal(buildGovtStats(VERIFIED_POOL).totalVacancies, 2000)
})

test("path 5 — in-memory SEED (getGovtStatsLocal) previously SYNTHESIZED totals; now no total", () => {
  assert.ok(GOVT_JOBS.some(j => parseVacancyCount(j.vacancies) !== null), "premise: the seed carries numbers that would have been summed")
  const s = getGovtStatsLocal()
  assert.equal(s.totalVacancies, null)
  assert.ok(s.totalExams > 0)
})

test("path 6 — seed nav helpers (statsFromJobs via getCategoryNavStat / getStateNavStat / getQualificationNavStat) over the WHOLE taxonomy", () => {
  let notices = 0
  for (const c of GOVT_TOP_CATEGORIES) { const s = getCategoryNavStat(c.slug); assert.equal(s.vacancies, 0, c.slug); notices += s.notifications }
  for (const st of INDIAN_STATES) { const s = getStateNavStat(st.slug); assert.equal(s.vacancies, 0, st.slug); notices += s.notifications }
  for (const q of GOVT_QUALIFICATIONS) { const s = getQualificationNavStat(q.slug); assert.equal(s.vacancies, 0, q.slug); notices += s.notifications }
  assert.ok(notices > 0, "premise: notice counts are still produced (only the vacancy totals are withheld)")
  assert.ok(GOVT_JOBS.filter(isVacancyBearingJob).some(j => parseVacancyCount(j.vacancies) !== null), "premise: there were real-looking numbers to sum")
})

test("every display OMITS a withheld total (never '0 Vacancies' / '0 posts' / '0 vac.')", () => {
  assert.match(strip(read("src/lib/govt/hubCounts.ts")), /vacancies > 0 \? \[\{ key: "vacancies"/)
  assert.match(strip(read("src/components/heroes/CategoryHero.tsx")), /n\('vacancies'\) > 0 \?/)
  assert.match(strip(read("src/components/govt/GovtScopeHero.tsx")), /stat\.vacancies > 0 \? \[\{ label: "Vacancies"/)
  assert.match(strip(read("src/components/govt/GovtNavGrids.tsx")), /stat\.vacancies > 0 && \(/)
  assert.match(strip(read("src/components/govt/GovtNavGrids.tsx")), /stat\.vacancies > 0 \? ` · /)
})

/* ======================= C. NO WAY AROUND THE GATE ======================= */

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) sourceFiles(p, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}
const SRC = sourceFiles(join(process.cwd(), "src"))
const rel = (p: string) => p.slice(process.cwd().length + 1)

test("the synthesizing aggregator is gone: no sumGovtVacancies anywhere in src", () => {
  for (const f of SRC) assert.doesNotMatch(strip(readFileSync(f, "utf8")), /\bsumGovtVacancies\b/, rel(f))
})

test("synthetic per-job counts (resolveGovtVacancyCount) are confined to govtVacancies.ts — nothing outside can add them up", () => {
  for (const f of SRC) if (!rel(f).endsWith("src/lib/data/govtVacancies.ts")) assert.doesNotMatch(strip(readFileSync(f, "utf8")), /\bresolveGovtVacancyCount\b/, rel(f))
})

test("no non-test source adds vacancy figures by hand: parseVacancyCount is used only by the gate and the row mapper; no reduce() over vacancies elsewhere", () => {
  for (const f of SRC) {
    const r = rel(f), src = strip(readFileSync(f, "utf8"))
    if (!r.endsWith("lib/data/govtVacancies.ts") && !r.endsWith("lib/services/govtRowMapper.ts")) assert.doesNotMatch(src, /\bparseVacancyCount\(/, `${r}: parses a vacancy figure outside the gate`)
    if (!r.endsWith("lib/data/govtVacancies.ts")) for (const m of src.matchAll(/\.reduce\(/g)) assert.doesNotMatch(src.slice(m.index!, m.index! + 220), /vacanc/i, `${r}: reduces over vacancy figures`)
  }
})

test("every aggregate service goes through the shared builders", () => {
  assert.match(strip(read("src/lib/services/govtHubStats.ts")), /buildGovtHubStats\(/)
  assert.match(strip(read("src/lib/services/govtJobService.ts")), /buildGovtStats\(/)
  assert.match(strip(read("src/lib/services/govtJobService.ts")), /listingVacanciesTotal\(list\)/)
  assert.match(strip(read("src/lib/services/govtJobLocal.ts")), /buildGovtStats\(/)
  const nav = strip(read("src/lib/services/govtNavStats.ts"))
  assert.match(nav, /function statsFromJobs[\s\S]{0,320}sumRealVacancies\(/)
  assert.match(nav, /function realStatsFromRows[\s\S]{0,200}sumRealVacancies\(/)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
