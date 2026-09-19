/**
 * jobPosting.test.ts — Phase 1 JobPosting integrity tests.
 *
 *   npm run test:seo-phase1      # runs this + the other Phase 1 suites
 *
 * Every rule here is one of the JobPosting corrections: no invented dates, no
 * default directApply, no NobleJob logo as employer logo, sameAs never the apply
 * URL, government JobPosting only for real recruitment notifications, WFH not
 * automatically TELECOMMUTE, ISO countries, and no JobPosting for synthetic jobs.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { jobPostingSchema } from "./schema"
import {
  buildPrivateJobPosting,
  buildWfhJobPosting,
  buildAbroadJobPosting,
  buildGovtJobPosting,
} from "./jobPostingBuilders"
import { buildJobContent } from "./jobContent"
import {
  parseRealDate,
  endOfDayIst,
  normalizeEmploymentType,
  isExplicitlyFullyRemote,
  isGenuinelyFullyRemote,
  explicitApplicantCountry,
  resolveApplicantCountry,
  resolveCountryIso,
  originOf,
  sameUrl,
} from "./jobPostingRules"
import {
  buildStoredDescription,
  buildGovtFactsDescription,
  clampDescriptionHtml,
  isSubstantiveDescription,
  plainTextOf,
  MAX_DESCRIPTION_HTML_CHARS,
} from "./jobPostingDescription"
import { ORG_LOGO } from "./constants"
import type { Job } from "@/types/job"
import type { WfhJob } from "@/types/wfhJob"
import type { AbroadJob } from "@/types/abroadJob"
import type { GovtJob } from "@/types/govtJob"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}

type Obj = Record<string, unknown>
const asObj = (v: unknown) => v as Obj
const isoRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

/* ------------------------------ fixtures ------------------------------ */

const POSTED = "2026-08-01T05:30:00.000Z"

/** Realistic STORED employer descriptions (each is > 150 chars / > 20 words). */
const PRIVATE_DESC =
  "We are looking for an Accounts Executive to maintain the company ledgers in Tally and reconcile vendor and bank statements every month.\n\n" +
  "The role reports to the finance manager and handles GST filing support, invoice processing and monthly closing for our Delhi office."
const WFH_DESC =
  "Answer customer emails and chat requests for our subscription product. This is a fully remote position open to candidates based in India. " +
  "You will work fixed shifts, use our ticketing tool and escalate billing issues to the finance team."
const ABROAD_DESC =
  "Install and maintain electrical wiring, panels and lighting for commercial building sites in Dubai. Candidates must hold a trade certificate and " +
  "have prior site experience. Accommodation and transport details are shared at interview."
/** Generated boilerplate that must never be presented to Google as employer facts. */
const BOILERPLATE_RE = /recogni[sz]ed employer|onboarding|mentoring|growth path|career path|Key Responsibilities|Selection Process|Benefits:/i

const employerJob = (over: Partial<Job> & Obj = {}): Job =>
  ({
    id: "3f2a9b6e-1111-4c2d-8a10-0a1b2c3d4e5f",
    title: "Accounts Executive",
    company: "Acme Pvt Ltd",
    logo: "AC",
    color: "#000",
    location: "Delhi",
    type: "Full Time",
    exp: "2 years",
    salary: "₹25,000 - ₹35,000 per month",
    cat: "Accounting",
    skills: ["Tally"],
    jobStatus: "LIVE_JOB",
    provenance: "EMPLOYER",
    employer_id: "emp-1",
    applyUrl: "",
    desc: PRIVATE_DESC,
    posted: "",
    verified: true,
    source: "employer",
    board: "private",
    posted_at: POSTED,
    ...over,
  }) as unknown as Job

const aggregatedJob = (over: Obj = {}) =>
  employerJob({
    provenance: "AGGREGATED",
    employer_id: undefined,
    source: "himalayas",
    applyUrl: "https://apply.ats-example.com/jobs/991",
    ...over,
  })

const contentFor = (job: Job, extra: Obj = {}) =>
  buildJobContent({ board: "private", title: job.title, company: job.company, location: job.location, ...extra } as never)

const syntheticJob = () => employerJob({ id: "live-priv-1", provenance: undefined, employer_id: undefined, source: "Live Feed", verified: false })

const wfhJob = (over: Obj = {}): WfhJob =>
  ({
    id: "wfh-real-1",
    title: "Customer Support",
    company: "Remote Co",
    logo: "RC",
    type: "Full-Time Remote",
    experience: "Fresher",
    salary: "₹20,000 per month",
    cat: "Support",
    qualification: "Graduate",
    posted_at: POSTED,
    apply_url: "https://careers.remoteco.example/apply/1",
    description: WFH_DESC,
    provenance: "AGGREGATED",
    source: "himalayas",
    status: "active",
    ...over,
  }) as unknown as WfhJob

const abroadJob = (over: Obj = {}): AbroadJob =>
  ({
    id: "abroad-real-1",
    title: "Electrician",
    company: "Gulf Build LLC",
    logo: "GB",
    country: "UAE",
    location: "Dubai",
    type: "Full Time",
    salary: "AED 2,500 per month",
    experience: "3 years",
    category: "Construction",
    posted_at: POSTED,
    apply_url: "https://careers.gulfbuild.example/apply/1",
    description: ABROAD_DESC,
    provenance: "AGGREGATED",
    source: "himalayas",
    status: "active",
    ...over,
  }) as unknown as AbroadJob

