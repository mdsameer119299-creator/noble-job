/**
 * govtLifecycleCopy.test.ts — REGRESSION for the "apply online" CTA shown on
 * decided/closed-stage govt records (result / admit card / answer key),
 * found during PR#47 preview verification.
 *
 * Observed on the deployed preview: the Railway NTPC Level 2-6 RESULT page
 * (record_type/tab = "results") rendered a "How to Apply Online" section
 * with a button literally labelled "Apply Online on Official Portal →", a
 * full generic apply flow ("create a login ID", "pay the application fee",
 * "submit before the last date"), and a secondary "Apply Online" link in
 * Important Links / Quick Links — none of which makes sense once a result
 * has been published; the application window for that notification is
 * already over.
 *
 * Root cause, across three files:
 *   - govtOfficialLinks.ts: buildGovtJobLinkButtons() always added a generic
 *     "Apply Online" link regardless of tab.
 *   - govtArticle.ts: buildHowToApply()/buildFaqs()/generateGovtArticle()'s
 *     overview were one-size-fits-all, assuming every record is an open
 *     recruitment.
 *   - GovtHowToApply.tsx: hardcoded the heading ("How to Apply Online") and
 *     button text ("Apply Online on Official Portal →") regardless of which
 *     link was actually resolved, and always set intercept=true even though
 *     GovtApplyLinkButton's own doc comment says only the genuine "Apply
 *     Online" primary link should open the save-resume interceptor.
 *
 *   npm run test:govt-lifecycle-copy
 *
 * Pure, dependency-free: exercises only govtOfficialLinks.ts + govtArticle.ts
 * (no React, no I/O) — GovtHowToApply.tsx itself is a 'use client' component
 * and is covered by the manual preview check, not here.
 */
import assert from "node:assert/strict"
import { buildGovtJobLinkButtons, isPostApplicationTab } from "./govtOfficialLinks"
import { getGovtHowToApplySteps, generateGovtArticle } from "./govtArticle"
import type { GovtJob } from "@/types/govtJob"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}

// Shaped like the actual Railway NTPC result row found on the preview.
const resultJob: Partial<GovtJob> = {
  id: "railway-ntpc-result",
  org: "RRB",
  title: "Railway NTPC Level 2-6 Result 2025",
  post: "Non-Technical Graduate Posts",
  vacancies: "11,558",
  tab: "results",
  recordType: "result",
  lastDate: "-",
  officialUrl: "https://indianrailways.gov.in/",
}

const admitJob: Partial<GovtJob> = { ...resultJob, id: "x-admit", tab: "admit", recordType: "admit_card", title: "RRB NTPC Admit Card 2026" }
const answerJob: Partial<GovtJob> = { ...resultJob, id: "x-answer", tab: "answer", recordType: "answer_key", title: "RRB NTPC Answer Key 2026" }
const openJob: Partial<GovtJob> = { ...resultJob, id: "x-open", tab: "latest", recordType: "notification", title: "RRB NTPC 2026 Notification", lastDate: "30 Nov 2026" }

test("isPostApplicationTab — results/admit/answer are post-application; latest/upcoming are not", () => {
  assert.equal(isPostApplicationTab("results"), true)
  assert.equal(isPostApplicationTab("admit"), true)
  assert.equal(isPostApplicationTab("answer"), true)
  assert.equal(isPostApplicationTab("latest"), false)
  assert.equal(isPostApplicationTab("upcoming"), false)
})

test("REGRESSION — a RESULT record never gets a generic 'Apply Online' link", () => {
  const links = buildGovtJobLinkButtons(resultJob)
  assert.ok(!links.some(l => l.l === "Apply Online"), `found an Apply Online link: ${JSON.stringify(links)}`)
  assert.ok(links.some(l => l.l === "Check Result" && l.primary), "missing the primary Check Result link")
})

test("REGRESSION — ADMIT CARD / ANSWER KEY records never get a generic 'Apply Online' link either", () => {
  assert.ok(!buildGovtJobLinkButtons(admitJob).some(l => l.l === "Apply Online"))
  assert.ok(!buildGovtJobLinkButtons(answerJob).some(l => l.l === "Apply Online"))
})

test("sanity — an OPEN recruitment (latest/upcoming) still gets its primary Apply Online link", () => {
  const links = buildGovtJobLinkButtons(openJob)
  assert.ok(links.some(l => l.l === "Apply Online" && l.primary))
})

test("REGRESSION — a RESULT record's how-to-apply steps never mention registering, paying a fee, or a last date to apply", () => {
  const steps = getGovtHowToApplySteps(resultJob).join(" ")
  assert.doesNotMatch(steps, /apply online|application fee|new registration|submit the form/i, steps)
  assert.match(steps, /result/i, "should still give result-appropriate steps")
})

test("REGRESSION — ADMIT CARD / ANSWER KEY steps are also stage-appropriate, not the generic apply flow", () => {
  const admitSteps = getGovtHowToApplySteps(admitJob).join(" ")
  assert.doesNotMatch(admitSteps, /application fee|new registration/i, admitSteps)
  assert.match(admitSteps, /admit card/i)

  const answerSteps = getGovtHowToApplySteps(answerJob).join(" ")
  assert.doesNotMatch(answerSteps, /application fee|new registration/i, answerSteps)
  assert.match(answerSteps, /answer key/i)
})

test("sanity — an OPEN recruitment still gets the full apply flow (registration, fee, last date)", () => {
  const steps = getGovtHowToApplySteps(openJob).join(" ")
  assert.match(steps, /new registration/i)
})

test("REGRESSION — a RESULT record's generated overview never claims an open 'apply online before' deadline", () => {
  const { overview } = generateGovtArticle(resultJob)
  assert.doesNotMatch(overview, /apply online before/i, overview)
})

test("REGRESSION — a RESULT record's generated FAQs never ask/answer 'last date to apply' or 'how to apply online'", () => {
  const { faqs } = generateGovtArticle(resultJob)
  const text = faqs.map(f => `${f.q} ${f.a}`).join(" ")
  assert.doesNotMatch(text, /last date to apply|apply online for/i, text)
})

test("sanity — an OPEN recruitment's generated overview and FAQs are unchanged (still invite applying)", () => {
  const { overview, faqs } = generateGovtArticle(openJob)
  assert.match(overview, /apply online before/i)
  assert.ok(faqs.some(f => /last date to apply/i.test(f.q)))
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
