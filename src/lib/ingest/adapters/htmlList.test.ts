/**
 * htmlList.test.ts — REGRESSION for the Hindi mid-process drop-filter gap
 * found during the 2026-10-25 exhaustive MPPSC/HPSC audit.
 *
 * DEFAULT_DROP was English-only (result/interview/revised/corrigend/…), so a
 * Hindi-titled MPPSC/HPSC anchor for an interview schedule, a candidacy
 * rejection, a revised/corrigendum notice, an objection-redressal notice, or
 * an exam-conduct announcement passed straight through and would have been
 * published as if it were a fresh recruitment vacancy, once a real
 * source_published_at date is attached to it (these are exactly the titles
 * that already carry a "दिनांक DD/MM/YYYY" marker — see
 * extractPublishedDate.test.ts). Of the 24 active MPPSC/HPSC rows that
 * extract a real, current (within-365-day) date today, 14 are this kind of
 * mid-process notice and only 10 are genuinely new recruitment ads
 * (confirmed against real production titles, 2026-10-25).
 *
 * Also covers the zero-width-joiner normalisation fix: Devanagari conjuncts
 * are frequently rendered with a U+200C/U+200D joiner around the halant
 * (e.g. "साक्षात्‍कार" vs "साक्षात्कार") — without stripping it, a
 * joiner-variant mid-process title slips past DEFAULT_DROP undetected, which
 * is exactly what happened in the exhaustive audit before this fix (title
 * matching went from 1/60 to 14/60 mid-process hits once joiners were
 * stripped before testing).
 *
 *   npx tsx src/lib/ingest/adapters/htmlList.test.ts
 */
import assert from "node:assert/strict"
import { parseHtmlList, type HtmlListConfig } from "./htmlList"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}

const CFG: HtmlListConfig = {
  id: "mppsc", label: "MPPSC (Madhya Pradesh)", org: "Madhya Pradesh Public Service Commission",
  stateSlug: "madhya-pradesh", stateName: "Madhya Pradesh",
  listUrl: "https://mppsc.mp.gov.in/", hrefIncludes: "advertisement", maxItems: 30,
}

const anchor = (href: string, inner: string) => `<a href="${href}">${inner}</a>`

test("REGRESSION — a Hindi interview-schedule notice (with the real ZWJ-joined spelling) is dropped, not kept as a fresh notification", () => {
  const html = anchor(
    "/uploads/advertisement/interview-1.pdf",
    "वैज्ञानिक अधिकारी (रसायन) - 2023 के पद हेतु साक्षात्‍कार आयोजन संबंधी सूचना, दिनांक 30/07/2026",
  )
  const out = parseHtmlList(html, CFG)
  assert.equal(out.length, 0, `expected the interview notice to be dropped, got: ${JSON.stringify(out)}`)
})

test("REGRESSION — a Hindi candidacy-rejection notice is dropped", () => {
  const html = anchor(
    "/uploads/advertisement/rejection-1.pdf",
    "मुख्‍य रसायनज्ञ 2024 के पद की उम्‍मीदवारी निरस्‍त किए जाने संबंधी सूचना, दिनांक 12/06/2026",
  )
  const out = parseHtmlList(html, CFG)
  assert.equal(out.length, 0, `expected the rejection notice to be dropped, got: ${JSON.stringify(out)}`)
})

test("REGRESSION — a Hindi revised/objection-redressal notice is dropped", () => {
  const html = anchor(
    "/uploads/advertisement/revised-1.pdf",
    "संशोधित विज्ञप्ति राज्‍य सेवा (मुख्‍य) परीक्षा 2025 के आयोजन संबंधी सूचना, दिनांक 20/06/2026",
  )
  const out = parseHtmlList(html, CFG)
  assert.equal(out.length, 0, `expected the revised/objection notice to be dropped, got: ${JSON.stringify(out)}`)
})

test("REGRESSION — a Hindi exam-conduct ('आयोजन संबंधी सूचना') notice for an already-announced exam is dropped", () => {
  const html = anchor(
    "/uploads/advertisement/conduct-1.pdf",
    "राज्‍य सेवा (मुख्‍य) परीक्षा 2025 के आयोजन संबंधी सूचना, दिनांक 19/06/2026",
  )
  const out = parseHtmlList(html, CFG)
  assert.equal(out.length, 0, `expected the exam-conduct notice to be dropped, got: ${JSON.stringify(out)}`)
})

test("REGRESSION — an ENGLISH-titled candidacy-rejection announcement (HPSC-shaped) is dropped, not kept as a fresh notification", () => {
  const html = anchor(
    "/Portals/0/announcement-1.pdf",
    "Haryana Public Service Commission Announcement dated 08.06.2026 regarding Final Rejection for the Posts of Assistant Professor (College Cadre)",
  )
  const out = parseHtmlList(html, { ...CFG, id: "hpsc", org: "Haryana Public Service Commission", listUrl: "https://hpsc.gov.in/", hrefIncludes: undefined })
  assert.equal(out.length, 0, `expected the English rejection announcement to be dropped, got: ${JSON.stringify(out)}`)
})

test("sanity — a genuinely NEW English-titled recruitment advertisement is still kept, with its real date extracted", () => {
  const html = anchor(
    "/uploads/advertisement/new-1.pdf",
    "Recruitment Advertisement for Scientific Officer Biology 2026 (Adv No./07/2026), Dated 16/03/2026",
  )
  const out = parseHtmlList(html, CFG)
  assert.equal(out.length, 1, `expected the new recruitment ad to be kept, got: ${JSON.stringify(out)}`)
  assert.equal(out[0].publishedAt, "2026-03-16T00:00:00.000Z")
})

test("sanity — a genuinely NEW Hindi recruitment advertisement (no mid-process term) is still kept", () => {
  const html = anchor(
    "/uploads/advertisement/new-2.pdf",
    "Madhya Pradesh Public Service Commission सहायक जिला लोक अभियोजन अधिकारी विज्ञापन भर्ती 2026, दिनांक 10/03/2026",
  )
  const out = parseHtmlList(html, CFG)
  assert.equal(out.length, 1, `expected the new Hindi recruitment ad to be kept, got: ${JSON.stringify(out)}`)
})

test("REGRESSION — the English result/answer-key/admit-card/interview/revised/corrigendum drop terms still work (pre-existing behaviour unchanged)", () => {
  for (const title of [
    "MPPSC State Service Exam 2025 Result",
    "MPPSC State Service Exam 2025 Answer Key",
    "MPPSC State Service Exam 2025 Admit Card",
    "MPPSC State Service Exam 2025 Interview Schedule",
    "MPPSC State Service Exam 2025 Revised Notice",
    "MPPSC State Service Exam 2025 Corrigendum",
  ]) {
    const out = parseHtmlList(anchor("/uploads/advertisement/x.pdf", title), CFG)
    assert.equal(out.length, 0, `expected "${title}" to be dropped, got: ${JSON.stringify(out)}`)
  }
})

test("a mid-process title is dropped even when it ALSO contains 'recruit'/'vacancy'-style keep terms", () => {
  const html = anchor(
    "/uploads/advertisement/mixed-1.pdf",
    "Recruitment 2024 Vacancy साक्षात्कार आयोजन संबंधी सूचना, दिनांक 01/07/2026",
  )
  const out = parseHtmlList(html, CFG)
  assert.equal(out.length, 0, `drop must win over keep for a mid-process title, got: ${JSON.stringify(out)}`)
})

console.log(`\nhtmlList drop-filter tests: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