const govtJob = (over: Obj = {}): GovtJob =>
  ({
    id: "ibps:clerk-2026",
    slug: "ibps-clerk-2026",
    title: "IBPS Clerk Recruitment 2026",
    org: "IBPS",
    post: "Clerk",
    vacancies: "6000",
    vacanciesStated: "6000",
    ageRange: "20-28 years",
    tab: "banking",
    status: "active",
    lastDate: "30 Sep 2026",
    officialUrl: "https://www.ibps.in/careers/clerk-2026.pdf",
    applyUrl: "https://ibpsonline.ibps.in/apply",
    sourcePublishedAt: "2026-08-10T00:00:00.000Z",
    location: "All India",
    state: "",
    qualification: "Any Graduate",
    salary: "",
    // Template-generated at enrichment — must never reach the JobPosting description.
    overview: "GENERATED-OVERVIEW IBPS is a recognised employer offering structured onboarding and mentoring.",
    ...over,
  }) as unknown as GovtJob

const govtHelpers = { regionFor: () => undefined, localityFor: () => undefined }

/* --------------------------- synthetic / gates --------------------------- */

test("synthetic private job → NO JobPosting", () => {
  const j = syntheticJob()
  assert.equal(buildPrivateJobPosting(j, contentFor(j)), null)
})
test("synthetic WFH job → NO JobPosting", () => {
  const j = wfhJob({ id: "ver-wfh-7", provenance: undefined, source: "live feed" })
  assert.equal(buildWfhJobPosting(j, contentFor(employerJob())), null)
})
test("synthetic abroad job → NO JobPosting", () => {
  const j = abroadJob({ id: "arch-abroad-uae-3", provenance: "SYNTHETIC" })
  assert.equal(buildAbroadJobPosting(j, contentFor(employerJob())), null)
})
test("unclassified private job → NO JobPosting (fails closed)", () => {
  const j = employerJob({ provenance: undefined, employer_id: undefined, verified: false })
  assert.equal(buildPrivateJobPosting(j, contentFor(j)), null)
})
test("closed job (status=closed) → NO JobPosting", () => {
  const j = employerJob({ status: "closed" })
  assert.equal(buildPrivateJobPosting(j, contentFor(j)), null)
})
test("job whose REAL employer deadline has passed → NO JobPosting", () => {
  const j = employerJob({ application_deadline: "2020-01-01T00:00:00Z" })
  assert.equal(buildPrivateJobPosting(j, contentFor(j, { applicationDeadline: "2020-01-01T00:00:00Z" })), null)
})

/* ------------------------------- dates ------------------------------- */

