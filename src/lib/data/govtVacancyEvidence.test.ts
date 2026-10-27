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
import { createHash } from "node:crypto"
import {
  sumRealVacancies, aggregateVacancies, isSubstantiatedVacancy, hasSupportedVacancyAggregate, vacancyVerdict, isObviousScrapedFragment,
  isVacancyBearingJob, parseVacancyCount, isAdminUserId,
} from "./govtVacancies"
import { GOVT_JOBS } from "./govtData"
import { computeNavStats, getCategoryNavStat, getStateNavStat, getQualificationNavStat } from "../services/govtNavStats"
import { getGovtStatsLocal } from "../services/govtJobLocal"
import { buildGovtHubStats, buildGovtStats, listingVacanciesTotal } from "../govt/hubCounts"
import { mapRow } from "../services/govtRowMapper"
import { normalise } from "../services/govtAutoUpdate"
import { planIngestWrites } from "../services/govtIngestPlan"
import type { RawNotification, SourceAdapter } from "../ingest/types"
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
/**
 * A fixture in the EXACT shape of an administrator ID: `auth.users.id` (canonical lowercase v4 UUID, what
 * `requireAdminApi()` returns as `user.id` and what the repo stores in admin audit columns). It is a made-up value that
 * belongs to no real account — the pure gate can only check the shape, never that the user exists (see govtVacancies.ts).
 */
const ADMIN_ID = "3f8b2c1e-9a4d-4e6b-8c5a-7d2f1b0e9a64"
/** Verified by an administrator AFTER the last content change (the contract's good case). */
const VERIFIED = { verifiedAt: "2026-10-20T10:00:00.000Z", verifiedBy: ADMIN_ID, contentChangedAt: "2026-06-12T15:29:28.905178+00:00" }

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

