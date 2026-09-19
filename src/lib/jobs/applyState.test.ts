/**
 * applyState.test.ts — the HONEST APPLICATION-STATE MODEL.
 *
 *   npm run test:apply-state
 *
 * A candidate is never told an application is sent / stored for an employer that will
 * never receive it. Four kinds of job, four honest experiences:
 *   1. employer-delivered   → NobleJob Apply flow; the application reaches the employer.
 *   2. genuine external URL → an Apply link to the source; NobleJob does not pretend to
 *                             receive it; directApply false.
 *   3. aggregated, no employer + no external URL → NO Apply action, no "sent / stored"
 *                             copy, no JobPosting, and (if it stays visible) labelled an
 *                             information-only listing — in practice excluded from the
 *                             candidate inventory. Records are never deleted.
 *   4. talent / resume registration → never presented as applying to a vacancy.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import * as React from "react"
import {
  applyRouteFor,
  applyStateFor,
  CLOSED_APPLY_NOTE,
  DIRECT_APPLY_FLOW,
  externalApplyUrl,
  isDirectApply,
  isJobPostingRoute,
  LISTING_ONLY_NOTE,
  SAMPLE_APPLY_NOTE,
  TALENT_REGISTRATION,
} from "./applyRoute"
import { applicationTargetVerdict, NO_EMPLOYER_MESSAGE } from "./applicationTarget"
import { checkJobRecord, filterRenderable, isActionableJob, isRenderableJob } from "./renderable"
import { buildAbroadJobPosting, buildPrivateJobPosting, buildWfhJobPosting } from "../seo/jobPostingBuilders"
import { buildJobContent } from "../seo/jobContent"
import { isDeliveredToEmployer, NOT_SENT_NOTE } from "../utils/applicationDisplay"
import type { Job } from "@/types/job"
import type { WfhJob } from "@/types/wfhJob"
import type { AbroadJob } from "@/types/abroadJob"

// The JSX runtime under plain `tsx` is the classic one (Next supplies its own at build time).
;(globalThis as { React?: unknown }).React = React

let passed = 0
let failed = 0
const pending: Promise<unknown>[] = []
function test(name: string, fn: () => void | Promise<void>) {
  pending.push(
    Promise.resolve()
      .then(fn)
      .then(() => { passed++; console.log(`  PASS  ${name}`) })
      .catch(err => { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }),
  )
}
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8")
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
type Obj = Record<string, unknown>
const asObj = (v: unknown) => v as Obj

const SOURCE = "2026-08-01T05:30:00.000Z"
const DESC =
  "We are looking for an Accounts Executive to maintain the company ledgers in Tally and reconcile vendor and bank statements every month.\n\n" +
  "The role reports to the finance manager and handles GST filing support, invoice processing and monthly closing for our Delhi office."
const REAL_URL = "https://careers.gulfbuild.org/apply/1"
const EMPLOYER_UUID = "3f2a9b6e-1111-4c2d-8a10-0a1b2c3d4e5f"

/* ─────────────── fixtures: one per application state ─────────────── */

// 1. employer-delivered (EMPLOYER provenance + owning employer)
const employerPrivate = (over: Obj = {}) =>
  ({
    id: EMPLOYER_UUID, title: "Accounts Executive", company: "Acme Pvt Ltd", logo: "AC", color: "#000", location: "Delhi", type: "Full Time",
    exp: "2 years", salary: "₹25,000 - ₹35,000 per month", cat: "Accounting", skills: ["Tally"], jobStatus: "LIVE_JOB", provenance: "EMPLOYER",
    employer_id: "emp-1", applyUrl: "", desc: DESC, posted: "", verified: true, source: "employer", board: "private", source_posted_at: SOURCE, ...over,
  }) as unknown as Job
const employerWfh = (over: Obj = {}) =>
  ({
    id: "9c1f0000-2222-4c2d-8a10-0a1b2c3d4e5f", title: "Customer Support", company: "Remote Co", logo: "RC", type: "Full-Time Remote", experience: "Fresher",
    salary: "₹20,000 per month", cat: "Support", qualification: "Graduate", source_posted_at: SOURCE, applicant_country: "IN",
    description: DESC.replace("Accounts Executive", "Support Agent") + " This is a fully remote position open to candidates based in India.",
    provenance: "EMPLOYER", employer_id: "emp-1", source: "employer", status: "active", ...over,
  }) as unknown as WfhJob