test("genuine private job with a real posting date → JobPosting with THAT date", () => {
  const j = employerJob()
  const p = asObj(buildPrivateJobPosting(j, contentFor(j, { postedAt: POSTED })))
  assert.equal(p["@type"], "JobPosting")
  assert.equal(p.datePosted, POSTED)
})
test("missing posting date → NO JobPosting (never falls back to now())", () => {
  const j = employerJob({ posted_at: undefined, posted: "" })
  assert.equal(buildPrivateJobPosting(j, contentFor(j)), null)
})
test("relative/junk posted text ('2 days ago') is not a real date → NO JobPosting", () => {
  const j = employerJob({ posted_at: undefined, posted: "2 days ago" })
  assert.equal(buildPrivateJobPosting(j, contentFor(j)), null)
})
test("private datePosted comes ONLY from the stored posted_at — never from the display string", () => {
  // Display strings on the list path / synthetic inventory: never a schema date.
  for (const posted of ["5 days ago", "Recent", "Just now", "2 weeks ago", "Job 1", "Yesterday"]) {
    const j = employerJob({ posted_at: undefined, posted })
    assert.equal(buildPrivateJobPosting(j, contentFor(j)), null, `posted=${JSON.stringify(posted)}`)
  }
  // Even a perfectly parseable display date is not the stored original date.
  const j = employerJob({ posted_at: undefined, posted: "2026-08-01" })
  assert.equal(buildPrivateJobPosting(j, contentFor(j)), null, "job.posted is never a fallback")
  // With a stored posted_at, a conflicting display string is ignored.
  const k = employerJob({ posted: "5 days ago" })
  const p = asObj(buildPrivateJobPosting(k, contentFor(k, { postedAt: POSTED })))
  assert.equal(p.datePosted, POSTED)
  assert.doesNotMatch(JSON.stringify(p), /days ago/i)
})
test("private: a junk or future stored posted_at → NO JobPosting", () => {
  for (const posted_at of ["Job 1", "5 days ago", "not-a-date", "", "1999-01-01T00:00:00Z", "2099-01-01T00:00:00Z"]) {
    const j = employerJob({ posted_at })
    assert.equal(buildPrivateJobPosting(j, contentFor(j)), null, `posted_at=${JSON.stringify(posted_at)}`)
  }
})
test("schema: future datePosted (beyond clock-skew tolerance) → null", () => {
  const mk = (d: string) => jobPostingSchema({ title: "t", description: "A real description.", url: "/x", organizationName: "o", location: "l", datePosted: d, addressCountry: "IN" })
  assert.equal(mk("2099-01-01T00:00:00Z"), null)
  assert.notEqual(mk(POSTED), null)
})
test("neither the private builder nor its page reads job.posted as a date", () => {
  const b = readFileSync(join(process.cwd(), "src/lib/seo/jobPostingBuilders.ts"), "utf8")
  assert.doesNotMatch(b, /datePosted:\s*[^,\n]*\bjob\.posted\b/, "builder must not fall back to job.posted")
  const pg = readFileSync(join(process.cwd(), "src/app/jobs/private/[id]/page.tsx"), "utf8")
  assert.doesNotMatch(pg, /postedAt:[^\n]*job\.posted\b/, "page must not fall back to job.posted")
})
test("no employer deadline → validThrough OMITTED (never +30 days)", () => {
  const j = employerJob()
  const c = contentFor(j, { postedAt: POSTED })
  assert.equal(c.validThrough, undefined)
  const p = asObj(buildPrivateJobPosting(j, c))
  assert.ok(!("validThrough" in p))
})
test("internal review_due_at NEVER becomes validThrough", () => {
  const j = employerJob({ review_due_at: "2099-01-01T00:00:00Z", last_confirmed_open_at: "2026-08-02T00:00:00Z" })
  const c = contentFor(j, { postedAt: POSTED }) // applicationDeadline deliberately absent
  assert.equal(c.validThrough, undefined)
  const p = asObj(buildPrivateJobPosting(j, c))
  assert.ok(!("validThrough" in p), "review_due_at must not surface as validThrough")
  const txt = JSON.stringify(c)
  assert.ok(!txt.includes("2099"), "review date must not appear in visible copy")
})
test("a real employer deadline in the future → validThrough emitted", () => {
  const j = employerJob({ application_deadline: "2099-06-30T12:00:00Z" })
  const p = asObj(buildPrivateJobPosting(j, contentFor(j, { postedAt: POSTED, applicationDeadline: "2099-06-30T12:00:00Z" })))
  assert.equal(p.validThrough, "2099-06-30T12:00:00.000Z")
})
test("visible page copy never invents a closing date when none is stored", () => {
  const c = contentFor(employerJob(), { postedAt: POSTED })
  const dates = JSON.stringify(c.importantDates)
  assert.ok(/not stated/i.test(dates), "importantDates should say the deadline is not stated")
  assert.ok(!c.importantDates.some(d => /closes|last date/i.test(d.label) && isoRe.test(d.value)))
})
test("parseRealDate: strict — junk / roll-over rejected, real formats accepted", () => {
  assert.equal(parseRealDate("Job 1"), undefined)
  assert.equal(parseRealDate("2 days ago"), undefined)
  assert.equal(parseRealDate("TBA"), undefined)
  assert.equal(parseRealDate("31 Feb 2026"), undefined)
  assert.equal(parseRealDate("1999-01-01"), undefined)
  assert.equal(parseRealDate("30 Jun 2026"), "2026-06-30T00:00:00.000Z")
  assert.equal(parseRealDate("Jun 30, 2026"), "2026-06-30T00:00:00.000Z")
  assert.equal(parseRealDate("2026-01-15T10:00:00Z"), "2026-01-15T10:00:00.000Z")
})
test("endOfDayIst: 'last date 30 Jun' stays open through the whole IST day", () => {
  assert.equal(endOfDayIst("2026-06-30T00:00:00.000Z"), "2026-06-30T18:29:59.000Z")
  assert.equal(endOfDayIst(undefined), undefined)
})

/* ------------------------------ description ------------------------------ */

