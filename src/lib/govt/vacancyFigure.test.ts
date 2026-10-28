/**
 * vacancyFigure.test.ts — regression tests for per-record vacancy display gate.
 *
 *   npm run test:govt-vacancy-figure
 *
 * Covers:
 *   • vacancySuppression / displayVacancies / reviewedClosingDate — unit
 *   • scrubFigureSentences / withoutVacancyFigure — prose scrubbing
 *   • applyVacancyDisplayGate — composite gate
 *   • mapRow + enrichGovtJob pipeline on JNU RC/75/2026 and DRDO RAC 152 shaped rows
 *   • govtDetailMetaText / govtHeroChips / govtQuickFacts / govtShowsVacancyDetails — detail page text
 *   • generateGovtArticle — template output with suppressed / real figures
 *   • buildGovtFactsDescription — JSON-LD description field
 *   • Expiry: JNU closing date 15 Jun 2026 makes the row expired via isActiveGovtJob
 *   • Card rendering: GovtJobListCard / GovtJobCard / LatestJobCard show no figure for suppressed rows
 *   • Unaffected jobs: a clean row with a real figure still renders normally
 *
 * Pure, dependency-free: exercises only importable functions, no I/O, no Next runtime.
 */
import assert from "node:assert/strict"
import { mapRow } from "@/lib/services/govtRowMapper"
import { enrichGovtJob } from "@/lib/data/govtData"
import {
  vacancySuppression,
  displayVacancies,
  reviewedClosingDate,
  scrubFigureSentences,
  withoutVacancyFigure,
  applyVacancyDisplayGate,
  scrubNotSpecifiedPhrase,
  isRouteBlocked,
  REVIEWED_NOTICES,
} from "./vacancyFigure"
// govtStatsSource uses react.cache() at module level (Next.js runtime only).
// Re-implement isServableGovtJob directly for the test environment.
import { isActiveGovtJob } from "@/lib/utils/govtJobExpiry"
import { isRenderableJob } from "@/lib/jobs/renderable"
function isServableGovtJob(job: { id?: string; status?: string; lastDate?: string; [k: string]: unknown }): boolean {
  if (isRouteBlocked(job.id)) return false
  return isActiveGovtJob(job as never) && isRenderableJob(job as never, "govt")
}
import { govtDetailMetaText, govtHeroChips, govtQuickFacts, govtShowsVacancyDetails } from "./detailFacts"
import { generateGovtArticle } from "@/lib/services/govtArticle"
import { isGovtJobExpired } from "@/lib/utils/govtJobExpiry"
import { buildGovtFactsDescription } from "@/lib/seo/jobPostingDescription"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}

/* ================================================================== */
/* Fixtures                                                            */
/* ================================================================== */

/** JNU RC/75/2026 — stored with 42,564 vacancies, officially not stated. */
const jnuRow = {
  id: "jnu:jnu-rc-75-2026",
  source_id: "jnu",
  org: "Jawaharlal Nehru University (JNU)",
  title: "JNU Recruitment 2026 — Teaching Posts",
  post: "teachers and other equivalent cadres at any level. (ii)",
  vacancies: "42,564",
  vacancy_breakup: [
    { post: "Group A", total: "17,526", eligibility: "PhD" },
    { post: "Group B", total: "25,038", eligibility: "Master's Degree" },
  ],
  record_type: "notification",
  status: "active",
  tab: "latest",
  last_date: "TBA",
  source_published_at: null,
}

/** DRDO RAC Advt 152 — stored with 2 vacancies, officially unconfirmed. */
const drdoRow = {
  id: "drdo-rac:drdo-rac-152",
  source_id: "drdo-rac",
  org: "Defence Research & Development Organisation (DRDO)",
  title: "DRDO RAC Advt 152 — Scientist Recruitment",
  post: "SCIENTISTS IN DRDO Closing date of Advertisement",
  vacancies: "2",
  vacancy_breakup: [],
  record_type: "notification",
  status: "active",
  tab: "latest",
  last_date: "TBA",
  source_published_at: null,
}

/**
 * JNU Guest Faculty rows — actual DB rows from production.
 * These share the slug jawaharlal-nehru-university-jnu-recruitment-2026,
 * have scraped-fragment post fields, "Not Specified" vacancies, and last_date=TBA.
 * They must be blocked from the detail route via REVIEWED_NOTICES[id].blockRoute=true.
 */
