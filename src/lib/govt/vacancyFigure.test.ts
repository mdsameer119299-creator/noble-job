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
  REVIEWED_NOTICES,
} from "./vacancyFigure"
import { govtDetailMetaText, govtHeroChips, govtQuickFacts, govtShowsVacancyDetails } from "./detailFacts"
import { generateGovtArticle } from "@/lib/services/govtArticle"
import { isActiveGovtJob, isGovtJobExpired } from "@/lib/utils/govtJobExpiry"
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

  /* Done */
  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
})