test("private description = the STORED employer description + stored facts", () => {
  const j = employerJob()
  const p = asObj(buildPrivateJobPosting(j, contentFor(j, { postedAt: POSTED })))
  const d = String(p.description)
  assert.ok(d.includes("maintain the company ledgers in Tally"), "stored description text is present")
  assert.ok(d.includes("GST filing support"), "second stored paragraph is present")
  assert.ok(d.includes("<li>Employer: Acme Pvt Ltd</li>"))
  assert.ok(d.includes("<li>Location: Delhi</li>"))
  assert.ok(d.includes("<li>Experience: 2 years</li>"))
  assert.ok(d.includes("<li>Skills: Tally</li>"))
})
test("description never carries generated employer claims, benefits, responsibilities or stages", () => {
  const cases: Array<[string, unknown]> = [
    ["private", buildPrivateJobPosting(employerJob(), contentFor(employerJob(), { postedAt: POSTED }))],
    ["aggregated", buildPrivateJobPosting(aggregatedJob(), contentFor(aggregatedJob(), { postedAt: POSTED }))],
    ["wfh", buildWfhJobPosting(wfhJob({ applicant_country: "IN" }), contentFor(employerJob(), { postedAt: POSTED }))],
    ["abroad", buildAbroadJobPosting(abroadJob(), contentFor(employerJob(), { postedAt: POSTED }))],
    ["govt", buildGovtJobPosting(govtJob(), govtHelpers)],
  ]
  for (const [name, p] of cases) {
    assert.ok(p, `${name} should emit`)
    assert.doesNotMatch(String(asObj(p).description), BOILERPLATE_RE, `${name} description contains generated copy`)
  }
})
test("the generated page copy is not what reaches the schema description", () => {
  const j = employerJob()
  const c = contentFor(j, { postedAt: POSTED })
  const d = String(asObj(buildPrivateJobPosting(j, c)).description)
  assert.ok(c.overview[0].length > 40 && !d.includes(c.overview[0]), "generated overview must not be in the schema")
  assert.ok(!d.includes(c.aboutOrg.slice(0, 60)), "generated 'about the employer' must not be in the schema")
  for (const r of c.responsibilities) assert.ok(!d.includes(r), "generated responsibility leaked into the schema")
  for (const b of c.benefits) assert.ok(!d.includes(b), "generated benefit leaked into the schema")
  assert.ok(!("schemaDescriptionHtml" in (c as unknown as Obj)), "the template-built schema description no longer exists")
})
test("no substantive STORED description → NO JobPosting (private / WFH / abroad)", () => {
  const c = contentFor(employerJob(), { postedAt: POSTED })
  for (const desc of ["d", "", "Great opportunity, apply now!", undefined, null]) {
    const j = employerJob({ desc: desc as never })
    assert.equal(buildPrivateJobPosting(j, contentFor(j, { postedAt: POSTED })), null, `private desc=${JSON.stringify(desc)}`)
    assert.equal(buildWfhJobPosting(wfhJob({ applicant_country: "IN", description: desc as never }), c), null, `wfh desc=${JSON.stringify(desc)}`)
    assert.equal(buildAbroadJobPosting(abroadJob({ description: desc as never }), c), null, `abroad desc=${JSON.stringify(desc)}`)
  }
})
test("stored facts alone never stand in for a description", () => {
  const j = employerJob({ desc: "" })
  assert.equal(buildPrivateJobPosting(j, contentFor(j, { postedAt: POSTED })), null)
  assert.equal(buildStoredDescription({ description: "", facts: [{ label: "Employer", value: "Acme" }] }), null)
})
test("stored HTML / hostile text is reduced to safe, escaped markup", () => {
  const raw =
    "<p>We need an <b>Accounts Executive</b> to keep ledgers &amp; reconcile bank statements each month for our Delhi office.</p>" +
    "<script>alert(1)</script><ul><li>Tally &lt;ERP&gt; experience</li><li>GST filing support and invoice processing</li></ul>" +
    "<p>Send questions to the hiring manager after applying through the portal; shortlisted candidates are called.</p>"
  const html = buildStoredDescription({ description: raw })!
  assert.ok(html, "substantive")
  assert.doesNotMatch(html, /<script|alert\(1\)|<b>|onerror/i)
  assert.match(html, /ledgers &amp; reconcile/)
  assert.match(html, /<li>Tally &lt;ERP&gt; experience<\/li>/)
  assert.ok(/^(<p>|<ul>)/.test(html) && !/<(?!\/?(p|ul|li|br)\b)[a-z]/i.test(html), "only p/ul/li/br produced")
})
test("facts skip placeholders (— / TBA / Competitive / Any / As per norms / Not specified)", () => {
  const j = employerJob({ salary: "Competitive", exp: "Any", type: "-", location: "India", job_type: "" })
  const d = String(asObj(buildPrivateJobPosting(j, contentFor(j, { postedAt: POSTED }))).description)
  for (const junk of ["Competitive", "Salary:", "Experience:", "Employment type:", "Location:"]) assert.ok(!d.includes(junk), junk)
  assert.ok(d.includes("Employer: Acme Pvt Ltd"))
})
test("description is clamped on a block boundary (never mid-tag) and stays ≤ 5000 chars", () => {
  const para = "Reconcile vendor statements and post journal entries in Tally every month. ".repeat(6).trim()
  const long = Array.from({ length: 40 }, () => para).join("\n\n")
  const html = buildStoredDescription({ description: long, facts: [{ label: "Employer", value: "Acme" }] })!
  assert.ok(html.length <= MAX_DESCRIPTION_HTML_CHARS)
  assert.match(html, /<\/ul>$/, "facts list still present and closed")
  const one = clampDescriptionHtml("<p>" + "x".repeat(6000) + "</p>")
  assert.equal(one, "", "a single block that cannot fit is dropped, never cut mid-tag")
  const two = clampDescriptionHtml("<p>" + "a".repeat(3000) + "</p><p>" + "b".repeat(3000) + "</p>")
  assert.ok(two.endsWith("</p>") && two.length <= 5000 && !two.includes("b"))
})
test("isSubstantiveDescription thresholds", () => {
  assert.equal(isSubstantiveDescription("d"), false)
  assert.equal(isSubstantiveDescription("word ".repeat(19)), false)
  assert.equal(isSubstantiveDescription(PRIVATE_DESC), true)
  assert.equal(plainTextOf("<p>Hello&nbsp;<b>world</b></p>"), "Hello world")
})

/* ------------------------------ directApply ------------------------------ */

