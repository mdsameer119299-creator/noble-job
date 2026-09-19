/**
 * sourceDateFlows.test.ts — JobPosting `datePosted` provenance, for BOTH flows.
 *
 *   npm run test:source-dates
 *
 * Google's datePosted is the ORIGINAL date the employer / source posted the job.
 * NobleJob's creation / ingestion / update / approval / last-confirmed time is a
 * different fact and never stands in for it.
 *
 *   AGGREGATED / CURATED (sourced elsewhere) → only the SOURCE's own publication date
 *        (`source_posted_at`; govt `source_published_at`). No source date → no JobPosting.
 *   EMPLOYER-authored (exists only on NobleJob) → the legitimate original-posting event
 *        is FIRST PUBLICATION (admin approval), recorded once into `source_posted_at` by
 *        `employerPublicationStamp`. Row creation / submission time is NOT that event.
 *        No stamped date → no JobPosting.
 *
 * Also reviews migration 20260727000003 (static): additive, nullable, no default, no backfill.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { originalPostingDate, employerPublicationStamp, SOURCE_DATE_FIELD } from "./postingDate"
import { buildPrivateJobPosting, buildWfhJobPosting, buildAbroadJobPosting, buildGovtJobPosting } from "./jobPostingBuilders"
import { buildJobContent } from "./jobContent"
import { mapPrivateJobRow } from "../services/jobMapper"
import { EMPLOYER_PROTECTED_JOB_FIELDS, stripProtectedJobFields } from "../services/jobLifecycle"
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
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1")
type Obj = Record<string, unknown>
const asObj = (v: unknown) => v as Obj

/** The real source/employer publication instant, and every NobleJob-internal timestamp (all different). */
const SOURCE = "2026-08-01T05:30:00.000Z"
const NOBLE_TIMES = {
  posted_at: "2026-09-15T10:00:00.000Z",
  created_at: "2026-09-15T10:00:01.000Z",
  updated_at: "2026-09-16T10:00:00.000Z",
  fetched_at: "2026-09-17T10:00:00.000Z",
  approved_at: "2026-09-18T10:00:00.000Z",
  last_confirmed_open_at: "2026-09-18T11:00:00.000Z",
}

const DESC =
  "We are looking for an Accounts Executive to maintain the company ledgers in Tally and reconcile vendor and bank statements every month.\n\n" +
  "The role reports to the finance manager and handles GST filing support, invoice processing and monthly closing for our Delhi office."

const privateJob = (over: Obj = {}) =>
  ({
    id: "3f2a9b6e-1111-4c2d-8a10-0a1b2c3d4e5f", title: "Accounts Executive", company: "Acme Pvt Ltd", logo: "AC", color: "#000",
    location: "Delhi", type: "Full Time", exp: "2 years", salary: "₹25,000 - ₹35,000 per month", cat: "Accounting", skills: ["Tally"],
    jobStatus: "LIVE_JOB", provenance: "EMPLOYER", employer_id: "emp-1", applyUrl: "", desc: DESC, posted: "", verified: true,
    source: "employer", board: "private", ...NOBLE_TIMES, ...over,
  }) as unknown as Job
const wfhJob = (over: Obj = {}) =>
  ({
    id: "wfh-1", title: "Customer Support", company: "Remote Co", logo: "RC", type: "Full-Time Remote", experience: "Fresher",
    salary: "₹20,000 per month", cat: "Support", qualification: "Graduate", description: DESC.replace("Accounts Executive", "Support Agent") + " This is a fully remote position open to candidates based in India.",
    provenance: "EMPLOYER", employer_id: "emp-1", source: "employer", status: "active", applicant_country: "IN", ...NOBLE_TIMES, ...over,
  }) as unknown as WfhJob
const abroadJob = (over: Obj = {}) =>
  ({
    id: "abroad-1", title: "Electrician", company: "Gulf Build LLC", logo: "GB", country: "UAE", location: "Dubai", type: "Full Time",
    salary: "AED 2,500 per month", experience: "3 years", category: "Construction", apply_url: "https://careers.gulfbuild.example/apply/1",
    description: DESC.replace("Accounts Executive", "Electrician"), provenance: "AGGREGATED", source: "himalayas", status: "active", ...NOBLE_TIMES, ...over,
  }) as unknown as AbroadJob