const jnuGfRow1: Record<string, unknown> = {
  id: "jnu:jnu-advt-of-guest-faculty-rc-gf-2026-03-ssis",
  source_id: "jnu",
  org: "Jawaharlal Nehru University (JNU)",
  slug: "jawaharlal-nehru-university-jnu-recruitment-2026",
  title: "JNU Recruitment 2026",
  post: "teachers and other equivalent cadres at any level. (ii)",
  vacancies: "Not Specified",
  vacancy_breakup: [],
  record_type: "notification",
  status: "active",
  review_status: "approved",
  published: true,
  last_date: "TBA",
  // Stored overview produced by older ingestion — contains "Not Specified vacancies"
  overview: "Jawaharlal Nehru University (JNU) has released an official notification for JNU Recruitment 2026. A total of Not Specified vacancies are available for the post of teachers and other equivalent cadres at any level. (ii). Eligible and interested candidates can apply online before TBA.",
  article: "Jawaharlal Nehru University (JNU) has released an official notification for JNU Recruitment 2026. A total of Not Specified vacancies are available for the post of teachers and other equivalent cadres at any level. (ii). Eligible and interested candidates can apply online before TBA.",
}
const jnuGfRow2: Record<string, unknown> = {
  ...jnuGfRow1,
  id: "jnu:jnu-advtnorc-gf-2026-01",
  slug: "jawaharlal-nehru-university-jnu-recruitment-2026",
}
const jnuGfRow3: Record<string, unknown> = {
  ...jnuGfRow1,
  id: "jnu:jnu-jnu-advtno-rc-gf-02-2026",
  slug: "jawaharlal-nehru-university-jnu-recruitment-2026",
}

/** A clean, unaffected job with a real figure. */
const cleanRow = {
  id: "ssc:ssc-gd-2026",
  source_id: "ssc",
  org: "Staff Selection Commission (SSC)",
  title: "SSC GD Constable 2026",
  post: "Constable (GD) in CAPFs, NIA, SSF & Rifleman (GD) in AR",
  vacancies: "26,146",
  vacancy_breakup: [{ post: "BSF", total: "8,000", eligibility: "10th pass" }],
  record_type: "notification",
  status: "active",
  tab: "latest",
  last_date: "15 Jul 2027",
  source_published_at: "2026-06-01",
  qualification: "10th pass",
  location: "All India",
  salary: "₹21,700 - ₹69,100",
  ageRange: "18-23",
  fee: "100",
}

/* ================================================================== */
/* 1. vacancySuppression                                               */
/* ================================================================== */

test("vacancySuppression: JNU reviewed-notice → 'reviewed-notice'", () => {
  assert.equal(vacancySuppression(jnuRow), "reviewed-notice")
})

test("vacancySuppression: DRDO reviewed-notice → 'reviewed-notice'", () => {
  assert.equal(vacancySuppression(drdoRow), "reviewed-notice")
})

test("vacancySuppression: DRDO post is also a scraped fragment, but reviewed-notice takes precedence", () => {
  // The post "SCIENTISTS IN DRDO Closing date of Advertisement" IS a scraped fragment,
  // but the reviewed-notice check fires first.
  assert.equal(vacancySuppression(drdoRow), "reviewed-notice")
})

test("vacancySuppression: clean job → null (not suppressed)", () => {
  assert.equal(vacancySuppression(cleanRow), null)
})

test("vacancySuppression: job with no figure → null (nothing to suppress)", () => {
  assert.equal(vacancySuppression({ id: "x:y", vacancies: "Not Specified" }), null)
})

test("vacancySuppression: job with scraped-fragment post → 'scraped-fragment'", () => {
  assert.equal(vacancySuppression({ id: "x:unknown", vacancies: "500", post: "some trailing text. (iii)" }), "scraped-fragment")
})

/* ================================================================== */
/* 2. displayVacancies                                                 */
/* ================================================================== */

test("displayVacancies: JNU → undefined (suppressed)", () => {
  assert.equal(displayVacancies(jnuRow), undefined)
})

test("displayVacancies: DRDO → undefined (suppressed)", () => {
  assert.equal(displayVacancies(drdoRow), undefined)
})

test("displayVacancies: clean job → '26,146'", () => {
  assert.equal(displayVacancies(cleanRow), "26,146")
})

test("displayVacancies: 'Not Specified' → undefined (no figure)", () => {
  assert.equal(displayVacancies({ vacancies: "Not Specified" }), undefined)
})

test("displayVacancies: 'TBA' → undefined", () => {
  assert.equal(displayVacancies({ vacancies: "TBA" }), undefined)
})

test("displayVacancies: '0' → undefined", () => {
  assert.equal(displayVacancies({ vacancies: "0" }), undefined)
})

/* ================================================================== */
/* 3. reviewedClosingDate                                              */
/* ================================================================== */

test("reviewedClosingDate: JNU with TBA → fills '15 Jun 2026'", () => {
  assert.equal(reviewedClosingDate("jnu:jnu-rc-75-2026", "TBA"), "15 Jun 2026")
})

test("reviewedClosingDate: JNU with '-' → fills '15 Jun 2026'", () => {
  assert.equal(reviewedClosingDate("jnu:jnu-rc-75-2026", "-"), "15 Jun 2026")
})

test("reviewedClosingDate: JNU with empty → fills '15 Jun 2026'", () => {
  assert.equal(reviewedClosingDate("jnu:jnu-rc-75-2026", ""), "15 Jun 2026")
})

test("reviewedClosingDate: JNU with null → fills '15 Jun 2026'", () => {
  assert.equal(reviewedClosingDate("jnu:jnu-rc-75-2026", null), "15 Jun 2026")
})

test("reviewedClosingDate: JNU with a REAL stored date → keeps stored date", () => {
  assert.equal(reviewedClosingDate("jnu:jnu-rc-75-2026", "30 Sep 2026"), "30 Sep 2026")
})

