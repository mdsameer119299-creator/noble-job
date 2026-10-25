/**
 * govtStatsSource.test.ts — REGRESSION for the live-preview vacancy-fabrication
 * bug found during PR#47 preview verification.
 *
 * Observed on the deployed preview: the JNU and UKSSSC (advt-78/advt-79)
 * detail pages rendered fabricated vacancy totals (24,868 and 6,548
 * respectively) with fabricated per-post breakdowns, while the underlying
 * `govt_jobs` row for both has `vacancies = "Not Specified"` and
 * `vacancy_breakup = []` — nothing in the data supports those numbers.
 *
 * Root cause: `mapRow()` (now in govtRowMapper.ts, split out of
 * govtStatsSource.ts) called `applyGovtVacancies()` with no options, and
 * `enrichGovtJob()` was invoked (by `loadActiveGovtRows` / `loadGovtJobRow`)
 * without `{ synthesizeVacancies: false }`. Both default to the demo/fallback
 * behaviour, which synthesizes a deterministic keyword-profile vacancy count
 * + breakup whenever the source has no parseable number — appropriate for
 * the in-memory demo dataset, never for a real DB-backed row
 * (adapter-ingested or curated seed). `govtAutoUpdate.ts` already gets this
 * right on the write/ingestion path
 * (`enrichGovtJob(base, { synthesizeVacancies: false })`); this test locks in
 * the matching guarantee on the read path.
 *
 *   npm run test:govt-vacancies
 *
 * Pure, dependency-free: exercises only mapRow() + enrichGovtJob(), no I/O.
 * mapRow() lives in its own govtRowMapper.ts (not govtStatsSource.ts)
 * specifically so it CAN be imported here — govtStatsSource.ts calls React's
 * `cache()` / Next's `unstable_cache()` at module scope, which crashes
 * ("(0, import_react.cache) is not a function") the instant it's imported
 * outside the Next runtime, matching this repo's other dependency-free unit
 * tests that deliberately avoid pulling that chain in.
 */
import assert from "node:assert/strict"
import { mapRow } from "./govtRowMapper"
import { enrichGovtJob } from "@/lib/data/govtData"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}

// A real DB row shaped like the actual JNU record that exposed the bug:
// vacancies unparseable ("Not Specified"), no vacancy_breakup.
const jnuRow = {
  id: "jnu:jnu-advt-of-guest-faculty-rc-gf-2026-03-ssis",
  source_id: "jnu",
  org: "Jawaharlal Nehru University (JNU)",
  title: "Jawaharlal Nehru University (JNU) Recruitment 2026",
  post: "teachers and other equivalent cadres at any level. (ii)",
  vacancies: "Not Specified",
  vacancy_breakup: [],
  record_type: "notification",
  status: "active",
  tab: "latest",
  last_date: "TBA",
  source_published_at: null,
}

test("REGRESSION — mapRow() must not fabricate a vacancy count for a real row with no source number", () => {
  const job = mapRow(jnuRow)
  assert.equal(job.vacancies, "Not Specified", `mapRow fabricated a vacancy count: got "${job.vacancies}"`)
  assert.equal(job.vacancyBreakup?.length ?? 0, 0, "mapRow fabricated a vacancy breakup table")
})

test("REGRESSION — enrichGovtJob(row, { synthesizeVacancies: false }) must not re-fabricate after mapRow", () => {
  const mapped = mapRow(jnuRow)
  const job = enrichGovtJob(mapped as never, { synthesizeVacancies: false })
  assert.equal(job.vacancies, "Not Specified", `enrichGovtJob fabricated a vacancy count: got "${job.vacancies}"`)
  assert.equal(job.vacancyBreakup?.length ?? 0, 0, "enrichGovtJob fabricated a vacancy breakup table")
})

test("sanity — a row with a real, parseable vacancy count still passes it through untouched", () => {
  const row = { ...jnuRow, id: "x:real-count", vacancies: "11,558", vacancy_breakup: [] }
  const job = mapRow(row)
  assert.equal(job.vacancies, "11,558")
})

// The second record found fabricated on the preview: UKSSSC advt-78/advt-79 —
// same "Not Specified" / empty-breakup shape as JNU above, confirmed against
// the live govt_jobs row via Supabase during preview verification.
const uksssRow = {
  id: "uksssc:uksssc-advt-78-advt-79",
  source_id: "uksssc",
  org: "Uttarakhand Subordinate Service Selection Commission",
  title:
    "Uttarakhand Subordinate Service Selection Commission पदनाम-कनिष्ठ सहायक/आशुलिपिक(वैयत्तिक सहायक-Advt-78) व सहायक लेखाकार(Advt-79) की लिखित परीक्षा के ",
  post: "पदनाम-कनिष्ठ सहायक/आशुलिपिक(वैयत्तिक सहायक-Advt-78) व सहायक लेखाकार(Advt-79) की लिखित परीक्षा के स्थगन से सम्बन्ध में वि",
  vacancies: "Not Specified",
  vacancy_breakup: [],
  record_type: "notification",
  status: "active",
  tab: "latest",
  last_date: "TBA",
  source_published_at: null,
}

test("REGRESSION (UKSSSC advt-78/79) — mapRow() must not fabricate a vacancy count", () => {
  const job = mapRow(uksssRow)
  assert.equal(job.vacancies, "Not Specified", `mapRow fabricated a vacancy count: got "${job.vacancies}"`)
  assert.equal(job.vacancyBreakup?.length ?? 0, 0, "mapRow fabricated a vacancy breakup table")
})

test("REGRESSION (UKSSSC advt-78/79) — enrichGovtJob(row, { synthesizeVacancies: false }) must not re-fabricate", () => {
  const mapped = mapRow(uksssRow)
  const job = enrichGovtJob(mapped as never, { synthesizeVacancies: false })
  assert.equal(job.vacancies, "Not Specified", `enrichGovtJob fabricated a vacancy count: got "${job.vacancies}"`)
  assert.equal(job.vacancyBreakup?.length ?? 0, 0, "enrichGovtJob fabricated a vacancy breakup table")
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