const govtJob = (over: Obj = {}) =>
  ({
    id: "ibps:clerk-2026", slug: "ibps-clerk-2026", title: "IBPS Clerk Recruitment 2026", org: "IBPS", post: "Clerk", vacancies: "6000",
    vacanciesStated: "6000", ageRange: "20-28 years", tab: "banking", status: "active", lastDate: "30 Sep 2026",
    officialUrl: "https://www.ibps.in/careers/clerk-2026.pdf", applyUrl: "https://ibpsonline.ibps.in/apply", location: "All India", state: "",
    qualification: "Any Graduate", salary: "", ...over,
  }) as unknown as GovtJob
const helpers = { regionFor: () => undefined, localityFor: () => undefined }
const contentFor = (j: { title: string; company: string; location?: string }, board: "private" | "wfh" | "abroad") =>
  buildJobContent({ board, title: j.title, company: j.company, location: j.location } as never)

const priv = (over: Obj = {}) => buildPrivateJobPosting(privateJob(over), contentFor(privateJob(), "private"))
const wfh = (over: Obj = {}) => buildWfhJobPosting(wfhJob(over), contentFor(wfhJob() as never, "wfh"))
const abroad = (over: Obj = {}) => buildAbroadJobPosting(abroadJob(over), contentFor(abroadJob() as never, "abroad"))

/* ───────────────────────── aggregated / sourced flow ───────────────────────── */

