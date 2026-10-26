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
  // verified at the very moment of the last change is still current (<=), and Postgres' textual timestamps parse
  assert.equal(vacancyVerdict(job({ verifiedAt: "2026-06-12 15:29:28.905178+00", verifiedBy: ADMIN_ID, contentChangedAt: "2026-06-12 15:29:28.905178+00" })), "verified")
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
/** Files that may MENTION the columns, and why. NONE of them writes a value: they declare, select, map or document. */
const READ_ONLY_TOUCHES = [
  "src/types/govtJob.ts",                      // type declaration
  "src/lib/config/govtColumns.ts",             // SELECT column list
  "src/lib/services/govtRowMapper.ts",         // row → GovtJob (read)
  "src/lib/data/govtVacancies.ts",             // the gate + the contract text
  "supabase/migrations/20260727000001_govt_jobs_record_integrity.sql",
  "supabase/migrations/20260727000001_govt_jobs_record_integrity.down.sql",
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

test("TRUSTED WRITER: any allowed writer must be an admin-gated route that stores the authenticated admin's id", () => {
  for (const w of TRUSTED_WRITERS) {
    const src = strip(read(w))
    assert.match(src, /requireAdminApi\(\)/, `${w}: must call requireAdminApi()`)
    assert.match(src, /verified_by\s*:\s*auth\.user\.id/, `${w}: verified_by must be the authenticated admin's id`)
    assert.doesNotMatch(src, /verified_by\s*:\s*["'`]/, `${w}: verified_by must never be a literal label`)
  }
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

test("non-ingestion edits: the BEFORE UPDATE trigger bumps content_changed_at for `vacancies`/`post` and never for verified_* — compared in the migration SQL", () => {
  const sql = read("supabase/migrations/20260727000001_govt_jobs_record_integrity.sql")
  const m = sql.match(/ROW\(\s*(NEW\.[\s\S]*?)\)\s*IS DISTINCT FROM\s*ROW\(\s*(OLD\.[\s\S]*?)\)\s*THEN/)
  assert.ok(m, "found the NEW/OLD comparison in set_govt_jobs_content_changed_at()")
  const cols = (list: string, who: "NEW" | "OLD") => list.split(",").map(x => x.trim().replace(new RegExp(`^${who}\\.`), "")).filter(Boolean)
  const nw = cols(m![1], "NEW"), od = cols(m![2], "OLD")
  assert.deepEqual(nw, od, "NEW and OLD compare the same columns")
  for (const c of ["vacancies", "post", "vacancy_breakup", "title", "org", "last_date", "official_url", "notification_pdf", "status", "published", "review_status"]) assert.ok(nw.includes(c), `${c} is public content`)
  for (const c of ["verified_at", "verified_by", "content_changed_at", "updated_at", "record_type", "source_published_at", "created_at"]) assert.ok(!nw.includes(c), `${c} must not count as a content change`)
  assert.match(sql, /CREATE TRIGGER trg_govt_jobs_content_changed\s+BEFORE UPDATE ON govt_jobs\s+FOR EACH ROW/)
  assert.match(sql, /NEW\.content_changed_at := NOW\(\)/)
  assert.match(sql, /IF NEW\.content_changed_at IS NOT DISTINCT FROM OLD\.content_changed_at/, "a writer that stamps content_changed_at itself (ingestion) wins; otherwise the trigger stamps it")
})

test("the trigger function is defined once (no later migration redefines what counts as a content change)", () => {
  const defs = REPO_FILES.filter(f => f.endsWith(".sql") && /set_govt_jobs_content_changed_at\b/.test(readFileSync(f, "utf8"))).map(rel).sort()
  assert.deepEqual(defs, [
    "supabase/migrations/20260727000001_govt_jobs_record_integrity.down.sql",
    "supabase/migrations/20260727000001_govt_jobs_record_integrity.sql",
  ])
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
