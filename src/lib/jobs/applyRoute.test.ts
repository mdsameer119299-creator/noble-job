/**
 * applyRoute.test.ts — application integrity + schema-vs-page fidelity.
 *
 *   npm run test:apply-route
 *
 * A JobPosting promises the candidate can apply. It is emitted only when Apply really
 * goes somewhere real: the legitimate NobleJob employer workflow (application DELIVERED
 * to the owning employer) or a redirect to the employer's / official source's own page.
 * `directApply` is true only for the former. Also: every JobPosting field the audit
 * lists is either supported by stored data + visible page content, or omitted.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { applyRouteFor, govtApplyRoute, isGenuineApplyRoute } from "./applyRoute"
import { classifyProvenance, isGenericGovPortalUrl, isGenuine, hasRealApplyUrl } from "./provenance"
import { govtClassifiable } from "./govtProvenance"
import { buildPrivateJobPosting, buildWfhJobPosting, buildAbroadJobPosting, buildGovtJobPosting } from "../seo/jobPostingBuilders"
import { buildJobContent } from "../seo/jobContent"
import { parseSalary } from "../seo/salary"
import { jobPostingSchema } from "../seo/schema"
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
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8")
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1")
type Obj = Record<string, unknown>
const asObj = (v: unknown) => v as Obj

const SOURCE = "2026-08-01T05:30:00.000Z"
const DESC =
  "We are looking for an Accounts Executive to maintain the company ledgers in Tally and reconcile vendor and bank statements every month.\n\n" +
  "The role reports to the finance manager and handles GST filing support, invoice processing and monthly closing for our Delhi office."
const REAL_URL = "https://careers.gulfbuild.example/apply/1"

const privateJob = (over: Obj = {}) =>
  ({
    id: "3f2a9b6e-1111-4c2d-8a10-0a1b2c3d4e5f", title: "Accounts Executive", company: "Acme Pvt Ltd", logo: "AC", color: "#000",
    location: "Delhi", type: "Full Time", exp: "2 years", salary: "₹25,000 - ₹35,000 per month", cat: "Accounting", skills: ["Tally"],
    jobStatus: "LIVE_JOB", provenance: "EMPLOYER", employer_id: "emp-1", applyUrl: "", desc: DESC, posted: "", verified: true,
    source: "employer", board: "private", source_posted_at: SOURCE, ...over,
  }) as unknown as Job
const wfhJob = (over: Obj = {}) =>
  ({
    id: "wfh-1", title: "Customer Support", company: "Remote Co", logo: "RC", type: "Full-Time Remote", experience: "Fresher",
    salary: "₹20,000 per month", cat: "Support", qualification: "Graduate", source_posted_at: SOURCE, applicant_country: "IN",
    description: DESC.replace("Accounts Executive", "Support Agent") + " This is a fully remote position open to candidates based in India.",
    provenance: "EMPLOYER", employer_id: "emp-1", source: "employer", status: "active", ...over,
  }) as unknown as WfhJob
const abroadJob = (over: Obj = {}) =>
  ({
    id: "abroad-1", title: "Electrician", company: "Gulf Build LLC", logo: "GB", country: "UAE", location: "Dubai", type: "Full Time",
    salary: "AED 2,500 per month", experience: "3 years", category: "Construction", apply_url: REAL_URL, source_posted_at: SOURCE,
    description: DESC.replace("Accounts Executive", "Electrician"), provenance: "AGGREGATED", source: "himalayas", status: "active", ...over,
  }) as unknown as AbroadJob
const govtJob = (over: Obj = {}) =>
  ({
    id: "ibps:clerk-2026", slug: "ibps-clerk-2026", title: "IBPS Clerk Recruitment 2026", org: "IBPS", post: "Clerk", vacancies: "6000",
    vacanciesStated: "6000", ageRange: "20-28 years", tab: "banking", status: "active", lastDate: "30 Sep 2026",
    officialUrl: "https://www.ibps.in/careers/clerk-2026.pdf", applyUrl: "https://ibpsonline.ibps.in/apply", sourcePublishedAt: "2026-08-10T00:00:00.000Z",
    location: "All India", state: "", qualification: "Any Graduate", salary: "", ...over,
  }) as unknown as GovtJob
const helpers = { regionFor: () => undefined, localityFor: () => undefined }
const c = (j: { title: string; company: string; location?: string }, board: "private" | "wfh" | "abroad") =>
  buildJobContent({ board, title: j.title, company: j.company, location: j.location } as never)

/* ───────────────────────────── the route model ───────────────────────────── */