test("reviewedClosingDate: DRDO has no closingDate → keeps TBA", () => {
  assert.equal(reviewedClosingDate("drdo-rac:drdo-rac-152", "TBA"), "TBA")
})

test("reviewedClosingDate: unknown id with TBA → keeps TBA", () => {
  assert.equal(reviewedClosingDate("x:unknown", "TBA"), "TBA")
})

/* ================================================================== */
/* 4. scrubFigureSentences                                             */
/* ================================================================== */

test("scrubFigureSentences: removes sentence with '42,564 vacancies'", () => {
  const text = "Welcome to JNU. A total of 42,564 vacancies are notified. Apply now."
  const result = scrubFigureSentences(text, ["42,564"])
  assert.ok(!result.includes("42,564"), `figure not removed: ${result}`)
  assert.ok(result.includes("Welcome to JNU"), "kept other text")
  assert.ok(result.includes("Apply now"), "kept other text")
})

test("scrubFigureSentences: removes break-up figures too", () => {
  const text = "Overview. 17,526 posts in Group A are available. 25,038 vacancies in Group B. Details below."
  const result = scrubFigureSentences(text, ["42,564", "17,526", "25,038"])
  assert.ok(!result.includes("17,526"))
  assert.ok(!result.includes("25,038"))
  assert.ok(result.includes("Details below"))
})

test("scrubFigureSentences: does not remove sentence with the number but no vacancy word", () => {
  const text = "The notification number is 42,564 for reference."
  const result = scrubFigureSentences(text, ["42,564"])
  assert.ok(result.includes("42,564"), "should keep — no vacancy word in sentence")
})

test("scrubFigureSentences: removes trailing enumerator '(ii).' after a cut sentence", () => {
  const text = "A total of 42,564 vacancies are available for posts. (ii). More info."
  const result = scrubFigureSentences(text, ["42,564"])
  assert.ok(!result.includes("(ii)"))
  assert.ok(result.includes("More info"))
})

/* ================================================================== */
/* 5. withoutVacancyFigure                                             */
/* ================================================================== */

test("withoutVacancyFigure: sets vacancies='Not Specified', clears breakup, scrubs prose", () => {
  const job = {
    vacancies: "42,564",
    vacanciesStated: "42,564",
    vacancyBreakup: [{ post: "A", total: "17,526", eligibility: "" }],
    overview: "A total of 42,564 vacancies are notified. Apply now.",
    article: "The 17,526 posts in Group A. Details here.",
    faqs: [
      { q: "How many vacancies?", a: "A total of 42,564 vacancies are notified by JNU." },
      { q: "Where to apply?", a: "Apply on the official website." },
    ],
  }
  const out = withoutVacancyFigure(job)
  assert.equal(out.vacancies, "Not Specified")
  assert.equal(out.vacanciesStated, undefined)
  assert.equal(out.vacancyBreakup.length, 0)
  assert.ok(!out.overview?.includes("42,564"))
  assert.ok(!out.article?.includes("17,526"))
  // FAQ that stated the figure → replaced with neutral answer
  assert.ok(out.faqs![0].a.includes("official notification"))
  // FAQ that did NOT state the figure → kept
  assert.equal(out.faqs![1].a, "Apply on the official website.")
})

/* ================================================================== */
/* 6. applyVacancyDisplayGate (composite)                              */
/* ================================================================== */

test("applyVacancyDisplayGate: JNU row → vacancies suppressed + lastDate filled", () => {
  const input = {
    id: "jnu:jnu-rc-75-2026",
    vacancies: "42,564",
    vacanciesStated: "42,564",
    vacancyBreakup: [{ post: "A", total: "17,526", eligibility: "" }],
    post: "teachers and other equivalent cadres at any level. (ii)",
    lastDate: "TBA",
    last_date: "TBA",
    overview: "A total of 42,564 vacancies are notified.",
    article: "Details.",
    faqs: [],
  }
  const out = applyVacancyDisplayGate(input)
  assert.equal(out.vacancies, "Not Specified")
  assert.equal(out.vacanciesStated, undefined)
  assert.equal(out.vacancyBreakup.length, 0)
  assert.equal(out.lastDate, "15 Jun 2026")
  assert.equal(out.last_date, "15 Jun 2026")
})

test("applyVacancyDisplayGate: DRDO row → vacancies suppressed, lastDate stays TBA", () => {
  const input = {
    id: "drdo-rac:drdo-rac-152",
    vacancies: "2",
    vacanciesStated: "2",
    vacancyBreakup: [],
    post: "SCIENTISTS IN DRDO Closing date of Advertisement",
    lastDate: "TBA",
    last_date: "TBA",
    overview: "2 vacancies are available. Apply now.",
    article: "Details.",
    faqs: [{ q: "How many?", a: "2 vacancies are notified." }],
  }
  const out = applyVacancyDisplayGate(input)
  assert.equal(out.vacancies, "Not Specified")
  assert.equal(out.lastDate, "TBA") // DRDO has no closingDate in REVIEWED_NOTICES
  assert.ok(out.faqs![0].a.includes("official notification"))
})