test("directApply is never emitted by default (schema level)", () => {
  const p = asObj(jobPostingSchema({ title: "t", description: "d", url: "/x", organizationName: "o", location: "l", datePosted: POSTED, addressCountry: "IN" }))
  assert.ok(!("directApply" in p))
})
test("employer job delivered through NobleJob → directApply true", () => {
  const j = employerJob()
  assert.equal(asObj(buildPrivateJobPosting(j, contentFor(j, { postedAt: POSTED }))).directApply, true)
})
test("aggregated / curated jobs → directApply FALSE (candidates apply on a third-party site)", () => {
  const a = aggregatedJob()
  assert.equal(asObj(buildPrivateJobPosting(a, contentFor(a, { postedAt: POSTED }))).directApply, false)
  const c = employerJob({ provenance: "CURATED", employer_id: undefined, source: "curated by editorial", applyUrl: "https://careers.zenith-industries.in/apply" })
  const pc = asObj(buildPrivateJobPosting(c, contentFor(c, { postedAt: POSTED })))
  assert.equal(pc.directApply, false)
})
test("government JobPosting → directApply false", () => {
  assert.equal(asObj(buildGovtJobPosting(govtJob(), govtHelpers)).directApply, false)
})

/* ---------------------------- employer identity ---------------------------- */

test("employer logo can NEVER fall back to the NobleJob logo", () => {
  const j = employerJob() // no logoUrl; `logo` is initials
  const p = asObj(buildPrivateJobPosting(j, contentFor(j, { postedAt: POSTED })))
  const org = asObj(p.hiringOrganization)
  assert.ok(!("logo" in org), "no employer logo → no logo property")
  assert.ok(!JSON.stringify(p).includes(ORG_LOGO), "NobleJob logo asset must not appear")
  const withLogo = employerJob({ logoUrl: "https://cdn.acme.example/logo.png" })
  const org2 = asObj(asObj(buildPrivateJobPosting(withLogo, contentFor(withLogo, { postedAt: POSTED }))).hiringOrganization)
  assert.equal(org2.logo, "https://cdn.acme.example/logo.png")
})
test("hiringOrganization.sameAs can NEVER be the apply URL", () => {
  const url = "https://apply.ats-example.com/jobs/991"
  const p = asObj(jobPostingSchema({
    title: "t", description: "d", url: "/x", organizationName: "o", location: "l",
    datePosted: POSTED, addressCountry: "IN", applyUrl: url, organizationSameAs: url,
  }))
  assert.ok(!("sameAs" in asObj(p.hiringOrganization)))
  const a = aggregatedJob()
  const pa = asObj(buildPrivateJobPosting(a, contentFor(a, { postedAt: POSTED })))
  assert.ok(!("sameAs" in asObj(pa.hiringOrganization)), "aggregated builder never derives sameAs from applyUrl")
})
test("sameAs is only the employer/source website (government: origin of the official site)", () => {
  const p = asObj(buildGovtJobPosting(govtJob({ officialUrl: "https://www.ibps.in/deep/path/notice.pdf" }), govtHelpers))
  assert.equal(asObj(p.hiringOrganization).sameAs, "https://www.ibps.in/")
  assert.notEqual(asObj(p.hiringOrganization).sameAs, "https://ibpsonline.ibps.in/apply")
})
test("employmentType: no hard-coded FULL_TIME when unknown", () => {
  const j = employerJob({ type: "", job_type: "" })
  const p = asObj(buildPrivateJobPosting(j, contentFor(j, { postedAt: POSTED })))
  assert.ok(!("employmentType" in p))
  assert.equal(normalizeEmploymentType(""), undefined)
  assert.equal(normalizeEmploymentType("Full Time / Part Time"), undefined)
  assert.equal(normalizeEmploymentType("Full-Time Remote"), "FULL_TIME")
  assert.equal(normalizeEmploymentType("Internship"), "INTERN")
  assert.equal(normalizeEmploymentType("Contract"), "CONTRACTOR")
})

/* ---------------------------------- WFH ---------------------------------- */