test("EMPLOYER job with an owner → route 'employer' on every board", () => {
  assert.equal(applyRouteFor("private", privateJob() as never), "employer")
  assert.equal(applyRouteFor("wfh", wfhJob() as never), "employer")
  assert.equal(applyRouteFor("abroad", abroadJob({ provenance: "EMPLOYER", employer_id: "emp-1", source: "employer" }) as never), "employer")
})
test("EMPLOYER without an owning employer is not genuine → 'none' (its application would reach nobody)", () => {
  assert.equal(applyRouteFor("private", privateJob({ employer_id: undefined }) as never), "none")
})
test("aggregated / curated jobs with a REAL external URL → 'external' on every board (the candidate is sent to the source, never a NobleJob form)", () => {
  assert.equal(applyRouteFor("private", privateJob({ provenance: "AGGREGATED", employer_id: undefined, source: "himalayas", applyUrl: REAL_URL }) as never), "external")
  assert.equal(applyRouteFor("private", privateJob({ provenance: "CURATED", employer_id: undefined, source: "curated by editorial", applyUrl: REAL_URL }) as never), "external")
  assert.equal(applyRouteFor("wfh", wfhJob({ provenance: "AGGREGATED", employer_id: undefined, source: "himalayas", apply_url: REAL_URL }) as never), "external")
})
test("aggregated / curated with a placeholder or missing URL → 'none' (no destination, no employer)", () => {
  for (const url of ["#", "", "https://example.com/jobs/1", "ftp://x.y/z"]) {
    assert.equal(applyRouteFor("private", privateJob({ provenance: "AGGREGATED", employer_id: undefined, source: "himalayas", applyUrl: url }) as never), "none", url)
    assert.equal(applyRouteFor("wfh", wfhJob({ provenance: "CURATED", employer_id: undefined, source: "curated by editorial", apply_url: url }) as never), "none", url)
  }
})
test("abroad AGGREGATED with a real URL → 'external'; placeholder / missing URL → 'none'", () => {
  assert.equal(applyRouteFor("abroad", abroadJob() as never), "external")
  assert.equal(applyRouteFor("abroad", abroadJob({ apply_url: "#" }) as never), "none")
  assert.equal(applyRouteFor("abroad", abroadJob({ apply_url: "" }) as never), "none")
  assert.equal(applyRouteFor("abroad", abroadJob({ provenance: "CURATED", source: "curated by editorial" }) as never), "external")
})
test("sample / unclassified jobs → 'none' (disabled or no action)", () => {
  assert.equal(applyRouteFor("private", privateJob({ provenance: "SYNTHETIC" }) as never), "none")
  assert.equal(applyRouteFor("abroad", abroadJob({ provenance: undefined, source: "unknown", employer_id: undefined }) as never), "none")
  assert.equal(applyRouteFor("wfh", wfhJob({ id: "ver-wfh-7", provenance: undefined, employer_id: undefined, source: "live feed" }) as never), "none")
})
test("only 'employer' and 'external' are genuine application routes", () => {
  assert.equal(isGenuineApplyRoute("employer"), true)
  assert.equal(isGenuineApplyRoute("external"), true)
  assert.equal(isGenuineApplyRoute("none"), false)
})

/* ───────────────────────────── government destination ───────────────────────────── */

test("isGenericGovPortalUrl: the india.gov.in catch-all is generic; a recruiting body's own site is not", () => {
  for (const u of ["https://india.gov.in", "https://india.gov.in/", "http://www.india.gov.in/", "https://www.india.gov.in/?ref=x"]) assert.equal(isGenericGovPortalUrl(u), true, u)
  for (const u of ["https://www.ibps.in/careers/clerk-2026.pdf", "https://india.gov.in/spotlight/some-scheme", "", undefined, null]) assert.equal(isGenericGovPortalUrl(u as never), false, String(u))
})
test("a govt row whose ONLY link is the generic portal is not OFFICIAL → not genuine, no apply route, no JobPosting", () => {
  const j = govtJob({ officialUrl: "https://india.gov.in/", applyUrl: "https://india.gov.in/", notificationPdf: undefined })
  assert.equal(classifyProvenance(govtClassifiable(j)), "UNCLASSIFIED")
  assert.equal(isGenuine(govtClassifiable(j)), false)
  assert.equal(govtApplyRoute(j), "none")
  assert.equal(buildGovtJobPosting(j, helpers), null)
})
test("a govt row with a real recruiting-body URL → OFFICIAL and 'external'; the generic portal is ignored beside a real one", () => {
  assert.equal(classifyProvenance(govtClassifiable(govtJob())), "OFFICIAL")
  assert.equal(govtApplyRoute(govtJob()), "external")
  assert.equal(govtApplyRoute(govtJob({ applyUrl: "https://india.gov.in/" })), "external", "officialUrl is real")
  const noApply = govtJob({ applyUrl: "" })
  assert.equal(govtApplyRoute(noApply), "external", "a real official page is the destination")
  assert.equal(hasRealApplyUrl("https://www.ibps.in/"), true)
})