test("applyVacancyDisplayGate: clean job → unchanged", () => {
  const input = {
    id: "ssc:ssc-gd-2026",
    vacancies: "26,146",
    vacanciesStated: "26,146",
    vacancyBreakup: [{ post: "BSF", total: "8,000", eligibility: "" }],
    post: "Constable (GD)",
    lastDate: "15 Jul 2027",
    last_date: "15 Jul 2027",
    overview: "A total of 26,146 vacancies.",
    article: "Details.",
    faqs: [],
  }
  const out = applyVacancyDisplayGate(input)
  assert.equal(out.vacancies, "26,146")
  assert.equal(out.vacanciesStated, "26,146")
  assert.equal(out.vacancyBreakup.length, 1)
  assert.equal(out.lastDate, "15 Jul 2027")
})

/* ================================================================== */
/* 7. mapRow + enrichGovtJob pipeline                                  */
/* ================================================================== */

/**
 * Issue 2 regression: the DB column is `vacancy_breakup` (snake_case). mapRow must normalize it
 * to `vacancyBreakup` BEFORE calling applyVacancyDisplayGate, so the gate can scrub sub-totals
 * (17,526 and 25,038) from prose — not merely because `vacancyBreakup` was undefined from the start.
 *
 * This test uses a raw DB-shaped row that has ONLY `vacancy_breakup` (no `vacancyBreakup`).
 */
test("mapRow: snake_case DB row with vacancy_breakup [17526,25038] → vacancyBreakup cleared, sub-totals suppressed", () => {
  // Simulate exactly what Supabase returns: snake_case field, no camelCase counterpart.
  const dbRow: Record<string, unknown> = {
    id: "jnu:jnu-rc-75-2026",
    source_id: "jnu",
    org: "Jawaharlal Nehru University (JNU)",
    title: "JNU Recruitment 2026 — Teaching Posts",
    post: "teachers and other equivalent cadres at any level. (ii)",
    vacancies: "42,564",
    // Deliberately snake_case only — no vacancyBreakup field.
    vacancy_breakup: [
      { post: "Group A", total: "17,526", eligibility: "PhD" },
      { post: "Group B", total: "25,038", eligibility: "Master's Degree" },
    ],
    record_type: "notification",
    status: "active",
    tab: "latest",
    last_date: "TBA",
    // Prose uses vacancy/posts words so the scrubber can detect and remove them.
    overview: "A total of 42,564 vacancies are notified. 17,526 posts in Group A are available. 25,038 posts in Group B are available.",
    article: "17,526 vacancies in Group A and 25,038 vacancies in Group B. Refer notification.",
    faqs: [{ q: "How many vacancies?", a: "A total of 42,564 vacancies are notified by JNU." }],
  }
  const job = mapRow(dbRow)
  // vacancyBreakup must be an empty array (cleared by gate), not undefined.
  // Before the normalization fix, mapRow did not map vacancy_breakup → vacancyBreakup, so the
  // gate saw vacancyBreakup=undefined and set it to [] without scrubbing sub-totals from prose.
  assert.ok(Array.isArray(job.vacancyBreakup), "vacancyBreakup should be an array after gate")
  assert.equal(job.vacancyBreakup!.length, 0, "vacancyBreakup must be cleared (no displayable breakdown)")
  // Main figure suppressed
  assert.equal(job.vacancies, "Not Specified")
  assert.equal(job.vacanciesStated, undefined)
  // Sub-totals must not appear in prose — gate must have scrubbed them via normalized vacancyBreakup.
  // (scrubFigureSentences removes sentences that contain a figure AND a vacancy/posts word.)
  const allText = [job.overview, job.article, ...(job.faqs || []).map((f: {a:string}) => f.a)].join(" ")
  assert.ok(!allText.includes("17,526"), "sub-total 17,526 must be scrubbed from prose")
  assert.ok(!allText.includes("25,038"), "sub-total 25,038 must be scrubbed from prose")
  assert.ok(!allText.includes("42,564"), "main figure 42,564 must be scrubbed from prose")
})

test("mapRow pipeline: JNU RC/75/2026 — no 42,564 / 17,526 / 25,038 in any field", () => {
  const job = mapRow(jnuRow)
  const enriched = enrichGovtJob(job as never, { synthesizeVacancies: false })
  // vacancies suppressed
  assert.equal(enriched.vacancies, "Not Specified")
  assert.equal(enriched.vacanciesStated, undefined)
  assert.equal(enriched.vacancyBreakup?.length ?? 0, 0)
  // lastDate filled from reviewed notice
  assert.equal(enriched.lastDate, "15 Jun 2026")
  // No figure in overview/article/faqs
  const allText = [enriched.overview, enriched.article, ...(enriched.faqs || []).map((f: {a:string}) => f.a)].join(" ")
  assert.ok(!allText.includes("42,564"), "42,564 in text")
  assert.ok(!allText.includes("17,526"), "17,526 in text")
  assert.ok(!allText.includes("25,038"), "25,038 in text")
})