// 2. external source with a genuine application URL (aggregated feed)
const externalPrivate = (over: Obj = {}) => employerPrivate({ provenance: "AGGREGATED", employer_id: undefined, source: "himalayas", applyUrl: REAL_URL, verified: false, ...over })
const externalWfh = (over: Obj = {}) => employerWfh({ provenance: "AGGREGATED", employer_id: undefined, source: "himalayas", apply_url: REAL_URL, ...over })
const externalAbroad = (over: Obj = {}) =>
  ({
    id: "abroad-1", title: "Electrician", company: "Gulf Build LLC", logo: "GB", country: "UAE", location: "Dubai", type: "Full Time", salary: "AED 2,500 per month",
    experience: "3 years", category: "Construction", apply_url: REAL_URL, source_posted_at: SOURCE, description: DESC.replace("Accounts Executive", "Electrician"),
    provenance: "AGGREGATED", source: "himalayas", status: "active", ...over,
  }) as unknown as AbroadJob
// 3. aggregated job with NO employer and NO genuine external destination (the P1 case)
const deadEndPrivate = (url: string) => employerPrivate({ provenance: "AGGREGATED", employer_id: undefined, source: "himalayas", applyUrl: url, verified: false })
const deadEndWfh = (url: string) => employerWfh({ provenance: "AGGREGATED", employer_id: undefined, source: "himalayas", apply_url: url })
const deadEndAbroad = (url: string) => externalAbroad({ apply_url: url })
const DEAD_END_URLS = ["", "#", "   ", "https://example.com/jobs/1", "javascript:void(0)", "mailto:hr@x.org"]

const content = (j: { title: string; company: string; location?: string }, board: "private" | "wfh" | "abroad") =>
  buildJobContent({ board, title: j.title, company: j.company, location: j.location } as never)
// Affirmative "your application was sent / stored / received" claims (a negation such as "is not sent to any employer" is honest).
const MISLEADING = /(?<!not )\b(sent to|stored|saved on|stays on|is submitted|has been submitted|received by)\b/i

/* ═════════════ 1. employer-delivered job → a valid Apply route ═════════════ */

test("employer-delivered job → the NobleJob 'Apply Now' state, route 'employer', on every board", () => {
  for (const [board, rec] of [["private", employerPrivate()], ["wfh", employerWfh()], ["abroad", externalAbroad({ provenance: "EMPLOYER", employer_id: "emp-1", source: "employer" })]] as const) {
    const s = applyStateFor(board, rec as never, "Acme Pvt Ltd")
    assert.equal(s.kind, "employer", board)
    assert.equal(s.route, "employer", board)
    assert.equal(s.cta, "Apply Now →", board)
    assert.equal(s.href, undefined, "the on-site flow has no external href")
  }
})
test("employer state: the copy says the application is sent to THAT employer through NobleJob (true, because the API delivers it)", () => {
  const s = applyStateFor("private", employerPrivate(), "Acme Pvt Ltd")
  assert.match(s.note, /sent to Acme Pvt Ltd through Noble Job/)
  assert.match(applyStateFor("private", employerPrivate()).note, /sent to the employer through Noble Job/)
})
test("employer-delivered application: the API accepts it, addressed to the OWNING employer", () => {
  const v = applicationTargetVerdict({ board: "private", sample: false, row: { employer_id: "emp-1", status: "active" } })
  assert.deepEqual(v, { ok: true, employerId: "emp-1" })
  for (const board of ["wfh", "abroad"] as const) {
    assert.equal(applicationTargetVerdict({ board, sample: false, row: { employer_id: "emp-9", status: "active" } }).ok, true, board)
  }
})
test("an employer job that is CLOSED shows no Apply action, and the API refuses it too", () => {
  for (const over of [{ status: "closed" }, { jobStatus: "ARCHIVED_JOB" }, { application_deadline: "2020-01-01T00:00:00Z" }]) {
    const s = applyStateFor("private", employerPrivate(over), "Acme")
    assert.equal(s.kind, "closed", JSON.stringify(over))
    assert.equal(s.cta, null)
    assert.equal(s.note, CLOSED_APPLY_NOTE)
  }
  const v = applicationTargetVerdict({ board: "private", sample: false, row: { employer_id: "emp-1", status: "paused" } })
  assert.equal(v.ok, false)
  assert.equal(!v.ok && v.reason, "closed")
})