test("WFH: 100% remote + a stored applicant country → TELECOMMUTE with that country", () => {
  const p = asObj(buildWfhJobPosting(wfhJob({ applicant_country: "IN" }), contentFor(employerJob(), { postedAt: POSTED })))
  assert.equal(p.jobLocationType, "TELECOMMUTE")
  const req = asObj(p.applicantLocationRequirements)
  assert.equal(req["@type"], "Country")
  assert.equal(req.name, "IN")
})
test("WFH: the permitted country is the STORED one — not a hard-coded India", () => {
  const p = asObj(buildWfhJobPosting(wfhJob({ applicant_country: "AE" }), contentFor(employerJob(), { postedAt: POSTED })))
  assert.equal(asObj(p.applicantLocationRequirements).name, "AE")
  const q = asObj(buildWfhJobPosting(wfhJob({ applicant_country: "United Kingdom" }), contentFor(employerJob(), { postedAt: POSTED })))
  assert.equal(asObj(q.applicantLocationRequirements).name, "GB")
})
test("WFH: country stated explicitly in the record's own text is accepted", () => {
  // WFH_DESC says: "fully remote position open to candidates based in India"
  const p = asObj(buildWfhJobPosting(wfhJob(), contentFor(employerJob(), { postedAt: POSTED })))
  assert.equal(p.jobLocationType, "TELECOMMUTE")
  assert.equal(asObj(p.applicantLocationRequirements).name, "IN")
})
test("WFH: remote but NO stored/explicit country → NO JobPosting (India is never assumed)", () => {
  const noCountry = wfhJob({
    description:
      "Answer customer emails and chat requests for our subscription product. This is a fully remote position. " +
      "You will work fixed shifts, use our ticketing tool and escalate billing issues to the finance team.",
  })
  assert.equal(buildWfhJobPosting(noCountry, contentFor(employerJob(), { postedAt: POSTED })), null)
})
test("WFH: ambiguous / multi-country / worldwide text → NO JobPosting", () => {
  for (const where of [
    "open to candidates based in India or the United Arab Emirates",
    "Remote - India, UAE",
    "Remote - anywhere in the world",
    "Remote, US timezones only",
  ]) {
    const j = wfhJob({
      description:
        `Answer customer emails and chat requests for our subscription product. This is a fully remote position, ${where}. ` +
        "You will work fixed shifts, use our ticketing tool and escalate billing issues to the finance team.",
    })
    assert.equal(buildWfhJobPosting(j, contentFor(employerJob(), { postedAt: POSTED })), null, where)
  }
})
test("WFH: NEVER emits a physical jobLocation for a remote role (no fabricated 'India')", () => {
  const p = asObj(buildWfhJobPosting(wfhJob({ applicant_country: "IN" }), contentFor(employerJob(), { postedAt: POSTED })))
  assert.ok(!("jobLocation" in p), "TELECOMMUTE roles must not carry a made-up address")
  assert.ok(!JSON.stringify(p).includes("addressCountry"))
  assert.ok(!JSON.stringify(p).includes('"India"'))
})
test("WFH: hybrid / on-site / office-day wording anywhere → not TELECOMMUTE → NO JobPosting", () => {
  const c = contentFor(employerJob(), { postedAt: POSTED })
  assert.equal(buildWfhJobPosting(wfhJob({ type: "Hybrid", applicant_country: "IN" }), c), null)
  assert.equal(buildWfhJobPosting(wfhJob({ type: "Full-Time Remote", title: "Hybrid Support Associate", applicant_country: "IN" }), c), null)
  for (const phrase of ["hybrid model", "3 days in office every week", "remote-first with occasional office visits", "on-site training in week one", "work from office on Fridays"]) {
    const j = wfhJob({
      applicant_country: "IN",
      description: `Answer customer emails and chat requests for our subscription product; this is a remote role with ${phrase}. Use our ticketing tool and escalate billing issues to the finance team every day.`,
    })
    assert.equal(buildWfhJobPosting(j, c), null, phrase)
  }
})
test("WFH: uncertain remote status (no positive evidence) → not TELECOMMUTE → NO JobPosting", () => {
  const c = contentFor(employerJob(), { postedAt: POSTED })
  const plain = wfhJob({
    type: "Full Time",
    applicant_country: "IN",
    description:
      "Answer customer emails and chat requests for our subscription product. Fixed shifts, our ticketing tool, and escalation of billing issues to the finance team are part of the role.",
  })
  assert.equal(buildWfhJobPosting(plain, c), null, "being on the WFH board is not evidence")
  assert.notEqual(buildWfhJobPosting(wfhJob({ type: "", applicant_country: "IN" }), c), null, "type blank but the description says fully remote → evidence is in the description")
})
test("WFH: isGenuinelyFullyRemote / isExplicitlyFullyRemote rules", () => {
  assert.equal(isExplicitlyFullyRemote("Hybrid"), false)
  assert.equal(isExplicitlyFullyRemote("Remote-first with 3 office days"), false)
  assert.equal(isExplicitlyFullyRemote("Full-Time Remote"), true)
  assert.equal(isExplicitlyFullyRemote("Work From Home"), true)
  assert.equal(isGenuinelyFullyRemote({ type: "Full-Time Remote" }), true)
  assert.equal(isGenuinelyFullyRemote({ type: "Full-Time Remote", description: "Hybrid: 2 days in office" }), false)
  assert.equal(isGenuinelyFullyRemote({ type: "Full Time", description: "This is a 100% remote role." }), true)
  assert.equal(isGenuinelyFullyRemote({ type: "Full Time", description: "We build remote monitoring tools." }), false)
  assert.equal(isGenuinelyFullyRemote({ type: "Part Time" }), false)
  assert.equal(isGenuinelyFullyRemote({}), false)
})
test("WFH: explicitApplicantCountry — explicit single country only", () => {
  assert.equal(explicitApplicantCountry("Remote - India"), "IN")
  assert.equal(explicitApplicantCountry("Remote (UAE)"), "AE")
  assert.equal(explicitApplicantCountry("Open to candidates based in Nepal"), "NP")
  assert.equal(explicitApplicantCountry("Work from home - Canada"), "CA")
  assert.equal(explicitApplicantCountry("Remote"), undefined)
  assert.equal(explicitApplicantCountry("Remote - India, UAE"), undefined)
  assert.equal(explicitApplicantCountry("Remote - worldwide"), undefined)
  assert.equal(explicitApplicantCountry("We are an India based company. Remote role."), undefined)
  assert.equal(explicitApplicantCountry("Remote, UK-based company"), undefined)
  assert.equal(explicitApplicantCountry(""), undefined)
  assert.equal(resolveApplicantCountry("in", "Remote - UAE"), "IN", "stored value wins")
  assert.equal(resolveApplicantCountry(undefined, "Remote - UAE"), "AE")
  assert.equal(resolveApplicantCountry("Atlantis", "Remote"), undefined)
})
test("WFH: missing posting date → NO JobPosting", () => {
  assert.equal(buildWfhJobPosting(wfhJob({ posted_at: undefined, applicant_country: "IN" }), contentFor(employerJob())), null)
})
test("WFH: no hard-coded applicant-country constant remains", () => {
  const consts = readFileSync(join(process.cwd(), "src/lib/seo/constants.ts"), "utf8")
  assert.doesNotMatch(consts, /WFH_APPLICANT_COUNTRY_ISO/)
  const b = readFileSync(join(process.cwd(), "src/lib/seo/jobPostingBuilders.ts"), "utf8")
  assert.doesNotMatch(b, /location: "India"|applicantCountry: "IN"/, "builders must not hard-code India")
})

