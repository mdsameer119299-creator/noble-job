/**
 * backfill-govt-lifecycle-copy.test.ts — mock-database safeguard test for the
 * one-time lifecycle-copy repair tool (scripts/backfill-govt-lifecycle-copy.ts).
 *
 * Exercises `computeBackfillPlan()` — the EXACT pure function the live script
 * calls for both its dry-run print and its `--apply` write — against fixture
 * rows shaped like real result/admit_card/answer_key govt_jobs rows (same
 * style as the production rows found stale on 2026-10-25: a title, org, post,
 * tab/record_type, and apply-oriented overview/faqs/important_dates/article
 * text generated before the lifecycle-aware template fix). No live database
 * connection is made anywhere in this file; `computeBackfillPlan` takes rows
 * as plain objects, so this doubles as the "mock database" the task asked
 * the script to be verified against.
 *
 * Safeguards verified:
 *   - only overview/faqs/important_dates/article are ever patched
 *   - a row with extra columns attached (vacancies, official_url, last_date,
 *     exam_date, record_type, status) never leaks any of them into a patch,
 *     even if a caller widens the select() in the future
 *   - an already-clean row produces no diff and no update (idempotent)
 *   - re-running the plan against its own output converges to zero diffs
 *
 *   npx tsx scripts/backfill-govt-lifecycle-copy.test.ts
 *
 * The real production BEFORE/AFTER content for the 10 affected rows (fetched
 * read-only from Supabase) is reported separately as this cycle's audit
 * evidence — this file is the permanent, representative regression suite.
 */
import assert from "node:assert/strict"
import { computeBackfillPlan, BACKFILL_WRITABLE_FIELDS, type BackfillRow } from "./backfill-govt-lifecycle-copy"
import { mapRow } from "@/lib/services/govtRowMapper"
import { generateGovtArticle } from "@/lib/services/govtArticle"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}

const plan = (rows: Record<string, unknown>[]) => computeBackfillPlan(rows as unknown as BackfillRow[], mapRow, generateGovtArticle)

/**
 * Shaped like a real result/admit_card/answer_key row fetched via
 * `select("*")`: carries the structural fields `mapRow`/`generateGovtArticle`
 * need (tab, record_type, org, post, vacancies, last_date, exam_date) PLUS
 * stale, apply-oriented overview/faqs/important_dates/article text — exactly
 * the shape the 10 real affected production rows had before this fix.
 */
function staleRow(id: string, tab: "results" | "admit" | "answer", title: string): Record<string, unknown> {
  const recordType = tab === "results" ? "result" : tab === "admit" ? "admit_card" : "answer_key"
  return {
    id,
    title,
    org: "Test Board",
    post: "Various Posts",
    vacancies: "1,234",
    tab,
    record_type: recordType,
    last_date: "-",
    exam_date: null,
    // Stale copy, generated before buildDates()/buildFaqs() became stage-aware.
    overview: `Test Board has released an official notification for ${title}. A total of 1,234 vacancies are available for the post of Various Posts. Eligible and interested candidates can apply online before -. Read the complete details on eligibility, age limit, application fee, selection process and important dates below before applying.`,
    faqs: [
      { q: `What is the last date to apply for ${title}?`, a: `The last date to submit the online application for ${title} is -.` },
      { q: `How can I apply online for ${title}?`, a: "Apply on the official portal before the last date." },
    ],
    important_dates: [
      { label: "Last Date to Apply", date: "-" },
      { label: "Last Date for Fee Payment", date: "-" },
      { label: "Exam Date", date: "To be announced" },
    ],
    article: `Test Board has released an official notification for ${title}... apply online before -.`,
  }
}

const STALE_FIXTURES = [
  staleRow("fx-result-1", "results", "Fixture Board Result 2026"),
  staleRow("fx-admit-1", "admit", "Fixture Board Admit Card 2026"),
  staleRow("fx-answer-1", "answer", "Fixture Board Answer Key 2026"),
]

/* ----------------------------- before/after behaviour ----------------------------- */

test("all 3 result/admit/answer fixtures (stale, apply-oriented copy) are flagged as needing repair", () => {
  const { diffs } = plan(STALE_FIXTURES)
  assert.deepEqual(diffs.map(d => d.id).sort(), ["fx-admit-1", "fx-answer-1", "fx-result-1"])
})