/* ═════════════ 2. genuine external URL → an external Apply route ═════════════ */

test("aggregated / curated job with a genuine URL → 'external': a link to THAT URL, never an on-site application", () => {
  for (const [board, rec] of [
    ["private", externalPrivate()],
    ["private", externalPrivate({ provenance: "CURATED", source: "curated by editorial" })],
    ["wfh", externalWfh()],
    ["abroad", externalAbroad()],
  ] as const) {
    const s = applyStateFor(board, rec as never, "Someone Ltd")
    assert.equal(s.kind, "external", `${board}/${asObj(rec).provenance}`)
    assert.equal(s.route, "external")
    assert.equal(s.href, REAL_URL)
    assert.ok(s.cta && !/apply now/i.test(s.cta), "not the NobleJob 'Apply Now' button")
    assert.equal(externalApplyUrl(rec as never), REAL_URL)
  }
})
test("external state is honest: it says you are LEAVING NobleJob and that NobleJob does not receive the application", () => {
  const s = applyStateFor("private", externalPrivate(), "Acme")
  assert.match(s.note, /leave Noble Job/)
  assert.match(s.note, /does not receive or forward/)
  assert.doesNotMatch(s.note, MISLEADING)
})
test("external → directApply FALSE everywhere (an off-site redirect is never direct apply)", () => {
  assert.equal(applyStateFor("private", externalPrivate(), "A").directApply, false)
  assert.equal(applyStateFor("wfh", externalWfh(), "A").directApply, false)
  assert.equal(applyStateFor("abroad", externalAbroad(), "A").directApply, false)
  const p = asObj(buildAbroadJobPosting(externalAbroad(), content(externalAbroad() as never, "abroad")))
  assert.equal(p.directApply, false, "the abroad external JobPosting is directApply:false")
})
test("an external job is NOT sent through /api/applications: the on-site form is unreachable (no employer → 422)", () => {
  const v = applicationTargetVerdict({ board: "private", sample: false, row: { employer_id: null, status: "active" } })
  assert.equal(v.ok, false)
  assert.equal(!v.ok && v.status, 422)
  assert.equal(!v.ok && v.error, NO_EMPLOYER_MESSAGE)
})
test("rendered Apply control for an external job is an <a href> to the source — target=_blank, noopener, nofollow — and NO button / form", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server")
  const { ApplyButton } = await import("../../components/jobs/ApplyButton")
  const html = renderToStaticMarkup(React.createElement(ApplyButton, { jobId: "x", state: applyStateFor("private", externalPrivate(), "Acme") }))
  assert.match(html, new RegExp(`<a href="${REAL_URL.replace(/[/.]/g, "\\$&")}" target="_blank" rel="noopener noreferrer nofollow"`))
  assert.doesNotMatch(html, /<button/)
  assert.doesNotMatch(html, /Apply Now/)
  assert.doesNotMatch(html, MISLEADING)
})

/* ═════════════ 3. aggregated, no employer, no external URL → NO misleading Apply ═════════════ */