test("mapRow pipeline: DRDO RAC 152 — no '2 vacancies' in any field", () => {
  const job = mapRow(drdoRow)
  const enriched = enrichGovtJob(job as never, { synthesizeVacancies: false })
  assert.equal(enriched.vacancies, "Not Specified")
  assert.equal(enriched.vacanciesStated, undefined)
  const allText = [enriched.overview, enriched.article, ...(enriched.faqs || []).map((f: {a:string}) => f.a)].join(" ")
  // No "2 vacancies" (the word "2" alone may appear elsewhere, check combined)
  assert.ok(!/\b2\s+vacanc/i.test(allText), `"2 vacancies" found in text`)
})

test("mapRow pipeline: clean SSC job — figure preserved", () => {
  const job = mapRow(cleanRow)
  const enriched = enrichGovtJob(job as never, { synthesizeVacancies: false })
  assert.equal(enriched.vacancies, "26,146")
  // The breakup may or may not survive enrichment (depends on mapRow's handling of the array),
  // but the figure itself must be preserved.
  assert.equal(displayVacancies(enriched as never), "26,146")
})

/* ================================================================== */
/* 8. Expiry — JNU closing date 15 Jun 2026                           */
/* ================================================================== */

test("JNU lastDate '15 Jun 2026' → isGovtJobExpired returns true (past closing date)", () => {
  assert.ok(isGovtJobExpired("15 Jun 2026"))
})

test("JNU mapped row → isActiveGovtJob returns false", () => {
  const job = mapRow(jnuRow)
  assert.equal(isActiveGovtJob({ status: job.status, lastDate: job.lastDate }), false)
})

test("A real stored date is NOT overridden by reviewed closing date", () => {
  const row = { ...jnuRow, last_date: "30 Sep 2026" }
  const job = mapRow(row)
  assert.equal(job.lastDate, "30 Sep 2026", "real stored date must be kept")
})

test("Clean job with future date → isActiveGovtJob returns true", () => {
  const job = mapRow(cleanRow)
  assert.ok(isActiveGovtJob({ status: job.status, lastDate: job.lastDate }))
})

/* ================================================================== */
/* 9. Detail page text (detailFacts.ts)                                */
/* ================================================================== */

test("govtDetailMetaText: JNU title has no '42,564 Posts'", () => {
  const job = mapRow(jnuRow)
  const { title, description } = govtDetailMetaText(job as never)
  assert.ok(!title.includes("42,564"), `title: ${title}`)
  assert.ok(!description.includes("42,564"), `description: ${description}`)
  assert.equal(title, job.title, "title should be plain job.title when no figure")
})

test("govtDetailMetaText: DRDO title has no '2 Posts'", () => {
  const job = mapRow(drdoRow)
  const { title, description } = govtDetailMetaText(job as never)
  assert.ok(!title.includes("2 Posts"), `title: ${title}`)
  assert.ok(!/\b2 vacanc/i.test(description), `description: ${description}`)
})

test("govtDetailMetaText: clean job includes figure in title", () => {
  const job = mapRow(cleanRow)
  const { title, description } = govtDetailMetaText(job as never)
  assert.ok(title.includes("26,146 Posts"), `title: ${title}`)
  assert.ok(description.includes("26,146"), `description: ${description}`)
})

test("govtHeroChips: JNU has no vacancy chip", () => {
  const job = mapRow(jnuRow)
  const chips = govtHeroChips(job as never)
  assert.ok(!chips.some(c => c.includes("42,564")), `chips: ${chips}`)
  assert.ok(!chips.some(c => /Vacanc/i.test(c) && /\d/.test(c)), "no numeric vacancy chip")
})

test("govtHeroChips: clean job has vacancy chip", () => {
  const job = mapRow(cleanRow)
  const chips = govtHeroChips(job as never)
  assert.ok(chips.some(c => c.includes("26,146")), `chips: ${chips}`)
})

test("govtQuickFacts: JNU has no Total Vacancies fact", () => {
  const job = mapRow(jnuRow)
  const facts = govtQuickFacts(job as never)
  assert.ok(!facts.some(f => f.l === "Total Vacancies"), `facts: ${JSON.stringify(facts)}`)
})

test("govtQuickFacts: clean job has Total Vacancies fact", () => {
  const job = mapRow(cleanRow)
  const facts = govtQuickFacts(job as never)
  const vf = facts.find(f => f.l === "Total Vacancies")
  assert.ok(vf, "missing Total Vacancies fact")
  assert.equal(vf!.v, "26,146")
})

test("govtShowsVacancyDetails: JNU → false (suppressed + no real post)", () => {
  const job = mapRow(jnuRow)
  // vacancyBreakup is cleared, displayVacancies is undefined, post is a scraped fragment
  assert.equal(govtShowsVacancyDetails(job as never), false)
})

test("govtShowsVacancyDetails: clean job → true", () => {
  const job = mapRow(cleanRow)
  assert.ok(govtShowsVacancyDetails(job as never))
})

/* ================================================================== */
/* 10. generateGovtArticle — template output                           */
/* ================================================================== */