test("a verification record must be complete, current and administrator-attributed: each defect leaves the figure unsupported", () => {
  const base = { ...VERIFIED }
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

test("verified_by must be an ADMINISTRATOR ID, not merely a non-empty string: labels, names, e-mails and malformed ids never verify", () => {
  const nil = "00000000-0000-0000-0000-000000000000"
  const max = "ffffffff-ffff-ffff-ffff-ffffffffffff"
  const labels = ["system", "manual", "unknown", "admin", "administrator", "root", "script", "cron", "bot", "null", "undefined", "none", "n/a", "true", "1",
    "admin-user-7d2f", "admin-1", "user:" + ADMIN_ID, ADMIN_ID + ":extra", "admin@noblejob.in", "Sameer", "ingestion", "verified"]
  const malformed = [nil, max, ADMIN_ID.toUpperCase(), ` ${ADMIN_ID}`, `${ADMIN_ID} `, `${ADMIN_ID}\n`, `{${ADMIN_ID}}`, ADMIN_ID.replace(/-/g, ""),
    ADMIN_ID.slice(0, -1), ADMIN_ID + "0", ADMIN_ID.replace("-4e6b-", "-0e6b-"), ADMIN_ID.replace("-4e6b-", "-9e6b-"), ADMIN_ID.replace("-8c5a-", "-cc5a-"),
    ADMIN_ID.replace("-8c5a-", "-0c5a-"), ADMIN_ID.replace(/e/g, "g"), "3f8b2c1e-9a4d-4e6b-8c5a_7d2f1b0e9a64"]
  for (const v of [...labels, ...malformed]) {
    assert.equal(isAdminUserId(v), false, JSON.stringify(v))
    assert.equal(vacancyVerdict(job({ ...VERIFIED, verifiedBy: v })), "invalid-verifier", JSON.stringify(v))
    assert.equal(isSubstantiatedVacancy(job({ ...VERIFIED, verifiedBy: v })), false, JSON.stringify(v))
    assert.equal(sumRealVacancies([job({ ...VERIFIED, verifiedBy: v })]), 0, JSON.stringify(v))
  }
  for (const v of [123, {}, [], true, [ADMIN_ID]]) {
    assert.equal(isAdminUserId(v), false, JSON.stringify(v))
    assert.equal(vacancyVerdict(job({ ...VERIFIED, verifiedBy: v as unknown as string })), "invalid-verifier", JSON.stringify(v))
  }
  // the three labels called out by review, and the old fake fixture, each suppress an otherwise-valid verified total
  for (const v of ["system", "manual", "unknown", "admin-user-7d2f"]) {
    assert.equal(aggregateVacancies([CLEAN_VERIFIED, job({ id: "x", vacancies: "10", ...VERIFIED, verifiedBy: v })]), null, v)
  }
})

test("what IS accepted: canonical lowercase UUIDs of RFC 4122 version 1-8 and variant 8/9/a/b (Supabase auth.users.id is v4)", () => {
  for (const v of [ADMIN_ID, "123e4567-e89b-12d3-a456-426614174000", "6ba7b810-9dad-11d1-80b4-00c04fd430c8", "0190a5c3-7b1e-7c4a-9d2f-5e8a1c3b4d6f"]) {
    assert.equal(isAdminUserId(v), true, v)
    assert.equal(vacancyVerdict(job({ ...VERIFIED, verifiedBy: v })), "verified", v)
  }
  assert.equal(vacancyVerdict(job({ ...VERIFIED, verifiedBy: ADMIN_ID })), "verified")
  assert.equal(sumRealVacancies([job({ ...VERIFIED, verifiedBy: ADMIN_ID, vacancies: "77" })]), 77)
})

test("the ingestion rejection is kept and reported distinctly (any adapter, any case or spacing), ahead of the shape check", () => {
  for (const v of ["ingestion:jnu", "ingestion:drdo-rac", " Ingestion:uppsc", "INGESTION : ssc", "ingestion:" + ADMIN_ID]) {
    assert.equal(vacancyVerdict(job({ ...VERIFIED, verifiedBy: v })), "automated-verification", v)
    assert.equal(sumRealVacancies([job({ ...VERIFIED, verifiedBy: v })]), 0, v)
  }
  assert.equal(vacancyVerdict(job({ ...VERIFIED, verifiedBy: null as unknown as string })), "unverified")
})

test("timestamp freshness is unchanged by the stricter identity rule: a genuine admin ID still needs a valid, non-future, non-stale verification", () => {
  assert.equal(vacancyVerdict(job({ ...VERIFIED, verifiedAt: undefined })), "unverified")
  assert.equal(vacancyVerdict(job({ ...VERIFIED, verifiedAt: "garbage" })), "unverified")
  assert.equal(vacancyVerdict(job({ ...VERIFIED, verifiedAt: new Date(Date.now() + 86_400_000).toISOString() })), "unverified")
  assert.equal(vacancyVerdict(job({ ...VERIFIED, contentChangedAt: "2026-10-21T00:00:00.000Z" })), "stale-verification")
  assert.equal(vacancyVerdict(job({ ...VERIFIED, contentChangedAt: undefined })), "stale-verification")
})

test("a database row maps through the real row mapper to the same verdict (snake_case verified_* → camelCase → gate)", () => {
  const dbRow = (over: Record<string, unknown>) => ({
    id: "db-1", slug: "db-1", title: "Junior Engineer Recruitment 2026", org: "Test Org", short: "Test Org", post: "Junior Engineer", vacancies: "250",
    qualification: "Graduate", last_date: "2099-01-01", tab: "latest", status: "active", record_type: "notification", state: "All India",
    content_changed_at: "2026-06-12 15:29:28.905178+00", verified_at: "2026-10-20 10:00:00+00", verified_by: ADMIN_ID, ...over,
  })
  assert.equal(vacancyVerdict(mapRow(dbRow({}))), "verified")
  assert.equal(vacancyVerdict(mapRow(dbRow({ verified_by: "system" }))), "invalid-verifier")
  assert.equal(vacancyVerdict(mapRow(dbRow({ verified_by: "manual" }))), "invalid-verifier")
  assert.equal(vacancyVerdict(mapRow(dbRow({ verified_by: "unknown" }))), "invalid-verifier")
  assert.equal(vacancyVerdict(mapRow(dbRow({ verified_by: "ingestion:jnu" }))), "automated-verification")
  assert.equal(vacancyVerdict(mapRow(dbRow({ verified_at: null, verified_by: null }))), "unverified", "today's live state: no row carries a verification")
})

test("an explicitly source-verified figure is handled by the verification contract: counted, exactly", () => {
  assert.equal(isSubstantiatedVacancy(CLEAN_VERIFIED), true)
  assert.equal(sumRealVacancies([CLEAN_VERIFIED]), 250)
  assert.equal(sumRealVacancies([CLEAN_VERIFIED, job({ id: "v2", vacancies: "1,750", ...VERIFIED })]), 2000)
  // Postgres' textual timestamps parse; verified strictly AFTER the last change counts
  assert.equal(vacancyVerdict(job({ verifiedAt: "2026-06-12 15:29:29.000000+00", verifiedBy: ADMIN_ID, contentChangedAt: "2026-06-12 15:29:28.905178+00" })), "verified")
})

test("EQUAL content_changed_at and verified_at is NOT verified (Postgres NOW() is transaction-stable: equality cannot show which came first)", () => {
  for (const [c, v] of [
    ["2026-06-12 15:29:28.905178+00", "2026-06-12 15:29:28.905178+00"],     // Postgres text form
    ["2026-10-26T10:00:00.000Z", "2026-10-26T10:00:00.000Z"],                // ISO form
    ["2026-10-26T10:00:00.000Z", "2026-10-26 10:00:00+00"],                  // mixed forms, same instant
    ["2026-10-26T10:00:00.000100Z", "2026-10-26T10:00:00.000900Z"],           // same millisecond: JS cannot order them → stale
  ]) {
    const j = job({ verifiedBy: ADMIN_ID, verifiedAt: v, contentChangedAt: c })
    assert.equal(vacancyVerdict(j, new Date("2026-10-27T00:00:00Z")), "stale-verification", `${c} / ${v}`)
    assert.equal(sumRealVacancies([j], new Date("2026-10-27T00:00:00Z")), 0)
    assert.equal(aggregateVacancies([CLEAN_VERIFIED, j], new Date("2026-10-27T00:00:00Z")), null, "an equal-timestamp row withholds the whole total")
  }
  // one millisecond later is verified
  assert.equal(vacancyVerdict(job({ verifiedBy: ADMIN_ID, verifiedAt: "2026-10-26T10:00:00.001Z", contentChangedAt: "2026-10-26T10:00:00.000Z" }), new Date("2026-10-27T00:00:00Z")), "verified")
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

/* ---- C2. the trusted-writer contract for verified_by / verified_at ---- */

function filesUnder(dir: string, exts: RegExp, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) filesUnder(p, exts, out)
    else if (exts.test(name) && !/\.test\.(ts|tsx|mjs|js)$/.test(name)) out.push(p)
  }
  return out
}
const REPO_FILES = ["src", "scripts", "supabase"].flatMap(d => filesUnder(join(process.cwd(), d), /\.(ts|tsx|mjs|js|sql)$/))
const VERIFIED_COL = /\bverified_(?:by|at)\b/
/** Files that may MENTION the columns, and why. NONE of them is application code that writes a value: they declare, select, map, document, or are the database-side enforcement / scratch scenarios. */
const READ_ONLY_TOUCHES = [
  "src/types/govtJob.ts",                      // type declaration
  "src/lib/config/govtColumns.ts",             // SELECT column list
  "src/lib/services/govtRowMapper.ts",         // row → GovtJob (read)
  "src/lib/data/govtVacancies.ts",             // the gate + the contract text
  "supabase/migrations/20260727000001_govt_jobs_record_integrity.sql",
  "supabase/rollbacks/20260727000001_govt_jobs_record_integrity.down.sql",
  "supabase/migrations/20261026000001_govt_jobs_verification_integrity.sql",       // the trigger that ENFORCES the contract
  "supabase/rollbacks/20261026000001_govt_jobs_verification_integrity.down.sql",
  "supabase/scratch-scenarios/govt_jobs_verification_integrity.sql",                           // scratch-database scenarios (refuses any other DB)
]
/** Code that is ALLOWED to write verified_by / verified_at. Empty today; an entry must be an admin-gated route. */
const TRUSTED_WRITERS: string[] = []

test("TRUSTED WRITER: no source, script or migration writes verified_by / verified_at — only the read-only files above even mention them", () => {
  const touching = REPO_FILES.filter(f => VERIFIED_COL.test(readFileSync(f, "utf8"))).map(rel).sort()
  assert.deepEqual(touching, [...READ_ONLY_TOUCHES, ...TRUSTED_WRITERS].sort(),
    "a new file touches verified_by/verified_at: review it against the trusted-writer contract in data/govtVacancies.ts, then list it here")
  for (const f of REPO_FILES.filter(f => /\.(ts|tsx|mjs|js)$/.test(f) && READ_ONLY_TOUCHES.includes(rel(f)))) {
    assert.equal(/\bverified_(?:by|at)\b["']?\s*[:=]/.test(strip(readFileSync(f, "utf8"))), false, `${rel(f)} assigns a verified_* value`)
  }
})

/** Text inside the balanced parentheses that open at `openIdx` (string literals skipped). */
function insideParens(src: string, openIdx: number): string {
  let depth = 0, quote = ""
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i]
    if (quote) { if (ch === "\\") i++; else if (ch === quote) quote = ""; continue }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue }
    if (ch === "(") depth++
    else if (ch === ")" && --depth === 0) return src.slice(openIdx + 1, i)
  }
  return src.slice(openIdx + 1)
}
/** Top-level comma-separated entries of an object-literal body (nesting and strings respected). */
function topLevelEntries(body: string): string[] {
  const out: string[] = []
  let depth = 0, quote = "", cur = ""
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (quote) { cur += ch; if (ch === "\\") cur += body[++i] ?? ""; else if (ch === quote) quote = ""; continue }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; cur += ch; continue }
    if ("([{".includes(ch)) depth++
    if (")]}".includes(ch)) depth--
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; continue }
    cur += ch
  }
  if (cur.trim()) out.push(cur)
  return out.map(e => e.trim()).filter(Boolean)
}
/**
 * The TRUSTED-WRITER contract for code that records a verification, as a checker. Returns the problems found ([] = compliant).
 * A compliant writer is an admin-gated handler whose verification is a single-row `.update()` carrying EXACTLY
 * `verified_by: auth.user.id` and `verified_at: …` — so it can never edit public content or `content_changed_at` in the same
 * mutation (the database trigger rejects that too, but this keeps the mistake out of review), never upserts/inserts a
 * verification, and never takes the verifier from the request.
 */