/* --------------------------------- abroad --------------------------------- */

test("abroad: country resolved to ISO alpha-2 (UAE → AE)", () => {
  const p = asObj(buildAbroadJobPosting(abroadJob(), contentFor(employerJob(), { postedAt: POSTED })))
  const addr = asObj(asObj(p.jobLocation).address)
  assert.equal(addr.addressCountry, "AE")
  assert.equal(addr.addressLocality, "Dubai")
  assert.ok(!("addressRegion" in addr), "country must not be stuffed into addressRegion")
})
test("abroad: unresolvable country → NO JobPosting (never a raw string, never 'IN')", () => {
  assert.equal(buildAbroadJobPosting(abroadJob({ country: "Atlantis" }), contentFor(employerJob(), { postedAt: POSTED })), null)
  assert.equal(resolveCountryIso("Atlantis"), undefined)
})
test("resolveCountryIso handles names, aliases and codes", () => {
  assert.equal(resolveCountryIso("United Kingdom"), "GB")
  assert.equal(resolveCountryIso("UK"), "GB")
  assert.equal(resolveCountryIso("saudi arabia"), "SA")
  assert.equal(resolveCountryIso("de"), "DE")
  assert.equal(resolveCountryIso("ZZ"), undefined)
  assert.equal(resolveCountryIso(""), undefined)
})
test("schema: no resolvable country and not remote → null (no default country)", () => {
  assert.equal(jobPostingSchema({ title: "t", description: "d", url: "/x", organizationName: "o", location: "l", datePosted: POSTED }), null)
})

/* ------------------------------- government ------------------------------- */