test("dead end (aggregated, no employer, placeholder / missing URL) → route 'none', state 'listing': NO Apply action", () => {
  for (const url of DEAD_END_URLS) {
    for (const [board, rec] of [["private", deadEndPrivate(url)], ["wfh", deadEndWfh(url)], ["abroad", deadEndAbroad(url)]] as const) {
      assert.equal(applyRouteFor(board, rec as never), "none", `${board} ${JSON.stringify(url)}`)
      const s = applyStateFor(board, rec as never, "Acme")
      assert.equal(s.kind, "listing", `${board} ${JSON.stringify(url)}`)
      assert.equal(s.cta, null, "no button label → no Apply action")
      assert.equal(s.href, undefined)
      assert.equal(s.directApply, false)
      assert.equal(s.note, LISTING_ONLY_NOTE)
    }
  }
})
test("dead end: the copy never says the application is sent / stored / saved for the employer", () => {
  assert.doesNotMatch(LISTING_ONLY_NOTE, MISLEADING)
  assert.doesNotMatch(LISTING_ONLY_NOTE, /apply now/i)
  assert.match(LISTING_ONLY_NOTE, /Information only/)
  assert.match(LISTING_ONLY_NOTE, /no application link/)
})
test("rendered control for a dead end has NO button, NO apply link, NO application modal — only an information-only label", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server")
  const { ApplyButton } = await import("../../components/jobs/ApplyButton")
  const html = renderToStaticMarkup(React.createElement(ApplyButton, { jobId: "x", state: applyStateFor("private", deadEndPrivate(""), "Acme") }))
  assert.doesNotMatch(html, /<button/)
  assert.doesNotMatch(html, /Apply Now/i)
  assert.doesNotMatch(html, /target="_blank"/)
  assert.doesNotMatch(html, MISLEADING)
  assert.match(html, /Information only/)
  // The only link is the SEPARATE, labelled profile registration — not an application.
  assert.deepEqual([...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]), [TALENT_REGISTRATION.href])
})
test("dead end: excluded from the candidate-facing inventory (not renderable → not listed, counted, related, sitemapped; direct URL 404s)", () => {
  for (const url of DEAD_END_URLS) {
    for (const [board, rec] of [["private", deadEndPrivate(url)], ["wfh", deadEndWfh(url)], ["abroad", deadEndAbroad(url)]] as const) {
      const verdict = checkJobRecord(rec as never, board)
      assert.equal(verdict.renderable, false, `${board} ${JSON.stringify(url)}`)
      assert.ok(verdict.reasons.includes("no-application-route"), verdict.reasons.join(","))
      assert.equal(isActionableJob(rec as never, board), false)
    }
  }
  const mixed = [employerWfh(), externalWfh(), deadEndWfh(""), deadEndWfh("#")] as never[]
  assert.equal(filterRenderable(mixed, "wfh").length, 2, "only the two with a genuine route remain")
  // an 'employer' job that no employer owns is the same dead end
  assert.equal(isRenderableJob(employerPrivate({ employer_id: undefined }), "private"), false)
})
test("dead end: NO JobPosting on any board (with or without a URL)", () => {
  for (const url of DEAD_END_URLS) {
    const p = deadEndPrivate(url), w = deadEndWfh(url), a = deadEndAbroad(url)
    assert.equal(buildPrivateJobPosting(p, content(p, "private")), null, `private ${JSON.stringify(url)}`)
    assert.equal(buildWfhJobPosting(w, content(w as never, "wfh")), null, `wfh ${JSON.stringify(url)}`)
    assert.equal(buildAbroadJobPosting(a, content(a as never, "abroad")), null, `abroad ${JSON.stringify(url)}`)
  }
})
test("no-employer aggregated private / WFH job → no JobPosting EVEN WITH a real external URL (structured data is not widened)", () => {
  const p = externalPrivate(), w = externalWfh()
  assert.equal(buildPrivateJobPosting(p, content(p, "private")), null)
  assert.equal(buildWfhJobPosting(w, content(w as never, "wfh")), null)
  assert.equal(isJobPostingRoute("private", p, applyRouteFor("private", p)), false)
  assert.equal(isJobPostingRoute("wfh", w, applyRouteFor("wfh", w as never)), false)
  // …while the employer-delivered ones keep theirs (directApply true).
  assert.equal(asObj(buildPrivateJobPosting(employerPrivate(), content(employerPrivate(), "private"))).directApply, true)
  assert.equal(asObj(buildWfhJobPosting(employerWfh(), content(employerWfh() as never, "wfh"))).directApply, true)
})
test("no ownerless application can be created: the API refuses an unknown job, an unowned job, a sample and a government job", () => {
  const no = (input: Parameters<typeof applicationTargetVerdict>[0]) => {
    const v = applicationTargetVerdict(input)
    assert.equal(v.ok, false)
    assert.equal(!v.ok && v.status, 422)
    return !v.ok ? v.reason : ""
  }
  assert.equal(no({ board: "private", sample: false, row: null }), "unknown-job")
  assert.equal(no({ board: "wfh", sample: false, row: undefined }), "unknown-job")
  assert.equal(no({ board: "private", sample: false, row: { employer_id: null, status: "active" } }), "no-employer")
  assert.equal(no({ board: "abroad", sample: false, row: { employer_id: "  ", status: "active" } }), "no-employer")
  assert.equal(no({ board: "private", sample: true, row: { employer_id: "emp-1", status: "active" } }), "sample")
  assert.equal(no({ board: "govt", sample: false, row: { employer_id: "emp-1", status: "active" } }), "no-onsite-flow")
})
test("API route: uses the verdict, resolves the job row, and can no longer store an 'ownerless' / 'outreach pending' application", () => {
  const src = strip(read("src/app/api/applications/[[...params]]/route.ts"))
  assert.match(src, /applicationTargetVerdict\(/)
  assert.match(src, /if \(!verdict\.ok\)/)
  assert.match(src, /status: verdict\.status/)
  assert.doesNotMatch(src, /managedBy:\s*employerId\s*\?/, "no conditional ownerless metadata")
  assert.doesNotMatch(src, /["']noblejob["']/)
  assert.doesNotMatch(src, /outreach/)
  assert.doesNotMatch(src, /employerId:\s*string\s*\|\s*null/)
  // the verdict runs BEFORE anything is written
  assert.ok(src.indexOf("applicationTargetVerdict(") < src.indexOf('.from("applications").insert('), "verdict precedes the insert")
  // client-supplied source URL is no longer stored as application metadata
  assert.doesNotMatch(src, /sourceUrl:\s*d\.sourceUrl/)
})
test("dead end + sample + closed states never open the application modal or call the applications API", () => {
  const btn = strip(read("src/components/jobs/ApplyButton.tsx"))
  const modalUse = btn.indexOf("<ApplicationModal")
  assert.ok(modalUse > btn.indexOf("state.kind !== 'employer'"), "the modal is only reachable after every non-employer state has returned")
  assert.match(btn, /if \(state\.kind === 'sample'\)/)
  assert.match(btn, /if \(state\.kind === 'external' && state\.href\)/)
  assert.match(btn, /state\.kind === 'closed'/)
})

/* ═════════════ 4. talent / resume registration is never an application ═════════════ */

test("talent registration is a separate, general-profile action: no job id, no company, no vacancy wording", () => {
  assert.ok(!("jobId" in TALENT_REGISTRATION) && !("board" in TALENT_REGISTRATION))
  assert.doesNotMatch(TALENT_REGISTRATION.href, /\?|job|board|id=/i, "the link carries no vacancy reference")
  assert.doesNotMatch(TALENT_REGISTRATION.label, /\bappl(y|ication|ied)\b/i, "the label is not an apply label")
  assert.match(TALENT_REGISTRATION.note, /not a job application/)
  assert.match(TALENT_REGISTRATION.note, /not sent to any employer/)
  assert.doesNotMatch(TALENT_REGISTRATION.note, /\{|\$\{/, "no templating that could inject a vacancy / company name")
})
test("talent registration can never become an application record: the only application writer requires an owning employer", () => {
  const v = applicationTargetVerdict({ board: "private", sample: false, row: { employer_id: null, status: "active" } })
  assert.equal(v.ok, false, "a vacancy with no hiring employer cannot receive an application, however it is labelled")
  const src = read("src/components/jobs/ApplyButton.tsx")
  const from = src.indexOf('// "listing": information only')
  assert.ok(from > 0, "listing branch located")
  const listing = strip(src.slice(from, src.indexOf("return (\n    <>", from)))
  assert.match(listing, /TALENT_REGISTRATION\.href/)
  assert.doesNotMatch(listing, /ApplicationModal|setOpen|\/api\/applications|jobId/, "the talent link is not wired to any application flow or vacancy id")
  // the existing govt resume popup is the same kind of thing: it saves a resume, it does not apply
  const popup = strip(read("src/components/govt/SaveResumePopup.tsx"))
  assert.doesNotMatch(popup, /\/api\/applications/)
})
test("the talent link is offered only beside the info-only state — never beside an employer's Apply Now or an external Apply link", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server")
  const { ApplyButton } = await import("../../components/jobs/ApplyButton")
  const ext = renderToStaticMarkup(React.createElement(ApplyButton, { jobId: "x", state: applyStateFor("private", externalPrivate(), "A") }))
  assert.doesNotMatch(ext, /general profile/)
  const dead = renderToStaticMarkup(React.createElement(ApplyButton, { jobId: "x", state: applyStateFor("private", deadEndPrivate(""), "A") }))
  assert.match(dead, /general profile registration, not a job application/)
  assert.doesNotMatch(dead, /Acme|Apply Now/)
})
test("historical ownerless applications are kept but labelled 'Not sent to an employer' (never a pending 'New')", () => {
  assert.equal(isDeliveredToEmployer({ employer_id: null }), false)
  assert.equal(isDeliveredToEmployer({ employer_id: "emp-1" }), true)
  assert.match(NOT_SENT_NOTE, /Not sent to an employer/)
  const tracker = strip(read("src/components/candidate/AppTracker.tsx"))
  assert.match(tracker, /isDeliveredToEmployer\(app\)/)
  assert.match(tracker, /NOT_SENT_NOTE/)
  assert.match(tracker, /Not sent/)
  assert.doesNotMatch(strip(read("src/app/api/applications/[[...params]]/route.ts")), /\.delete\(/, "no application record is deleted")
})

/* ═════════════ candidate-facing copy: no "stays on NobleJob" anywhere ═════════════ */

test("ApplicationModal copy: sent to {company} through NobleJob — no 'stays on / saved on Noble Job'", () => {
  const src = read("src/components/jobs/ApplicationModal.tsx")
  assert.doesNotMatch(src, /stays on Noble Job|stay on Noble Job|saved on Noble Job|no need to go anywhere else/i)
  assert.match(src, /sent to[^`'"]*through Noble Job|was sent to/)
  assert.match(src, /through Noble Job/)
  assert.doesNotMatch(src, /share your details without consent/, "no unsupported consent claim")
})
test("no candidate-facing surface still says an application 'stays on Noble Job' or promises to 'apply directly'", () => {
  for (const f of [
    "src/components/jobs/ApplicationModal.tsx", "src/components/jobs/ApplyButton.tsx", "src/components/jobs/JobCard.tsx", "src/components/jobs/JobDetailModal.tsx",
    "src/components/wfh/WfhDetailModal.tsx", "src/components/abroad/AbroadDetailModal.tsx", "src/components/abroad/AbroadApplySlot.tsx",
    "src/components/landing/renderCityCategoryLanding.tsx", "src/components/landing/renderTailCityLanding.tsx",
    "src/lib/seo/cityCategoryLanding.ts", "src/lib/seo/tailCityLanding.ts", "src/lib/seo/faq.ts", "src/lib/data/landingCities.ts",
  ]) {
    const s = read(f)
    assert.doesNotMatch(s, /stays? on Noble Job|saved on Noble Job/i, f)
    assert.doesNotMatch(s, /[Aa]pply directly to verified listings|and apply directly\./, f)
    assert.doesNotMatch(s, /click ["']Apply Now["'] on a (role that fits|suitable role)/, f)
  }
})
test("WFH detail modal and JobDetailModal no longer hand-roll an Apply: they render the shared state-driven ApplyButton", () => {
  for (const f of ["src/components/wfh/WfhDetailModal.tsx", "src/components/jobs/JobDetailModal.tsx"]) {
    const s = strip(read(f))
    assert.match(s.replace(/\s+/g, ""), /<ApplyButton/, f)
    assert.doesNotMatch(s, /Apply on Official Site|Apply Now →/, f)
  }
})
test("job card: only the 'employer' state gets an on-site Apply Now; external / info-only cards show View Details / Similar Jobs", () => {
  const src = strip(read("src/components/jobs/JobCard.tsx"))
  assert.match(src, /apply\.kind === 'employer'/)
  assert.match(src, /const apply = applyStateFor\('private', job, job\.company\)/)
  assert.doesNotMatch(src, /sourceUrl=/)
})
test("all three detail pages compute ONE apply state and use it for the control AND the page copy", () => {
  for (const [f, board] of [["src/app/jobs/private/[id]/page.tsx", "private"], ["src/app/jobs/wfh/[id]/page.tsx", "wfh"], ["src/app/jobs/abroad/[id]/page.tsx", "abroad"]] as const) {
    const s = read(f)
    assert.match(s, new RegExp(`applyStateFor\\('${board}', job, job\\.company\\)`), f)
    assert.match(s, /applyKind:\s*apply\.kind/, f)
  }
  assert.match(read("src/app/jobs/private/[id]/page.tsx"), /<ApplyButton[^>]*state=\{apply\}/)
  assert.match(read("src/app/jobs/wfh/[id]/page.tsx"), /<ApplyButton[^>]*state=\{apply\}/)
})

/* ═════════════ page copy follows the state ═════════════ */

test("How-to-Apply / 'Mode of Application' / apply FAQ describe what Apply ACTUALLY does, per state", () => {
  const base = { board: "private", title: "Accounts Executive", company: "Acme Pvt Ltd", location: "Delhi" } as const
  const text = (k: "employer" | "external" | "closed" | "listing" | "sample") => {
    const c = buildJobContent({ ...base, applyKind: k } as never)
    return {
      steps: c.howToApply.join(" | "),
      mode: c.importantDates.find(d => d.label === "Mode of Application")?.value ?? "",
      faq: c.faqs.find(f => /How do I apply/.test(f.q))?.a ?? "",
    }
  }
  const emp = text("employer")
  assert.match(emp.steps, /through Noble Job/)
  assert.match(emp.mode, /through Noble Job/)
  const ext = text("external")
  assert.match(ext.steps, /original listing on its own website/)
  assert.match(ext.steps, /does not receive or forward/)
  assert.doesNotMatch(ext.steps + ext.faq, /Apply Now/, "no on-site 'Apply Now' promised for an external job")
  assert.match(ext.mode, /own website/)
  const lst = text("listing")
  assert.match(lst.steps, /information only/)
  assert.doesNotMatch(lst.steps + lst.faq, /Apply Now|through Noble Job|application form/i, "an info-only listing promises no application")
  assert.match(lst.mode, /information only/i)
  const cl = text("closed")
  assert.match(cl.steps, /closed/)
  assert.doesNotMatch(cl.steps + cl.faq, /Apply Now/)
  for (const t of [emp, ext, lst, cl]) assert.doesNotMatch(t.steps + t.faq, /stays on Noble Job|saved on Noble Job/i)
  assert.match(text("sample").steps, /sample listing/)
})

/* ═════════════ directApply: only when the flow genuinely qualifies ═════════════ */

test("directApply is true ONLY for the 'employer' route, and only while the NobleJob flow meets the direct-apply conditions", () => {
  assert.equal(isDirectApply("employer"), true)
  assert.equal(isDirectApply("external"), false)
  assert.equal(isDirectApply("none"), false)
  assert.equal(applyStateFor("private", employerPrivate(), "A").directApply, true)
  assert.equal(applyStateFor("private", externalPrivate(), "A").directApply, false)
  assert.equal(applyStateFor("private", deadEndPrivate(""), "A").directApply, false)
})
test("DIRECT_APPLY_FLOW is asserted against the implementation, not just declared", () => {
  assert.equal(DIRECT_APPLY_FLOW.completedOnPage, true)
  assert.equal(DIRECT_APPLY_FLOW.offSiteRedirect, false)
  assert.equal(DIRECT_APPLY_FLOW.deliveredToEmployer, true)
  assert.equal(DIRECT_APPLY_FLOW.jobViewableWithoutLogin, true)
  assert.ok(DIRECT_APPLY_FLOW.maxSignInsBeforeSubmit <= 1)
  const modal = strip(read("src/components/jobs/ApplicationModal.tsx"))
  // completed on the page: a modal, never a navigation away — the only router.push is the sign-in that returns to this job
  assert.doesNotMatch(modal, /window\.open|window\.location\s*=|location\.href\s*=|target=["']_blank["']/)
  const pushes = modal.match(/router\.push\(/g) ?? []
  assert.equal(pushes.length, 1, "exactly one navigation (the sign-in)")
  assert.match(modal, /redirect=\$\{encodeURIComponent\(here\)\}/, "sign-in returns to the same job page")
  // the submission is delivered: the API notifies the owning employer (and emails a verified one)
  const api = strip(read("src/app/api/applications/[[...params]]/route.ts"))
  assert.match(api, /createNotification\(\s*ownerRow\.user_id/)
  assert.match(api, /employer_id: employerId/)
  // job details are public — the detail pages never gate on a session
  for (const f of ["src/app/jobs/private/[id]/page.tsx", "src/app/jobs/wfh/[id]/page.tsx", "src/app/jobs/abroad/[id]/page.tsx"]) {
    assert.doesNotMatch(strip(read(f)), /requireAuth|redirect\(['"]\/auth|getUser\(/, f)
  }
})

void (async () => {
  await Promise.all(pending)
  console.log(`\napply-state tests: ${passed} passed, ${failed} failed`)
  process.exitCode = failed ? 1 : 0
})()