test("AGGREGATED (abroad): only NobleJob timestamps, no source date → NO JobPosting", () => {
  assert.equal(abroad(), null)
})
test("AGGREGATED (abroad): a real source date → JobPosting whose datePosted is THAT date, never any NobleJob time", () => {
  const p = asObj(abroad({ source_posted_at: SOURCE }))
  assert.equal(p["@type"], "JobPosting")
  assert.equal(p.datePosted, SOURCE)
  for (const [k, v] of Object.entries(NOBLE_TIMES)) assert.notEqual(p.datePosted, v, k)
})
test("originalPostingDate reads ONLY the source-date fields — every NobleJob-created timestamp is ignored", () => {
  for (const board of ["private", "wfh", "abroad", "govt"] as const) {
    assert.equal(originalPostingDate({ ...NOBLE_TIMES, sourcePostedAt: undefined } as never, board), undefined, board)
  }
  assert.equal(SOURCE_DATE_FIELD.private, "source_posted_at")
  assert.equal(SOURCE_DATE_FIELD.wfh, "source_posted_at")
  assert.equal(SOURCE_DATE_FIELD.abroad, "source_posted_at")
  assert.equal(SOURCE_DATE_FIELD.govt, "source_published_at")
})
test("a missing, unparseable or FUTURE source date is 'no date' (never replaced by now / posted_at)", () => {
  assert.equal(originalPostingDate({ source_posted_at: null }, "abroad"), undefined)
  assert.equal(originalPostingDate({ source_posted_at: "not a date" }, "abroad"), undefined)
  assert.equal(originalPostingDate({ source_posted_at: "2999-01-01T00:00:00Z" }, "abroad"), undefined)
  assert.equal(abroad({ source_posted_at: "2999-01-01T00:00:00Z" }), null)
})
test("GOVT: created / fetched / updated / last-confirmed time is never the date; source_published_at is", () => {
  assert.equal(buildGovtJobPosting(govtJob({ ...NOBLE_TIMES }), helpers), null)
  const p = asObj(buildGovtJobPosting(govtJob({ sourcePublishedAt: "2026-08-10T00:00:00.000Z", ...NOBLE_TIMES }), helpers))
  assert.equal(p.datePosted, "2026-08-10T00:00:00.000Z")
})
test("the mapper never derives source_posted_at from posted_at / created_at", () => {
  const row = { id: "3f2a9b6e-1111-4c2d-8a10-0a1b2c3d4e5f", title: "t", company: "c", location: "Delhi", ...NOBLE_TIMES }
  assert.equal(asObj(mapPrivateJobRow(row)).source_posted_at ?? undefined, undefined)
  assert.equal(asObj(mapPrivateJobRow({ ...row, source_posted_at: SOURCE })).source_posted_at, SOURCE)
})
test("static: every builder takes datePosted from originalPostingDate() — never posted_at / created_at / new Date()", () => {
  const src = strip(read("src/lib/seo/jobPostingBuilders.ts"))
  const uses = src.match(/datePosted\s*(:|=)\s*originalPostingDate\(/g) ?? []
  assert.ok(uses.length >= 3, "private/wfh/abroad builders")
  assert.match(src, /const datePosted = originalPostingDate\(job, "govt"\)/)
  assert.doesNotMatch(src, /datePosted[^\n]*(posted_at|created_at|updated_at|new Date|Date\.now|fetched_at|last_confirmed)/)
  assert.doesNotMatch(strip(read("src/lib/seo/schema.ts")), /datePosted\s*(:|=)[^\n]*(new Date|Date\.now)/, "schema never manufactures a datePosted")
})

/* ───────────────────────── employer-authored flow ───────────────────────── */

test("EMPLOYER-authored, submitted (posted_at / created_at set) but never published → NO JobPosting", () => {
  assert.equal(priv(), null)
  assert.equal(wfh(), null)
  assert.equal(abroad({ provenance: "EMPLOYER", employer_id: "emp-1", source: "employer" }), null)
})
test("EMPLOYER-authored with the first-publication date recorded → JobPosting dated by THAT event, not posted_at/created_at/approved_at", () => {
  const stamp = "2026-09-18T09:00:00.000Z"
  for (const p of [priv({ source_posted_at: stamp }), wfh({ source_posted_at: stamp }), abroad({ provenance: "EMPLOYER", employer_id: "emp-1", source: "employer", source_posted_at: stamp })]) {
    const o = asObj(p)
    assert.equal(o["@type"], "JobPosting")
    assert.equal(o.datePosted, stamp)
    assert.equal(o.directApply, true, "employer application is delivered to the owning employer")
  }
})
test("employerPublicationStamp: EMPLOYER + employer_id + no date yet → the first-publication instant", () => {
  const now = new Date("2026-09-19T12:00:00.000Z")
  assert.equal(employerPublicationStamp({ provenance: "EMPLOYER", employer_id: "e1", source_posted_at: null }, now), now.toISOString())
  assert.equal(employerPublicationStamp({ provenance: "employer", employer_id: "e1" }, now), now.toISOString())
})
test("employerPublicationStamp NEVER overwrites an existing date (re-approval, admin correction)", () => {
  assert.equal(employerPublicationStamp({ provenance: "EMPLOYER", employer_id: "e1", source_posted_at: SOURCE }), null)
})
test("employerPublicationStamp does nothing for jobs NOT authored on NobleJob (aggregated / curated / synthetic / unowned)", () => {
  for (const provenance of ["AGGREGATED", "CURATED", "OFFICIAL", "SYNTHETIC", "UNCLASSIFIED", "", undefined, null]) {
    assert.equal(employerPublicationStamp({ provenance, employer_id: "e1" }), null, String(provenance))
  }
  assert.equal(employerPublicationStamp({ provenance: "EMPLOYER", employer_id: null }), null)
  assert.equal(employerPublicationStamp({ provenance: "EMPLOYER", employer_id: "  " }), null)
  assert.equal(employerPublicationStamp(null), null)
})
test("static: approveJob stamps ONCE, only after the status update succeeded, only into an empty column, tolerating a missing column", () => {
  const src = read("src/lib/services/adminService.ts")
  const approve = src.slice(src.indexOf("export async function approveJob"), src.indexOf("export async function rejectJob"))
  assert.match(approve, /if \(result\.error\) return result[\s\S]*await stampFirstPublication\(table, id\)/)
  const stamp = src.slice(src.indexOf("async function stampFirstPublication"), src.indexOf("export async function approveJob"))
  assert.match(stamp, /employerPublicationStamp\(/)
  assert.match(stamp, /\.is\("source_posted_at"[^)]*null\)/, "write is guarded by IS NULL (never overwrites)")
  assert.match(stamp, /isMissingColumnError/, "tolerates the migration not being applied yet")
  assert.match(stamp, /catch/, "never fails the approval")
  assert.doesNotMatch(strip(src), /source_posted_at:\s*(new Date|posted_at|created_at)/)
})
test("an employer cannot choose or rewrite the date: source-date fields are protected on edit, and absent from the insert", () => {
  for (const f of ["source_posted_at", "sourcePostedAt", "source_published_at", "sourcePublishedAt"]) {
    assert.ok((EMPLOYER_PROTECTED_JOB_FIELDS as readonly string[]).includes(f), f)
  }
  assert.deepEqual(stripProtectedJobFields({ title: "t", source_posted_at: "2020-01-01", sourcePostedAt: "2020-01-01" }), { title: "t" })
  assert.doesNotMatch(strip(read("src/app/api/employer/[[...params]]/route.ts")), /source_posted_at|sourcePostedAt/)
})
test("existing rows are NOT backfilled: nothing derives source_posted_at from another column (code or SQL)", () => {
  for (const f of ["src/lib/services/adminService.ts", "src/lib/services/jobMapper.ts", "src/lib/seo/postingDate.ts"]) {
    assert.doesNotMatch(strip(read(f)), /source_posted_at[^\n]*(=|:)\s*[^\n]*(posted_at|created_at|updated_at)\b(?!.*source_posted_at)/, f)
  }
})

/* ───────────────────────── visible page shows the schema date ───────────────────────── */

test("the visible page shows the date JobPosting cites ('Originally Posted On'), and NobleJob's own listing date is labelled as such", () => {
  const base = { board: "private", title: "Accounts Executive", company: "Acme", location: "Delhi", postedAt: NOBLE_TIMES.posted_at } as never
  const withSource = buildJobContent({ ...(base as Obj), sourcePostedAt: SOURCE } as never)
  const labels = withSource.importantDates.map(d => d.label)
  assert.ok(labels.includes("Originally Posted On"))
  assert.ok(labels.includes("Listed on Noble Job"))
  assert.ok(!labels.includes("Job Posted On"))
  const without = buildJobContent(base)
  assert.ok(!without.importantDates.some(d => /Originally/.test(d.label)), "no source date → no 'Originally posted' claim")
})
test("the visible page shows the identifier JobPosting cites (Job ID), and the govt JobPosting carries none", () => {
  const c = buildJobContent({ board: "private", title: "t", company: "c", location: "Delhi", jobId: "abc-123" } as never)
  assert.deepEqual(c.importantDates.find(d => d.label === "Job ID"), { label: "Job ID", value: "abc-123" })
  for (const b of ["private", "wfh", "abroad"]) assert.match(read(`src/app/jobs/${b}/[id]/page.tsx`), /jobId:\s*job\.id/, b)
  const p = asObj(buildGovtJobPosting(govtJob({ sourcePublishedAt: "2026-08-10T00:00:00.000Z" }), helpers))
  assert.ok(!("identifier" in p))
})

/* ───────────────────────── migration 20260727000003 (static review) ───────────────────────── */

test("migration: additive, nullable, no default, no backfill, no destructive statement — on jobs / wfh_jobs / abroad_jobs only", () => {
  const sql = read("supabase/migrations/20260727000003_job_source_posted_at.sql")
  const code = sql.replace(/^\s*--.*$/gm, "").replace(/COMMENT ON COLUMN[\s\S]*?';/g, "")
  const adds = code.match(/ALTER TABLE public\.(\w+)\s+ADD COLUMN IF NOT EXISTS source_posted_at TIMESTAMPTZ;/g) ?? []
  assert.equal(adds.length, 3)
  for (const t of ["jobs", "wfh_jobs", "abroad_jobs"]) assert.match(code, new RegExp(`ALTER TABLE public\\.${t}\\s+ADD COLUMN IF NOT EXISTS source_posted_at TIMESTAMPTZ;`))
  assert.doesNotMatch(code, /\bDEFAULT\b|NOT NULL|\bNOW\s*\(|CURRENT_TIMESTAMP/i, "nullable, and no timestamp default")
  assert.doesNotMatch(code, /\b(UPDATE|INSERT|DELETE|TRUNCATE|DROP|RENAME|CREATE\s+(TRIGGER|FUNCTION|INDEX)|ALTER\s+COLUMN)\b/i, "no data change, no destructive change, no trigger")
  assert.doesNotMatch(code, /posted_at\s*[,=]|created_at|updated_at|last_confirmed_open_at/, "nothing reads another column to populate it")
  assert.ok(/^BEGIN;/m.test(code) && /^COMMIT;/m.test(code), "transactional")
  // Every COMMENT literal is well-formed: no stray apostrophe inside the quoted text.
  for (const m of sql.matchAll(/COMMENT ON COLUMN[^\n]*\n\s*IS '([\s\S]*?)';/g)) assert.ok(!m[1].includes("'"), "unescaped apostrophe in a COMMENT literal")
})
test("migration down script drops only the column it added, and nothing else", () => {
  const down = read("supabase/migrations/20260727000003_job_source_posted_at.down.sql").replace(/^\s*--.*$/gm, "")
  assert.equal((down.match(/DROP COLUMN IF EXISTS source_posted_at/g) ?? []).length, 3)
  assert.doesNotMatch(down.replace(/DROP COLUMN IF EXISTS source_posted_at/g, ""), /\bDROP\b|DELETE|TRUNCATE/i)
})

console.log(`\nsource-date flow tests: ${passed} passed, ${failed} failed`)
process.exitCode = failed ? 1 : 0