test("govt recruitment notification with a valid date → JobPosting", () => {
  const p = asObj(buildGovtJobPosting(govtJob(), govtHelpers))
  assert.equal(p["@type"], "JobPosting")
  assert.equal(p.datePosted, "2026-08-10T00:00:00.000Z")
  assert.equal(p.validThrough, "2026-09-30T18:29:59.000Z")
})
test("govt description is built from STORED fields only — never the generated overview", () => {
  const p = asObj(buildGovtJobPosting(govtJob(), govtHelpers))
  const d = String(p.description)
  assert.doesNotMatch(d, /GENERATED-OVERVIEW|recogni[sz]ed employer|onboarding|mentoring/i)
  assert.ok(d.includes("<li>Recruiting organisation: IBPS</li>"))
  assert.ok(d.includes("<li>Post: Clerk</li>"))
  assert.ok(d.includes("<li>Vacancies: 6000</li>"))
  assert.ok(d.includes("<li>Qualification: Any Graduate</li>"))
  assert.ok(d.includes("<li>Last date to apply: 30 Sep 2026</li>"))
})
test("govt: a synthesized display vacancy count is never cited (only vacanciesStated is)", () => {
  const d = String(asObj(buildGovtJobPosting(govtJob({ vacancies: "12,345", vacanciesStated: undefined }), govtHelpers)).description)
  assert.ok(!d.includes("Vacancies"), "no stored count → no vacancies line")
  assert.ok(!d.includes("12,345"))
  const src = readFileSync(join(process.cwd(), "src/lib/services/govtStatsSource.ts"), "utf8")
  const stated = src.indexOf("vacanciesStated:")
  const applied = src.indexOf("applyGovtVacancies({")
  assert.ok(stated > applied && stated - applied < 400, "vacanciesStated is captured from the raw row inside the same mapRow call")
  assert.match(src, /vacanciesStated:\s*parseVacancyCount\(r\.vacancies\)\s*!==\s*null/)
})
test("govt: too few stored facts for a complete description → NO JobPosting", () => {
  const bare = { vacanciesStated: undefined, qualification: "", salary: "-", lastDate: "TBA", ageRange: "-", fee: "-", location: "All India", state: "" }
  assert.equal(buildGovtJobPosting(govtJob(bare), govtHelpers), null)
  assert.equal(buildGovtJobPosting(govtJob({ ...bare, qualification: "Any Graduate", lastDate: "30 Sep 2026" }), govtHelpers), null, "two facts are not enough")
  assert.notEqual(buildGovtJobPosting(govtJob({ ...bare, qualification: "Any Graduate", lastDate: "30 Sep 2026", vacanciesStated: "6000" }), govtHelpers), null)
  assert.equal(buildGovtFactsDescription({ org: "", post: "Clerk", vacanciesStated: "10", qualification: "Graduate", lastDate: "30 Sep 2026" }), null, "organisation is required")
  assert.equal(buildGovtFactsDescription({ org: "IBPS", post: "", vacanciesStated: "10", qualification: "Graduate", lastDate: "30 Sep 2026" }), null, "post is required")
})
test("govt record with NO real source publication date → NO JobPosting", () => {
  assert.equal(buildGovtJobPosting(govtJob({ sourcePublishedAt: undefined }), govtHelpers), null)
  assert.equal(buildGovtJobPosting(govtJob({ sourcePublishedAt: "garbage" }), govtHelpers), null)
})
test("govt: stored postedAt / render time is never used as datePosted", () => {
  assert.equal(buildGovtJobPosting(govtJob({ sourcePublishedAt: undefined, postedAt: new Date().toISOString() }), govtHelpers), null)
})
test("govt: TBA / missing last date → validThrough omitted", () => {
  for (const lastDate of ["TBA", "-", "", "To be announced"]) {
    const p = asObj(buildGovtJobPosting(govtJob({ lastDate }), govtHelpers))
    assert.ok(!("validThrough" in p), `lastDate=${JSON.stringify(lastDate)}`)
  }
})
test("govt: a passed last date → JobPosting removed", () => {
  assert.equal(buildGovtJobPosting(govtJob({ lastDate: "01 Jan 2020" }), govtHelpers), null)
})
test("govt: RESULT page → NO JobPosting", () => {
  assert.equal(buildGovtJobPosting(govtJob({ tab: "results", title: "IBPS Clerk Result 2026" }), govtHelpers), null)
  assert.equal(buildGovtJobPosting(govtJob({ recordType: "result" }), govtHelpers), null)
})
test("govt: ANSWER KEY page → NO JobPosting", () => {
  assert.equal(buildGovtJobPosting(govtJob({ tab: "answer", title: "SSC CGL Answer Key 2026" }), govtHelpers), null)
  assert.equal(buildGovtJobPosting(govtJob({ title: "SSC CGL Tier 1 Answer Key 2026" }), govtHelpers), null)
})
test("govt: ADMIT CARD page → NO JobPosting", () => {
  assert.equal(buildGovtJobPosting(govtJob({ tab: "admit", title: "RRB NTPC Admit Card 2026" }), govtHelpers), null)
  assert.equal(buildGovtJobPosting(govtJob({ title: "UPSC NDA Admit Card 2026" }), govtHelpers), null)
})
test("govt: cut-off / syllabus / previous-paper / other → NO JobPosting", () => {
  for (const over of [
    { title: "SSC CHSL Cut Off 2026" },
    { tab: "syllabus", title: "IBPS Clerk Syllabus 2026" },
    { title: "IBPS Clerk Previous Year Question Papers" },
    { recordType: "other" },
    { recordType: "cutoff" },
    { recordType: "previous_paper" },
    { tab: "upcoming", title: "Upcoming: State PSC Notification" },
  ]) {
    assert.equal(buildGovtJobPosting(govtJob(over), govtHelpers), null, JSON.stringify(over))
  }
})
test("govt: a row without a real official URL is not genuine → NO JobPosting", () => {
  assert.equal(buildGovtJobPosting(govtJob({ officialUrl: "", applyUrl: "" }), govtHelpers), null)
})
test("govt: no employmentType is invented for government rows", () => {
  assert.ok(!("employmentType" in asObj(buildGovtJobPosting(govtJob(), govtHelpers))))
})

/* ---------------- guard: emitters really are wired to the builders ---------------- */

test("JSON-LD components are thin wrappers over the builders (no local now()/+30d)", () => {
  const root = process.cwd()
  for (const f of [
    "src/components/seo/PrivateJobJsonLd.tsx",
    "src/components/seo/WfhJobJsonLd.tsx",
    "src/components/seo/AbroadJobJsonLd.tsx",
    "src/components/govt/GovtJobJsonLd.tsx",
  ]) {
    const src = readFileSync(join(root, f), "utf8")
    assert.doesNotMatch(src, /new Date\(\)/, `${f} must not use the current time`)
    assert.doesNotMatch(src, /addDays|\+ ?30|30 \* 24/, `${f} must not derive an expiry`)
    assert.match(src, /build(Private|Wfh|Abroad|Govt)JobPosting/, `${f} must use a builder`)
  }
  const jc = readFileSync(join(root, "src/lib/seo/jobContent.ts"), "utf8")
  assert.doesNotMatch(jc, /addDaysIso/, "jobContent must not derive validThrough")
  const sch = readFileSync(join(root, "src/lib/seo/schema.ts"), "utf8")
  assert.doesNotMatch(sch, /new Date\(\)\.toISOString\(\)/, "schema.ts must not stamp the current time")
})

test("originOf / sameUrl helpers", () => {
  assert.equal(originOf("https://www.ibps.in/a/b?c=1"), "https://www.ibps.in")
  assert.equal(originOf("not a url"), undefined)
  assert.equal(sameUrl("https://a.example/x/", "https://a.example/x#frag"), true)
  assert.equal(sameUrl("https://a.example/x", "https://a.example/y"), false)
})

console.log(`\njobPosting tests: ${passed} passed, ${failed} failed`)
process.exitCode = failed ? 1 : 0