/* ───────────────────────────── JobPosting is gated on the route ───────────────────────────── */

test("private / WFH: employer flow → JobPosting with directApply TRUE; aggregated / curated (even with an external Apply link) → NO JobPosting", () => {
  const p = asObj(buildPrivateJobPosting(privateJob(), c(privateJob(), "private")))
  assert.equal(p.directApply, true)
  assert.equal(asObj(buildWfhJobPosting(wfhJob(), c(wfhJob() as never, "wfh"))).directApply, true)
  const agg = privateJob({ provenance: "AGGREGATED", employer_id: undefined, source: "himalayas", applyUrl: REAL_URL })
  assert.equal(buildPrivateJobPosting(agg, c(agg, "private")), null)
  const aggW = wfhJob({ provenance: "AGGREGATED", employer_id: undefined, source: "himalayas", apply_url: REAL_URL })
  assert.equal(buildWfhJobPosting(aggW, c(aggW as never, "wfh")), null)
})
test("abroad: external redirect → JobPosting with directApply FALSE; curated (unchanged) / placeholder URL → NO JobPosting", () => {
  assert.equal(asObj(buildAbroadJobPosting(abroadJob(), c(abroadJob() as never, "abroad"))).directApply, false)
  for (const over of [{ provenance: "CURATED", source: "curated by editorial" }, { apply_url: "#" }, { apply_url: "" }]) {
    const j = abroadJob(over)
    assert.equal(buildAbroadJobPosting(j, c(j as never, "abroad")), null, JSON.stringify(over))
  }
})
test("govt: directApply is false (the application is completed on the official portal, not on NobleJob)", () => {
  assert.equal(asObj(buildGovtJobPosting(govtJob(), helpers)).directApply, false)
})
test("directApply is true ONLY for the employer route across every builder", () => {
  const all = [
    asObj(buildPrivateJobPosting(privateJob(), c(privateJob(), "private"))),
    asObj(buildWfhJobPosting(wfhJob(), c(wfhJob() as never, "wfh"))),
    asObj(buildAbroadJobPosting(abroadJob(), c(abroadJob() as never, "abroad"))),
    asObj(buildAbroadJobPosting(abroadJob({ provenance: "EMPLOYER", employer_id: "e", source: "employer" }), c(abroadJob() as never, "abroad"))),
    asObj(buildGovtJobPosting(govtJob(), helpers)),
  ]
  assert.deepEqual(all.map(p => p.directApply), [true, true, false, true, false])
})
test("the apply control and JobPosting use ONE decision: every apply control renders applyStateFor; the link out exists only for the 'external' state, never href='#'", () => {
  const src = strip(read("src/components/abroad/AbroadApplySlot.tsx"))
  assert.match(src, /applyStateFor\('abroad', job, job\.company\)/)
  assert.doesNotMatch(src, /href=["']#["']/)
  const button = strip(read("src/components/jobs/ApplyButton.tsx"))
  assert.match(button, /state\.kind === 'external' && state\.href/)
  assert.doesNotMatch(button, /href=["']#["']/)
  const builders = strip(read("src/lib/seo/jobPostingBuilders.ts"))
  assert.equal((builders.match(/isJobPostingRoute\(/g) ?? []).length, 3, "private / WFH / abroad builders gate on the route")
  assert.equal((builders.match(/isGenuineApplyRoute\(/g) ?? []).length, 1, "the govt builder gates on the govt route")
  assert.match(builders, /directApply:\s*isDirectApply\(route\)/)
  assert.doesNotMatch(builders, /directApply:\s*true/, "directApply never defaults to true")
  assert.match(builders, /directApply:\s*false/)
})

/* ───────────────────────────── schema fields ⊆ stored data + visible page ───────────────────────────── */

test("baseSalary only when the stored salary states BOTH currency and pay period — no guessed INR / per-year", () => {
  const withSalary = (salary: string) => asObj(buildPrivateJobPosting(privateJob({ salary }), c(privateJob(), "private")))
  assert.ok(!("baseSalary" in withSalary("25000-35000")))
  assert.ok(!("baseSalary" in withSalary("₹30,000")))
  assert.ok(!("baseSalary" in withSalary("Competitive")))
  const ok = asObj(asObj(withSalary("₹25,000 - ₹35,000 per month")).baseSalary)
  assert.equal(ok.currency, "INR")
  assert.equal(asObj(asObj(ok.value)).unitText, "MONTH")
  assert.equal(parseSalary("25000-35000", { requireExplicit: true }), null)
  assert.equal(parseSalary("$50 per hour", { requireExplicit: true })?.currency, "USD")
  // The lenient page-copy parser is unchanged (it is display copy, not structured data).
  assert.ok(parseSalary("25000-35000"), "display parser still defaults")
})
test("industry / qualifications appear only when the record states them", () => {
  assert.equal(asObj(buildPrivateJobPosting(privateJob({ cat: "" }), c(privateJob(), "private"))).industry, undefined)
  assert.equal(asObj(buildPrivateJobPosting(privateJob(), c(privateJob(), "private"))).industry, "Accounting")
  assert.ok(!("qualifications" in asObj(buildPrivateJobPosting(privateJob(), c(privateJob(), "private")))), "private records store no qualification")
  assert.ok(!("qualifications" in asObj(buildAbroadJobPosting(abroadJob(), c(abroadJob() as never, "abroad")))))
  assert.ok(!("qualifications" in asObj(buildGovtJobPosting(govtJob(), helpers))), "govt states education via educationRequirements")
  assert.equal(asObj(buildWfhJobPosting(wfhJob(), c(wfhJob() as never, "wfh"))).qualifications, "Graduate")
  assert.equal(asObj(buildWfhJobPosting(wfhJob({ qualification: "" }), c(wfhJob() as never, "wfh"))).qualifications, undefined)
})
test("identifier is the visible Job ID and is named for the site that publishes it", () => {
  const p = asObj(jobPostingSchema({ title: "t", description: "d", url: "/x", organizationName: "o", location: "l", datePosted: SOURCE, addressCountry: "IN", identifier: "abc" }))
  const id = asObj(p.identifier)
  assert.equal(id["@type"], "PropertyValue")
  assert.equal(id.value, "abc")
  assert.ok(typeof id.name === "string" && (id.name as string).length > 0 && !/^job$/i.test(id.name as string))
  const built = asObj(buildPrivateJobPosting(privateJob(), buildJobContent({ board: "private", title: "t", company: "c", location: "Delhi", jobId: privateJob().id } as never)))
  assert.equal(asObj(built.identifier).value, privateJob().id)
  assert.ok(buildJobContent({ board: "private", title: "t", company: "c", location: "Delhi", jobId: privateJob().id } as never).importantDates.some(d => d.label === "Job ID" && d.value === privateJob().id))
})
test("WFH: the applicant-country requirement is shown on the page (badge) as well as in the schema", () => {
  const page = read("src/app/jobs/wfh/[id]/page.tsx")
  assert.match(page, /resolveApplicantCountry/)
  assert.match(page, /countryDisplayName/)
  assert.match(page, /Open to candidates in/)
  const p = asObj(buildWfhJobPosting(wfhJob(), c(wfhJob() as never, "wfh")))
  assert.equal(p.jobLocationType, "TELECOMMUTE")
  assert.equal(asObj(asObj(p.applicantLocationRequirements)).name, "IN")
})
test("validThrough only from the employer's real deadline, and that deadline is shown on the page ('Application Closes')", () => {
  const withDeadline = buildJobContent({ board: "private", title: "t", company: "c", location: "Delhi", applicationDeadline: "2030-12-31T00:00:00Z" } as never)
  assert.ok(withDeadline.validThrough)
  assert.ok(withDeadline.importantDates.some(d => d.label === "Application Closes" && /2030/.test(d.value)))
  const none = buildJobContent({ board: "private", title: "t", company: "c", location: "Delhi" } as never)
  assert.equal(none.validThrough, undefined)
  assert.ok(!("validThrough" in asObj(buildPrivateJobPosting(privateJob(), none))))
})
test("employer, location, remote status, description, employment type are the record's own stored + visible values", () => {
  const p = asObj(buildPrivateJobPosting(privateJob(), c(privateJob(), "private")))
  assert.equal(asObj(p.hiringOrganization).name, "Acme Pvt Ltd")
  assert.equal(p.title, "Accounts Executive")
  assert.equal(p.employmentType, "FULL_TIME")
  assert.match(String(p.description), /Tally/)
  assert.ok(!("jobLocationType" in p), "a physical private job is not TELECOMMUTE")
})

console.log(`\napply-route / schema-fidelity tests: ${passed} passed, ${failed} failed`)
process.exitCode = failed ? 1 : 0