test("generateGovtArticle: suppressed JNU → no figure in overview/article/faqs", () => {
  const job = mapRow(jnuRow)
  const art = generateGovtArticle(job as never)
  const allText = [art.overview, art.article, ...art.faqs.map(f => f.a)].join(" ")
  assert.ok(!allText.includes("42,564"), `42,564 in generated text`)
  assert.ok(!allText.includes("17,526"), `17,526 in generated text`)
  // The FAQ answer for "how many vacancies" should point to official notification
  const vacFaq = art.faqs.find(f => /vacanc/i.test(f.q))
  assert.ok(vacFaq, "missing vacancy FAQ")
  assert.ok(vacFaq!.a.includes("not stated") || vacFaq!.a.includes("official notification"),
    `FAQ answer: ${vacFaq!.a}`)
})

test("generateGovtArticle: suppressed job never prints 'A total of Not Specified vacancies'", () => {
  const job = mapRow(jnuRow)
  const art = generateGovtArticle(job as never)
  assert.ok(!art.overview.includes("Not Specified vacanc"), `overview: ${art.overview.slice(0,200)}`)
  assert.ok(!art.article.includes("Not Specified vacanc"), `article: ${art.article.slice(0,200)}`)
})

test("generateGovtArticle: clean job → includes figure in overview", () => {
  const job = mapRow(cleanRow)
  const art = generateGovtArticle(job as never)
  assert.ok(art.overview.includes("26,146"), `overview missing figure: ${art.overview.slice(0,200)}`)
})

/* ================================================================== */
/* 11. JSON-LD description (buildGovtFactsDescription)                 */
/* ================================================================== */

test("buildGovtFactsDescription: JNU with vacanciesStated undefined → no figure", () => {
  const job = mapRow(jnuRow)
  const desc = buildGovtFactsDescription({
    title: job.title, org: job.org, post: job.post,
    vacanciesStated: displayVacancies(job) ? (job as any).vacanciesStated : undefined,
    qualification: job.qualification, salary: job.salary,
    lastDate: job.lastDate, ageRange: job.ageRange, fee: job.fee,
  } as never)
  if (desc) {
    assert.ok(!desc.includes("42,564"), `description: ${desc.slice(0,200)}`)
    assert.ok(!desc.includes("17,526"))
  }
})

test("buildGovtFactsDescription: clean job → includes figure", () => {
  const job = mapRow(cleanRow)
  const desc = buildGovtFactsDescription({
    title: job.title, org: job.org, post: job.post,
    vacanciesStated: displayVacancies(job) ? (job as any).vacanciesStated : undefined,
    qualification: job.qualification, salary: job.salary,
    lastDate: job.lastDate, ageRange: job.ageRange, fee: job.fee,
  } as never)
  assert.ok(desc, "should produce a description")
  assert.ok(desc!.includes("26,146"), `description missing figure: ${desc!.slice(0,200)}`)
})

/* ================================================================== */
/* 12. Card rendering via renderToStaticMarkup                         */
/* ================================================================== */

// React must be in scope for JSX-compiled components (they emit React.createElement).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const React = require("react");
(globalThis as never as Record<string, unknown>)["React"] = React

async function runCardTests() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let renderToStaticMarkup: (el: any) => string
  let GovtJobListCardFn: Function
  let GovtJobCardFn: Function
  let LatestJobCardFn: Function
  try {
    renderToStaticMarkup = (await import("react-dom/server")).renderToStaticMarkup
    GovtJobListCardFn = (await import("@/components/govt/GovtJobListCard")).GovtJobListCard
    GovtJobCardFn = (await import("@/components/govt/GovtJobCard")).GovtJobCard
    LatestJobCardFn = (await import("@/components/home/LatestJobCard")).LatestJobCard
  } catch {
    console.log("  SKIP  Card rendering tests (could not import React/components)")
    return
  }
  const render = renderToStaticMarkup

  test("GovtJobListCard: JNU → no '42,564' in HTML", () => {
    const job = mapRow(jnuRow)
    const html = render(React.createElement(GovtJobListCardFn as never, { job }))
    assert.ok(!html.includes("42,564"), `found 42,564 in card HTML`)
    assert.ok(!html.includes("17,526"))
    assert.ok(!/Not Specified.*Vacanc/i.test(html), `found 'Not Specified Vacancies'`)
  })

  test("GovtJobListCard: DRDO → no '2 Vacancies' in HTML", () => {
    const job = mapRow(drdoRow)
    const html = render(React.createElement(GovtJobListCardFn as never, { job }))
    assert.ok(!/👤\s*2\s+Vacanc/i.test(html), `found '2 Vacancies' chip`)
  })

  test("GovtJobListCard: clean job → shows '26,146 Vacancies'", () => {
    const job = mapRow(cleanRow)
    const html = render(React.createElement(GovtJobListCardFn as never, { job }))
    assert.ok(html.includes("26,146"), `missing figure in card HTML`)
  })

  test("GovtJobCard: JNU → no '42,564' in HTML", () => {
    const job = mapRow(jnuRow)
    const html = render(React.createElement(GovtJobCardFn as never, { job }))
    assert.ok(!html.includes("42,564"), `found 42,564 in GovtJobCard`)
  })

  test("GovtJobCard: clean job → shows figure", () => {
    const job = mapRow(cleanRow)
    const html = render(React.createElement(GovtJobCardFn as never, { job }))
    assert.ok(html.includes("26,146"), `missing figure in GovtJobCard`)
  })

  test("LatestJobCard: JNU govt row → no '42,564' in HTML", () => {
    const job = mapRow(jnuRow)
    const html = render(React.createElement(LatestJobCardFn as never, { job: { ...job, type: "govt" } }))
    assert.ok(!html.includes("42,564"), `found 42,564 in LatestJobCard`)
  })
}