function checkVerificationWriter(source: string): string[] {
  const src = strip(source)
  const problems: string[] = []
  if (!/\brequireAdminApi\(\)/.test(src)) problems.push("does not call requireAdminApi()")
  let found = 0
  for (const m of src.matchAll(/\.(update|upsert|insert)\s*\(/g)) {
    const open = m.index! + m[0].length - 1
    const arg = insideParens(src, open)
    if (!/\bverified_(?:by|at)\b/.test(arg)) continue
    found++
    if (m[1] !== "update") problems.push(`${m[1]}() carries a verification; only a single-row update() may`)
    const after = src.slice(open + arg.length + 2, open + arg.length + 2 + 120)
    if (!/^\s*\.eq\(\s*["']id["']\s*,/.test(after)) problems.push('update() is not scoped to one row: .eq("id", …) must directly follow the payload')
    const body = arg.trim()
    if (!body.startsWith("{") || !body.endsWith("}")) { problems.push("payload is not an object literal"); continue }
    const keys = new Map<string, string>()
    for (const entry of topLevelEntries(body.slice(1, -1))) {
      if (entry.startsWith("...")) { problems.push("payload spreads another object"); continue }
      const k = entry.match(/^["']?([A-Za-z_$][\w$]*)["']?\s*(?::([\s\S]*))?$/)
      if (!k) { problems.push(`payload entry is not a plain key: ${entry.slice(0, 40)}`); continue }
      keys.set(k[1], (k[2] ?? k[1]).trim())
    }
    for (const key of keys.keys()) if (key !== "verified_by" && key !== "verified_at") problems.push(`payload also sets "${key}": a verification must not change anything else in the same mutation`)
    if (!keys.has("verified_by") || !keys.has("verified_at")) problems.push("payload must set both verified_by and verified_at (a re-verification needs a new verified_at)")
    if (keys.has("verified_by") && keys.get("verified_by") !== "auth.user.id") problems.push(`verified_by must be exactly auth.user.id, not ${keys.get("verified_by")}`)
  }
  if (found === 0) problems.push("contains no verification write")
  return problems
}

const GOOD_WRITER = `
import { requireAdminApi } from "@/lib/auth/verifyAdminApi"
export async function POST(req: Request) {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error
  const { id } = await req.json()
  const { error } = await supabaseAdmin
    .from("govt_jobs")
    .update({ verified_by: auth.user.id, verified_at: new Date().toISOString() })
    .eq("id", id)
}`

test("TRUSTED WRITER checker: a compliant admin-gated, single-row, verification-only update passes", () => {
  assert.deepEqual(checkVerificationWriter(GOOD_WRITER), [])
})

test("TRUSTED WRITER checker: a verification riding along with a content edit, a content_changed_at write, a spread, an upsert/insert, or a request-supplied verifier is REJECTED", () => {
  const bad = (name: string, src: string, expect: RegExp) => assert.match(checkVerificationWriter(src).join(" | "), expect, name)
  bad("public field in the same mutation", GOOD_WRITER.replace("verified_at: new Date().toISOString()", "verified_at: new Date().toISOString(), vacancies: body.vacancies"), /also sets "vacancies"/)
  bad("post in the same mutation", GOOD_WRITER.replace("verified_by: auth.user.id,", "verified_by: auth.user.id, post: p,"), /also sets "post"/)
  bad("content_changed_at in the same mutation", GOOD_WRITER.replace("verified_by: auth.user.id,", "verified_by: auth.user.id, content_changed_at: old,"), /also sets "content_changed_at"/)
  bad("shorthand public field", GOOD_WRITER.replace("verified_by: auth.user.id,", "verified_by: auth.user.id, vacancies,"), /also sets "vacancies"/)
  bad("spread of a request body", GOOD_WRITER.replace("verified_by: auth.user.id,", "...body, verified_by: auth.user.id,"), /spreads another object/)
  bad("upsert", GOOD_WRITER.replace(".update(", ".upsert("), /upsert\(\) carries a verification/)
  bad("insert", GOOD_WRITER.replace(".update(", ".insert("), /insert\(\) carries a verification/)
  bad("verifier from the request", GOOD_WRITER.replace("verified_by: auth.user.id", "verified_by: body.verified_by"), /verified_by must be exactly auth\.user\.id/)
  bad("literal label", GOOD_WRITER.replace("verified_by: auth.user.id", 'verified_by: "system"'), /verified_by must be exactly auth\.user\.id/)
  bad("not admin-gated", GOOD_WRITER.replace("await requireAdminApi()", "await getSession()"), /requireAdminApi/)
  bad("not scoped to one row", GOOD_WRITER.replace('.eq("id", id)', '.eq("tab", "latest")'), /not scoped to one row/)
  bad("bulk filter", GOOD_WRITER.replace('.eq("id", id)', '.in("id", ids)'), /not scoped to one row/)
  bad("missing verified_at", GOOD_WRITER.replace(", verified_at: new Date().toISOString()", ""), /both verified_by and verified_at/)
  bad("computed key", GOOD_WRITER.replace("verified_by: auth.user.id,", "verified_by: auth.user.id, [k]: v,"), /not a plain key/)
  bad("no verification at all", GOOD_WRITER.replace(/\.update\([\s\S]*?\)\s*\.eq/, ".update({ title: t }).eq"), /contains no verification write/)
  bad("comment text is not code", "// .update({ verified_by: auth.user.id, verified_at: now })\nconst auth = await requireAdminApi()", /contains no verification write/)
})

test("TRUSTED WRITER: every file allowed to write verified_by / verified_at satisfies the checker (none exists today)", () => {
  for (const w of TRUSTED_WRITERS) assert.deepEqual(checkVerificationWriter(read(w)), [], w)
  assert.deepEqual(TRUSTED_WRITERS, [], "premise: no verification writer has been added; add one only with review, via the checker")
})

test("TRUSTED WRITER: ingestion cannot write a verification — its upsert payload, plan and runner never mention it", () => {
  for (const f of ["src/lib/services/govtAutoUpdate.ts", "src/lib/services/govtIngestPlan.ts", "scripts/run-ingestion.ts"]) {
    assert.doesNotMatch(strip(read(f)), /verified_(?:by|at)|verifiedBy|verifiedAt/, f)
  }
})

test("TRUSTED WRITER: govt_jobs allows no client writes — RLS exposes a single SELECT policy, so only service-role server code can set verified_*", () => {
  const policies = REPO_FILES.filter(f => f.endsWith(".sql")).map(f => readFileSync(f, "utf8")).join("\n")
  const govt = [...policies.matchAll(/CREATE POLICY\s+(\w+)\s+ON\s+govt_jobs\b([^;]*);/gi)].map(m => `${m[1]} ${m[2]}`)
  assert.ok(govt.length > 0, "premise: found the govt_jobs policies")
  for (const p of govt) assert.match(p, /FOR SELECT/i, `non-SELECT policy on govt_jobs: ${p.slice(0, 80)}`)
})

/* ======================= D. A CHANGED FIGURE LOSES ITS VERIFICATION ======================= */

// Model of the two ways a stored figure can change, using the REAL code on each side:
//   • ingestion  — normalise() hashes the raw notification, planIngestWrites() decides write/skip and stamps
//                  content_changed_at, persist() upserts that stamp WITHOUT touching verified_*  (guarded in C2);
//   • any other writer (admin edit, SQL) — the BEFORE UPDATE trigger in the integrity migration (checked as text below;
//                  the live function was also read back with a SELECT and matches this column list).
const T_VERIFIED = "2026-10-20T10:00:00.000Z"
const T_NOW = "2026-10-26T12:00:00.000Z"
const adapter = (id: string): SourceAdapter => ({ id, label: id, kind: "html", enabled: true, fetch: async () => [] })
const rawNote = (over: Partial<RawNotification> = {}): RawNotification => ({
  externalId: "advt-7", title: "Test University Recruitment 2026", org: "Test University", post: "Junior Engineer", vacancies: "250",
  lastDate: "2026-12-31", tab: "latest", officialUrl: "https://example.gov.in/recruitment", notificationPdf: "https://example.gov.in/advt-7.pdf", ...over,
})
const ingest = (r: RawNotification) => { const e = normalise(r, adapter("testuni")); return { ...e, id: e.job.id } }

/** The row exactly as the database holds it after an administrator verified the figure on 2026-10-20. */
function storedRow(r: RawNotification) {
  const e = ingest(r)
  return { entry: e, row: { id: e.id, content_hash: e.hash, post: e.job.post, vacancies: e.job.vacancies, content_changed_at: "2026-06-12T15:29:28.905Z", verified_at: T_VERIFIED, verified_by: ADMIN_ID } }
}
/** The row after persist() applied a planned write: new public values + the planned stamp; verified_* are not in the payload. */
function afterWrite<R extends Record<string, unknown>>(row: R, w: { entry: { job: { post?: string; vacancies?: string } }; contentChangedAt: string }) {
  return { ...row, post: w.entry.job.post, vacancies: w.entry.job.vacancies, content_changed_at: w.contentChangedAt }
}
const verdictOf = (row: Record<string, unknown>) => vacancyVerdict(mapRow({ title: "t", org: "o", short: "o", tab: "latest", status: "active", last_date: "2099-01-01", ...row }), new Date("2026-10-26T13:00:00Z"))

test("premise: the verified row is supported before ingestion runs again", () => {
  const { row } = storedRow(rawNote())
  assert.equal(verdictOf(row), "verified")
})

test("ingestion re-run with UNCHANGED content: planned as unchanged, no write, content_changed_at untouched → the verification still stands", () => {
  const { row } = storedRow(rawNote())
  const plan = planIngestWrites([ingest(rawNote())], [{ id: row.id, content_hash: row.content_hash as string }], T_NOW)
  assert.equal(plan.writes.length, 0)
  assert.equal(plan.unchanged.length, 1)
  assert.equal(verdictOf(row), "verified")
  assert.equal(sumRealVacancies([mapRow({ ...row, title: "t", org: "o", short: "o", tab: "latest", status: "active", last_date: "2099-01-01" })], new Date("2026-10-26T13:00:00Z")), 250)
})

test("ingestion changing `vacancies` (public field) advances content_changed_at past verified_at → the earlier verification is invalidated", () => {
  const { row } = storedRow(rawNote())
  const plan = planIngestWrites([ingest(rawNote({ vacancies: "9000" }))], [{ id: row.id, content_hash: row.content_hash as string }], T_NOW)
  assert.equal(plan.writes.length, 1)
  assert.equal(plan.writes[0].isNew, false)
  assert.equal(plan.writes[0].contentChangedAt, T_NOW)
  assert.ok(Date.parse(plan.writes[0].contentChangedAt) > Date.parse(T_VERIFIED), "the stamp is later than the verification")
  const updated = afterWrite(row, plan.writes[0])
  assert.equal(parseVacancyCount(updated.vacancies as string), 9000, "premise: the new figure is the one now stored")
  assert.equal(updated.verified_by, ADMIN_ID, "premise: ingestion left verified_by alone")
  assert.equal(verdictOf(updated), "stale-verification")
  const now = new Date("2026-10-26T13:00:00Z")
  const mapped = mapRow({ ...updated, title: "t", org: "o", short: "o", tab: "latest", status: "active", last_date: "2099-01-01" })
  assert.equal(sumRealVacancies([mapped], now), 0)
  assert.equal(aggregateVacancies([mapped], now), null)
  // counterfactual: WITHOUT the advanced stamp the same stale figure would be trusted — the stamp is what protects it
  assert.equal(verdictOf({ ...updated, content_changed_at: row.content_changed_at }), "verified")
})

test("every hashed public field (title, org, post, vacancies, lastDate, officialUrl, notificationPdf) invalidates an earlier verification when it changes", () => {
  const changes: Partial<RawNotification>[] = [
    { title: "Test University Recruitment 2026 (Corrigendum)" }, { org: "Test University, Delhi" }, { post: "Senior Engineer" },
    { vacancies: "251" }, { lastDate: "2027-01-15" }, { officialUrl: "https://example.gov.in/other" }, { notificationPdf: "https://example.gov.in/advt-7-v2.pdf" },
  ]
  for (const change of changes) {
    const { row } = storedRow(rawNote())
    const plan = planIngestWrites([ingest(rawNote(change))], [{ id: row.id, content_hash: row.content_hash as string }], T_NOW)
    assert.equal(plan.writes.length, 1, JSON.stringify(change))
    assert.equal(verdictOf(afterWrite(row, plan.writes[0])), "stale-verification", JSON.stringify(change))
  }
})

test("NEW ingested rows are stamped content_changed_at = now and arrive UNVERIFIED (no verified_* can come with an ingested row)", () => {
  const plan = planIngestWrites([ingest(rawNote({ externalId: "advt-8" }))], [], T_NOW)
  assert.equal(plan.writes.length, 1)
  assert.equal(plan.writes[0].isNew, true)
  assert.equal(plan.writes[0].contentChangedAt, T_NOW)
  const fresh = afterWrite({ id: plan.writes[0].entry.id }, plan.writes[0])
  assert.equal(verdictOf(fresh), "unverified")
  assert.equal(sumRealVacancies([mapRow({ ...fresh, title: "t", org: "o", short: "o", tab: "latest", status: "active", last_date: "2099-01-01" })], new Date("2026-10-26T13:00:00Z")), 0)
})

test("a mixed ingestion batch: unchanged verified row keeps its verification, the changed one loses it, and the pooled total is withheld as a whole", () => {
  const a = storedRow(rawNote({ externalId: "advt-a", vacancies: "100" }))
  const b = storedRow(rawNote({ externalId: "advt-b", vacancies: "200" }))
  const plan = planIngestWrites(
    [ingest(rawNote({ externalId: "advt-a", vacancies: "100" })), ingest(rawNote({ externalId: "advt-b", vacancies: "250" }))],
    [{ id: a.row.id, content_hash: a.row.content_hash as string }, { id: b.row.id, content_hash: b.row.content_hash as string }], T_NOW)
  assert.deepEqual(plan.writes.map(w => w.entry.id), [b.row.id])
  assert.deepEqual(plan.unchanged.map(u => u.id), [a.row.id])
  const rowA = a.row, rowB = afterWrite(b.row, plan.writes[0])
  assert.equal(verdictOf(rowA), "verified")
  assert.equal(verdictOf(rowB), "stale-verification")
  const now = new Date("2026-10-26T13:00:00Z")
  const base = { title: "t", org: "o", short: "o", tab: "latest", status: "active", last_date: "2099-01-01" }
  assert.equal(aggregateVacancies([mapRow({ ...rowA, ...base })], now), 100)
  assert.equal(aggregateVacancies([mapRow({ ...rowA, ...base }), mapRow({ ...rowB, ...base })], now), null)
})

/* ---------- the database side: migration 20261026000001 (a code artifact; not applied anywhere) ---------- */

const MIG_V1 = "supabase/migrations/20260727000001_govt_jobs_record_integrity.sql"
const MIG_V2 = "supabase/migrations/20261026000001_govt_jobs_verification_integrity.sql"
const MIG_V2_DOWN = "supabase/rollbacks/20261026000001_govt_jobs_verification_integrity.down.sql"
const SCENARIOS = "supabase/scratch-scenarios/govt_jobs_verification_integrity.sql"
const norm = (t: string) => t.replace(/\r/g, "")
const fnBody = (sql: string, name: string): string => {
  const m = norm(sql).match(new RegExp(`CREATE OR REPLACE FUNCTION ${name}\\(\\)[\\s\\S]*?AS \\$\\$([\\s\\S]*?)\\$\\$ LANGUAGE plpgsql;`))
  assert.ok(m, `function ${name} found`)
  return m![1].replace(/--.*$/gm, "").replace(/\s+/g, " ").trim()
}
const publicColumns = (sql: string) => {
  const m = norm(sql).match(/ROW\(\s*(NEW\.[\s\S]*?)\)\s*IS DISTINCT FROM\s*ROW\(\s*(OLD\.[\s\S]*?)\)\s*(?:THEN|;)/)
  assert.ok(m, "found the NEW/OLD comparison")
  const cols = (list: string, who: "NEW" | "OLD") => list.split(",").map(x => x.trim().replace(new RegExp(`^${who}\\.`), "")).filter(Boolean)
  const nw = cols(m![1], "NEW"), od = cols(m![2], "OLD")
  assert.deepEqual(nw, od, "NEW and OLD compare the same columns")
  return nw
}

test("the already-applied migration 20260727000001 is NOT edited in place (content pinned; fixes arrive as forward migrations)", () => {
  const sha = createHash("sha256").update(norm(read(MIG_V1))).digest("hex")
  assert.equal(sha, "e77f0040ac5d4b4568b36514c85f78a6e34c68e856e2d49bda70ee8936d6fe11")
})

test("the effective trigger is the NEWEST forward migration that defines it, and it changes only function bodies and comments", () => {
  const forward = REPO_FILES.filter(f => f.endsWith(".sql") && !f.endsWith(".down.sql") && /CREATE OR REPLACE FUNCTION set_govt_jobs_content_changed_at\(\)/.test(readFileSync(f, "utf8"))).map(rel).sort()
  assert.deepEqual(forward, [MIG_V1, MIG_V2])
  assert.equal(forward[forward.length - 1], MIG_V2, "the newest definition wins")
  const sql = norm(read(MIG_V2))
  assert.equal((sql.match(/CREATE OR REPLACE FUNCTION/g) ?? []).length, 2)
  assert.equal((sql.match(/COMMENT ON COLUMN govt_jobs\.\w+/g) ?? []).length, 3)
  assert.doesNotMatch(strip(sql.replace(/--.*$/gm, "")), /\b(ALTER\s+TABLE|DROP\s|DELETE\s+FROM|TRUNCATE|INSERT\s+INTO|UPDATE\s+govt_jobs|CREATE\s+TABLE|CREATE\s+INDEX)\b/i, "no table, data or index change")
  assert.match(sql, /^BEGIN;/m); assert.match(sql, /^COMMIT;/m)
})

test("what counts as PUBLIC content is unchanged by the forward migration: same columns, `vacancies`/`post` included, verified_* / content_changed_at excluded", () => {
  const v1 = publicColumns(read(MIG_V1)), v2 = publicColumns(read(MIG_V2))
  assert.deepEqual(v2, v1)
  for (const c of ["vacancies", "post", "vacancy_breakup", "title", "org", "last_date", "official_url", "notification_pdf", "status", "published", "review_status"]) assert.ok(v2.includes(c), `${c} is public content`)
  for (const c of ["verified_at", "verified_by", "content_changed_at", "updated_at", "record_type", "source_published_at", "created_at"]) assert.ok(!v2.includes(c), `${c} must not count as a content change`)
})

test("EXPLICIT content_changed_at OVERRIDE: the new trigger never takes the stamp from the caller (static check of the SQL; executed by the scratch scenarios B1/B2)", () => {
  const body = fnBody(read(MIG_V2), "set_govt_jobs_content_changed_at")
  const edit = body.match(/IF content_changed THEN NEW\.content_changed_at := (GREATEST\([\s\S]*?\));\s*ELSE/)
  assert.ok(edit, "found the stamp for a public edit")
  assert.doesNotMatch(edit![1], /\bNEW\./, "the stamp for an edit is computed from the clock and OLD values only — never from a NEW (caller-supplied) value")
  assert.match(edit![1], /clock_timestamp\(\)/)
  assert.match(edit![1], /OLD\.content_changed_at/); assert.match(edit![1], /OLD\.verified_at/)
  assert.match(body, /ELSE NEW\.content_changed_at := COALESCE\(OLD\.content_changed_at, NEW\.content_changed_at, NEW\.created_at\);/, "without an edit the previous stamp is kept; the caller value is only a fallback for a legacy NULL")
  assert.doesNotMatch(body, /IS NOT DISTINCT FROM OLD\.content_changed_at/, "the old 'caller-supplied value wins' escape hatch is gone")
})

test("SAME-STATEMENT / EQUAL-INSTANT: edit + verification in one statement is rejected, verified_at is stamped from the clock, no NOW() anywhere in the update trigger (static check; executed by scratch scenarios B3/B4/B5)", () => {
  const body = fnBody(read(MIG_V2), "set_govt_jobs_content_changed_at")
  assert.match(body, /IF content_changed AND verification_changed THEN RAISE EXCEPTION [\s\S]*?USING ERRCODE = 'check_violation';/)
  assert.match(body, /verification_changed := NEW\.verified_by IS NOT NULL AND \(NEW\.verified_by IS DISTINCT FROM OLD\.verified_by OR NEW\.verified_at IS DISTINCT FROM OLD\.verified_at\);/)
  assert.match(body, /IF verification_changed THEN NEW\.verified_at := clock_timestamp\(\); END IF;/, "a supplied verified_at is overwritten by the database clock")
  assert.doesNotMatch(body, /\bNOW\(\)/i, "NOW() is transaction-stable: using it for either stamp would allow equal instants")
  const ins = fnBody(read(MIG_V2), "set_govt_jobs_content_changed_at_insert")
  assert.match(ins, /IF NEW\.verified_at IS NOT NULL OR NEW\.verified_by IS NOT NULL THEN RAISE EXCEPTION [\s\S]*?'check_violation'/, "a row cannot be created already verified")
})

test("the rollback restores the 20260727000001 function bodies exactly (and nothing else)", () => {
  for (const fn of ["set_govt_jobs_content_changed_at", "set_govt_jobs_content_changed_at_insert"]) assert.equal(fnBody(read(MIG_V2_DOWN), fn), fnBody(read(MIG_V1), fn), fn)
  assert.doesNotMatch(norm(read(MIG_V2_DOWN)).replace(/--.*$/gm, ""), /\b(ALTER\s+TABLE|DROP\s|DELETE\s+FROM|TRUNCATE)\b/i)
})

test("the executable scenarios exist, refuse any database but the scratch one, load both migrations and the rollback, and cover each gap", () => {
  const sql = norm(read(SCENARIOS))
  assert.match(sql, /current_database\(\) <> 'govt_verification_scratch'/)
  for (const f of [MIG_V1, MIG_V2, MIG_V2_DOWN]) assert.ok(sql.includes(`\\i ${f}`), f)
  for (const id of ["A1", "A2", "B1", "B1b", "B2", "B2b", "B3", "B3b", "B3c", "B4", "B5", "B5b", "B6", "B7", "B8", "B9", "B10", "B10b", "B11", "C1"]) assert.ok(new RegExp(`'${id} `).test(sql), `scenario ${id}`)
})

/* ======================= E. THE INTERPLAY, MODELLED: trigger (old / new) × gate ======================= */
// A deliberately tiny model of the two trigger versions, so CI exercises the gate against every write sequence. The SQL it
// mirrors was EXECUTED on a throwaway Postgres 16 (supabase/scratch-scenarios/govt_jobs_verification_integrity.sql, scenarios in the
// names below) and is pinned token-by-token by the static tests above; this model is not a substitute for either.

type MRow = { vacancies: string; content_changed_at: string | null; verified_at: string | null; verified_by: string | null }
const iso = (ms: number) => new Date(ms).toISOString()
const ms = (t: string | null) => (t === null ? -Infinity : Date.parse(t))
const T0 = Date.parse("2026-06-12T15:29:28.000Z")
const baseRow = (over: Partial<MRow> = {}): MRow => ({ vacancies: "250", content_changed_at: iso(T0), verified_at: null, verified_by: null, ...over })
/** 20260727000001: a supplied content_changed_at wins; otherwise a public change is stamped NOW() (transaction-stable). */
function triggerV1(old: MRow, patch: Partial<MRow>, txNow: number): MRow {
  const neu = { ...old, ...patch }
  if (neu.content_changed_at === old.content_changed_at && neu.vacancies !== old.vacancies) neu.content_changed_at = iso(txNow)
  return neu
}
/** 20261026000001. `clock` = clock_timestamp(): strictly advancing within a transaction. */
function triggerV2(old: MRow, patch: Partial<MRow>, clock: () => number): MRow {
  const neu = { ...old, ...patch }
  const contentChanged = neu.vacancies !== old.vacancies
  const verificationChanged = neu.verified_by !== null && (neu.verified_by !== old.verified_by || neu.verified_at !== old.verified_at)
  if (contentChanged && verificationChanged) throw Object.assign(new Error("check_violation"), { code: "23514" })
  neu.content_changed_at = contentChanged ? iso(Math.max(clock(), ms(old.content_changed_at) + 1, ms(old.verified_at) + 1)) : (old.content_changed_at ?? neu.content_changed_at)
  if (verificationChanged) neu.verified_at = iso(clock())
  return neu
}
const mkClock = (start: number) => { let t = start; return () => (t += 1) }
const gate = (r: MRow, at = "2027-01-01T00:00:00Z") => vacancyVerdict(job({ vacancies: r.vacancies, post: "Junior Engineer", contentChangedAt: r.content_changed_at ?? undefined, verifiedAt: r.verified_at ?? undefined, verifiedBy: r.verified_by ?? undefined }), new Date(at))
const TX = Date.parse("2026-10-26T10:00:00.000Z")

test("SAME-TRANSACTION, EQUAL INSTANT (old trigger, scenario A2): an edit and a verification share NOW() → equal timestamps → the strict gate rejects what the old <= rule accepted", () => {
  let r = triggerV1(baseRow(), { vacancies: "9000" }, TX)
  r = triggerV1(r, { verified_by: ADMIN_ID, verified_at: iso(TX) }, TX) // verification written with the same transaction NOW()
  assert.equal(r.content_changed_at, r.verified_at, "premise: the two instants are identical")
  assert.ok(ms(r.content_changed_at) <= ms(r.verified_at), "premise: the previous '<=' rule would have ACCEPTED this")
  assert.equal(gate(r), "stale-verification")
  assert.equal(sumRealVacancies([mapRow({ id: "e", slug: "e", title: "t", org: "o", short: "o", tab: "latest", status: "active", last_date: "2099-01-01", vacancies: r.vacancies, post: "Junior Engineer", content_changed_at: r.content_changed_at, verified_at: r.verified_at, verified_by: r.verified_by })], new Date("2027-01-01T00:00:00Z")), 0)
})

test("SAME-STATEMENT edit + verification (new trigger, scenario B3): rejected with check_violation and nothing changes", () => {
  const clock = mkClock(TX)
  const before = baseRow()
  assert.throws(() => triggerV2(before, { vacancies: "9000", verified_by: ADMIN_ID, verified_at: iso(TX) }, clock), (e: { code?: string }) => e.code === "23514")
  assert.throws(() => triggerV2(before, { vacancies: "9000", verified_by: ADMIN_ID, content_changed_at: iso(T0 - 1) }, clock), (e: { code?: string }) => e.code === "23514", "a forged content_changed_at does not help")
  assert.deepEqual(before, baseRow(), "the row is unchanged")
})

test("EDIT THEN VERIFY in one transaction (new trigger, scenario B4): content_changed_at < verified_at, strictly → verified", () => {
  const clock = mkClock(TX)
  let r = triggerV2(baseRow(), { vacancies: "9000" }, clock)
  r = triggerV2(r, { verified_by: ADMIN_ID, verified_at: iso(TX) }, clock)
  assert.ok(ms(r.content_changed_at) < ms(r.verified_at))
  assert.equal(gate(r), "verified")
})

test("EXPLICIT content_changed_at OVERRIDE (new trigger, scenarios B1/B2): an edit supplying an older, future or equal stamp is still stamped by the clock → verification invalidated", () => {
  const verified = triggerV2(baseRow(), { verified_by: ADMIN_ID, verified_at: iso(TX) }, mkClock(TX))
  assert.equal(gate(verified), "verified")
  for (const forged of [iso(T0 - 86_400_000), iso(T0), verified.verified_at!, iso(ms(verified.verified_at) - 1), iso(Date.parse("2099-01-01T00:00:00Z")), null]) {
    const edited = triggerV2(verified, { vacancies: "9000", content_changed_at: forged }, mkClock(TX + 10_000))
    assert.ok(ms(edited.content_changed_at) > ms(edited.verified_at), `stamp is after the verification (supplied ${forged})`)
    assert.equal(gate(edited), "stale-verification", `supplied ${forged}`)
  }
})

test("EXPLICIT content_changed_at OVERRIDE without an edit (new trigger, scenario B2): moving the stamp backwards cannot re-validate a stale verification", () => {
  const verified = triggerV2(baseRow(), { verified_by: ADMIN_ID, verified_at: iso(TX) }, mkClock(TX))
  const stale = triggerV2(verified, { vacancies: "9000" }, mkClock(TX + 10_000))
  assert.equal(gate(stale), "stale-verification")
  for (const forged of [iso(T0), iso(T0 - 1), null, iso(Date.parse("2099-01-01T00:00:00Z"))]) {
    const tampered = triggerV2(stale, { content_changed_at: forged }, mkClock(TX + 20_000))
    assert.equal(tampered.content_changed_at, stale.content_changed_at, `supplied ${forged}`)
    assert.equal(gate(tampered), "stale-verification")
  }
})

test("a supplied verified_at is ignored (new trigger, scenario B5): back-dated or forward-dated, the database clock wins", () => {
  for (const forged of [iso(T0 - 1), iso(Date.parse("2099-01-01T00:00:00Z"))]) {
    const clock = mkClock(TX)
    const r = triggerV2(baseRow(), { verified_by: ADMIN_ID, verified_at: forged }, clock)
    assert.equal(r.verified_at, iso(TX + 1), `supplied ${forged}`)
    assert.equal(gate(r), "verified")
  }
})

test("KNOWN GAP until 20261026000001 is applied (old trigger, scenario A1): a writer that SUPPLIES its own content_changed_at defeats the stamp and the gate cannot see it — which is why the forward migration is required", () => {
  const verifiedRow = triggerV1(baseRow(), { verified_by: ADMIN_ID, verified_at: iso(TX) }, TX)
  assert.equal(gate(verifiedRow), "verified")
  // (a) edit while forging an older stamp
  const forgedEdit = triggerV1(verifiedRow, { vacancies: "9000", content_changed_at: iso(T0 - 1000) }, TX + 60_000)
  assert.equal(forgedEdit.content_changed_at, iso(T0 - 1000), "premise: the supplied stamp was kept")
  assert.equal(gate(forgedEdit), "verified", "documented limitation: nothing in the stored row betrays the edit")
  // (b) honest edit (stale), then the stamp is moved backwards to re-validate it
  const honest = triggerV1(verifiedRow, { vacancies: "9000" }, TX + 60_000)
  assert.equal(gate(honest), "stale-verification")
  assert.equal(gate(triggerV1(honest, { content_changed_at: iso(T0 - 1000) }, TX + 120_000)), "verified", "documented limitation: re-validated by back-dating")
  // the same attacks against the new trigger fail
  const v = triggerV2(baseRow(), { verified_by: ADMIN_ID, verified_at: iso(TX) }, mkClock(TX))
  const stale = triggerV2(v, { vacancies: "9000", content_changed_at: iso(T0 - 1000) }, mkClock(TX + 60_000))
  assert.equal(gate(stale), "stale-verification")
  assert.equal(gate(triggerV2(stale, { content_changed_at: iso(T0 - 1000) }, mkClock(TX + 120_000))), "stale-verification")
})

test("fail-closed aggregates and notification counts are preserved when a verification is stale or equal-timestamped", () => {
  const equal = job({ id: "eq", vacancies: "400", verifiedBy: ADMIN_ID, verifiedAt: "2026-10-26T10:00:00.000Z", contentChangedAt: "2026-10-26T10:00:00.000Z" })
  const pool = [CLEAN_VERIFIED, equal]
  const items = buildGovtHubStats(pool)
  assert.equal(items.some(i => i.key === "vacancies"), false, "the vacancy total is withheld as a whole")
  assert.equal(items.find(i => i.key === "notifications")?.num, 2, "notifications are still counted")
  assert.equal(buildGovtStats(pool).totalVacancies, null)
  assert.equal(listingVacanciesTotal(pool), 0)
  assert.equal(computeNavStats(pool).national.notifications, 2)
  assert.equal(computeNavStats(pool).national.vacancies, 0)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