test("every changed field, for every fixture, is one of overview/faqs/important_dates/article", () => {
  const { diffs } = plan(STALE_FIXTURES)
  for (const d of diffs) {
    assert.ok(d.changed.length > 0)
    for (const field of d.changed) {
      assert.ok((BACKFILL_WRITABLE_FIELDS as readonly string[]).includes(field), `${d.id} changed an unexpected field: ${field}`)
    }
  }
})

test("the regenerated AFTER copy is clean: no apply-oriented overview, FAQ, or Important Dates row survives", () => {
  const { updates } = plan(STALE_FIXTURES)
  assert.equal(updates.length, 3)
  for (const u of updates) {
    assert.doesNotMatch(String(u.patch.overview), /apply online before/i, `${u.id} overview still invites applying`)
    const faqText = (u.patch.faqs as { q: string; a: string }[]).map(f => `${f.q} ${f.a}`).join(" ")
    assert.doesNotMatch(faqText, /last date to apply|apply online for/i, `${u.id} FAQs still reference applying`)
    const labels = (u.patch.important_dates as { label: string }[]).map(d => d.label)
    assert.ok(!labels.some(l => /last date to apply|last date for fee payment/i.test(l)), `${u.id} Important Dates still has an apply/fee row`)
    assert.doesNotMatch(String(u.patch.article), /apply online before/i, `${u.id} article still invites applying`)
  }
})

/* --------------------------------- safeguards --------------------------------- */

test("SAFEGUARD — an already-clean row (regenerated output already matches stored output) produces NO diff and NO update", () => {
  const { updates } = plan(STALE_FIXTURES)
  const cleaned = STALE_FIXTURES.map(row => {
    const u = updates.find(x => x.id === row.id)
    return u ? { ...row, ...u.patch } : row
  })
  const { diffs } = plan(cleaned)
  assert.deepEqual(diffs, [], "re-running the plan against the already-repaired rows must be a no-op (idempotent)")
})

test("SAFEGUARD — a row with extra, non-writable columns attached never leaks any of them into the patch, even if official_url/vacancies/dates/record_type are present", () => {
  const poisoned = {
    ...STALE_FIXTURES[0],
    vacancies: "999,999",
    official_url: "https://attacker.example/not-the-real-source",
    last_date: "01 Jan 2099",
    exam_date: "01 Jan 2099",
    record_type: "notification", // even an attempt to flip the record type must not be picked up
    status: "active",
  }
  const { updates } = plan([poisoned])
  assert.equal(updates.length, 1)
  const keys = Object.keys(updates[0].patch)
  assert.ok(keys.length > 0, "expected the stale fixture to still diff")
  for (const k of keys) {
    assert.ok((BACKFILL_WRITABLE_FIELDS as readonly string[]).includes(k), `patch leaked a non-writable field: ${k}`)
  }
  for (const forbidden of ["vacancies", "official_url", "last_date", "exam_date", "record_type", "status"]) {
    assert.ok(!(forbidden in updates[0].patch), `patch must never contain '${forbidden}'`)
  }
})

test("SAFEGUARD — an OPEN recruitment (notification) accidentally included in the input is diffed/patched the same safe way — never a vacancy/link/date field — even though it sits outside this tool's intended record_type filter", () => {
  const openJob = {
    id: "stray-open-job",
    title: "Stray Open Recruitment 2026",
    tab: "latest",
    record_type: "notification",
    org: "Open Co",
    post: "Officer",
    vacancies: "500",
    overview: "stale placeholder overview",
    faqs: [],
    important_dates: [],
    article: "stale placeholder article",
  }
  const { updates } = plan([openJob])
  assert.equal(updates.length, 1)
  const keys = Object.keys(updates[0].patch)
  assert.ok(keys.every(k => (BACKFILL_WRITABLE_FIELDS as readonly string[]).includes(k)))
  assert.ok(!("vacancies" in updates[0].patch))
})

test("sanity — a row with no stale data at all (freshly generated, lifecycle-aware copy already in place) round-trips with zero diffs", () => {
  const job = { id: "fresh-result", title: "Fresh Result 2026", tab: "results", record_type: "result", org: "Y", post: "Z" }
  const gen = generateGovtArticle(mapRow(job))
  const row = { ...job, overview: gen.overview, faqs: gen.faqs, important_dates: gen.importantDates, article: gen.article }
  const { diffs, updates } = plan([row])
  assert.deepEqual(diffs, [])
  assert.deepEqual(updates, [])
})

console.log(`\nbackfill-govt-lifecycle-copy mock-DB tests: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