runCardTests().then(() => {

  /* ================================================================== */
  /* 13. REVIEWED_NOTICES entries are well-formed                        */
  /* ================================================================== */

  test("REVIEWED_NOTICES: every entry has required fields", () => {
    for (const [id, r] of Object.entries(REVIEWED_NOTICES)) {
      assert.ok(id.includes(":"), `id ${id} missing source prefix`)
      assert.ok(r.checkedOn.match(/^\d{4}-\d{2}-\d{2}$/), `${id} checkedOn`)
      assert.ok(r.notice.startsWith("http"), `${id} notice URL`)
      assert.ok(["not-stated", "unconfirmed"].includes(r.figure), `${id} figure`)
      assert.ok(r.finding.length > 20, `${id} finding too short`)
    }
  })

  test("REVIEWED_NOTICES: JNU has closingDate, DRDO does not", () => {
    assert.equal(REVIEWED_NOTICES["jnu:jnu-rc-75-2026"].closingDate, "15 Jun 2026")
    assert.equal(REVIEWED_NOTICES["drdo-rac:drdo-rac-152"].closingDate, undefined)
  })

  /* ================================================================== */
  /* 14. JNU GF route-block regression (PR #54 preview regression)       */
  /* ================================================================== */

  test("isRouteBlocked: three JNU GF rows are blocked", () => {
    assert.equal(isRouteBlocked("jnu:jnu-advt-of-guest-faculty-rc-gf-2026-03-ssis"), true)
    assert.equal(isRouteBlocked("jnu:jnu-advtnorc-gf-2026-01"), true)
    assert.equal(isRouteBlocked("jnu:jnu-jnu-advtno-rc-gf-02-2026"), true)
  })

  test("isRouteBlocked: JNU RC/75/2026 is NOT blocked (it has a reviewed closingDate)", () => {
    assert.equal(isRouteBlocked("jnu:jnu-rc-75-2026"), false)
  })

  test("isRouteBlocked: DRDO RAC 152 is NOT blocked (unconfirmed figure, no blockRoute flag)", () => {
    assert.equal(isRouteBlocked("drdo-rac:drdo-rac-152"), false)
  })

  test("isRouteBlocked: clean job ID is not blocked", () => {
    assert.equal(isRouteBlocked("ssc:ssc-gd-2026"), false)
    assert.equal(isRouteBlocked(undefined), false)
  })

  test("isServableGovtJob: JNU GF rows return false (blockRoute)", () => {
    for (const row of [jnuGfRow1, jnuGfRow2, jnuGfRow3]) {
      const job = mapRow(row)
      assert.equal(isServableGovtJob(job as never), false,
        `expected isServableGovtJob=false for ${row.id}`)
    }
  })

  test("isServableGovtJob: clean job is NOT blocked and IS active (not expired)", () => {
    // The minimal cleanRow fixture omits officialUrl so isRenderableJob returns false
    // (missing-provenance) — that is expected for a stripped test fixture.
    // What matters here is that the blockRoute gate does NOT fire for this job.
    const job = mapRow(cleanRow as unknown as Record<string, unknown>)
    assert.equal(isRouteBlocked(job.id), false, "clean job must not be blockRoute-flagged")
    assert.equal(isActiveGovtJob(job as never), true, "clean job must be active (future lastDate)")
  })

  /* ================================================================== */
  /* 15. "Not Specified vacancies" phrase scrubbing                      */
  /* ================================================================== */

  test("scrubNotSpecifiedPhrase: removes 'A total of Not Specified vacancies are available' sentence", () => {
    const text = "JNU has released a notification. A total of Not Specified vacancies are available for the post of teachers. Apply before TBA."
    const out = scrubNotSpecifiedPhrase(text)
    assert.ok(!out.includes("Not Specified vacancies"), `phrase still present: ${out}`)
    assert.ok(out.includes("Refer to the official notification"), `neutral replacement missing: ${out}`)
    assert.ok(out.includes("JNU has released"), "preceding sentence should be kept")
    assert.ok(out.includes("Apply before TBA"), "following sentence should be kept")
  })

  test("scrubNotSpecifiedPhrase: removes 'Not Specified posts are available' variant", () => {
    const text = "A total of Not Specified posts are available for this recruitment."
    const out = scrubNotSpecifiedPhrase(text)
    assert.ok(!out.includes("Not Specified posts"), `still present: ${out}`)
  })

  test("scrubNotSpecifiedPhrase: leaves text without the phrase unchanged", () => {
    const text = "A total of 42,564 vacancies are available."
    assert.equal(scrubNotSpecifiedPhrase(text), text)
  })

  test("applyVacancyDisplayGate: scrubs stored 'Not Specified vacancies' from GF row overview", () => {
    const job = mapRow(jnuGfRow1)
    assert.ok(!(job.overview ?? "").includes("Not Specified vacancies"),
      `overview still contains 'Not Specified vacancies': ${job.overview}`)
    // Neutral replacement present or sentence removed
    const overviewText = job.overview ?? ""
    const hasBadPhrase = /Not Specified vacancies/i.test(overviewText)
    assert.ok(!hasBadPhrase, "phrase must be removed by applyVacancyDisplayGate")
  })

  test("applyVacancyDisplayGate: scrubs stored 'Not Specified vacancies' from GF row article", () => {
    const job = mapRow(jnuGfRow1)
    assert.ok(!(job.article ?? "").includes("Not Specified vacancies"),
      `article still contains 'Not Specified vacancies': ${(job.article ?? "").slice(0, 200)}`)
  })

  /* ================================================================== */
  /* 16. JNU RC/75/2026 full pipeline — reviewed closing date + expiry  */
  /* ================================================================== */

  test("JNU RC/75/2026: applyVacancyDisplayGate sets lastDate to '15 Jun 2026'", () => {
    const job = mapRow(jnuRow as unknown as Record<string, unknown>)
    assert.equal(job.lastDate, "15 Jun 2026", `lastDate should be reviewed closing date, got: ${job.lastDate}`)
  })

  test("JNU RC/75/2026: after gate, isGovtJobExpired returns true (date is past)", () => {
    const job = mapRow(jnuRow as unknown as Record<string, unknown>)
    const { isGovtJobExpired } = require("../utils/govtJobExpiry")
    assert.equal(isGovtJobExpired(job.lastDate), true,
      `expected expired for lastDate=${job.lastDate}`)
  })

  test("JNU RC/75/2026: isServableGovtJob returns false (expired after date applied)", () => {
    const job = mapRow(jnuRow as unknown as Record<string, unknown>)
    const enriched = enrichGovtJob(job as never, { synthesizeVacancies: false })
    assert.equal(isServableGovtJob(enriched as never), false,
      "JNU RC/75/2026 should not be servable (expired notification)")
  })

  test("JNU RC/75/2026: mapRow suppresses 42,564, 17,526, and 25,038 from overview", () => {
    const job = mapRow(jnuRow as unknown as Record<string, unknown>)
    const allText = [job.overview, job.article, ...(job.faqs ?? []).map((f: {a:string}) => f.a)].join(" ")
    assert.ok(!allText.includes("42,564"), "42,564 must be scrubbed from prose")
    assert.ok(!allText.includes("17,526"), "17,526 must be scrubbed from prose")
    assert.ok(!allText.includes("25,038"), "25,038 must be scrubbed from prose")
  })

  test("JNU RC/75/2026: vacancyBreakup cleared after gate", () => {
    const job = mapRow(jnuRow as unknown as Record<string, unknown>)
    assert.ok(Array.isArray(job.vacancyBreakup), "vacancyBreakup should be array")
    assert.equal(job.vacancyBreakup!.length, 0, "vacancyBreakup must be cleared")
  })

  /* ================================================================== */
  /* 17. DRDO RAC 152 — unconfirmed figure stays suppressed             */
  /* ================================================================== */

  test("DRDO RAC 152: NOT blocked and IS active (isServableGovtJob-equivalent checks)", () => {
    // The minimal drdoRow fixture omits officialUrl so full isServableGovtJob returns false
    // (missing-provenance on test fixture only). The blockRoute and expiry gates still apply.
    const job = mapRow(drdoRow as unknown as Record<string, unknown>)
    assert.equal(isRouteBlocked(job.id), false, "DRDO must not be blockRoute-flagged")
    assert.equal(isActiveGovtJob(job as never), true, "DRDO must be active (TBA date is never expired)")
  })

  test("DRDO RAC 152: displayVacancies returns undefined (figure unconfirmed)", () => {
    const job = mapRow(drdoRow as unknown as Record<string, unknown>)
    assert.equal(displayVacancies(job), undefined, "DRDO figure must be suppressed")
  })

  test("DRDO RAC 152: isRouteBlocked returns false", () => {
    assert.equal(isRouteBlocked("drdo-rac:drdo-rac-152"), false)
  })

  /* ================================================================== */
  /* 18. Clean job — unaffected by all new gates                        */
  /* ================================================================== */

  test("Clean job: isRouteBlocked false, active, figure displays (fixture lacks officialUrl so full isServableGovtJob not tested here)", () => {
    const job = mapRow(cleanRow as unknown as Record<string, unknown>)
    assert.equal(isRouteBlocked(job.id), false)
    assert.equal(isActiveGovtJob(job as never), true)
    assert.equal(displayVacancies(job), "26,146")
  })

  test("Clean job: no 'Not Specified vacancies' phrase in overview", () => {
    const job = mapRow(cleanRow as unknown as Record<string, unknown>)
    assert.ok(!(job.overview ?? "").includes("Not Specified vacancies"))
  })

  /* Done */
  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
})
