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
  resolveCountryIso,
  originOf,
  sameUrl,
} from "./jobPostingRules"
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
    desc: "d",
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
    overview: "IBPS invites applications for Clerk posts.",
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

test("WFH: explicit 'Full-Time Remote' → TELECOMMUTE with applicantLocationRequirements", () => {
  const p = asObj(buildWfhJobPosting(wfhJob(), contentFor(employerJob(), { postedAt: POSTED })))
  assert.equal(p.jobLocationType, "TELECOMMUTE")
  assert.ok("applicantLocationRequirements" in p)
})
test("WFH: not automatically TELECOMMUTE — a hybrid/non-remote row emits no remote claim (and no JobPosting)", () => {
  const hybrid = wfhJob({ type: "Hybrid" })
  assert.equal(buildWfhJobPosting(hybrid, contentFor(employerJob(), { postedAt: POSTED })), null)
  const fullTime = wfhJob({ type: "Full Time" })
  assert.equal(buildWfhJobPosting(fullTime, contentFor(employerJob(), { postedAt: POSTED })), null)
  assert.equal(isExplicitlyFullyRemote("Hybrid"), false)
  assert.equal(isExplicitlyFullyRemote("Remote-first with 3 office days"), false)
  assert.equal(isExplicitlyFullyRemote("Full-Time Remote"), true)
  assert.equal(isExplicitlyFullyRemote("Work From Home"), true)
})
test("WFH: missing posting date → NO JobPosting", () => {
  assert.equal(buildWfhJobPosting(wfhJob({ posted_at: undefined }), contentFor(employerJob())), null)
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
