/**
 * renderable.test.ts — "NO EMPTY JOBS ANYWHERE" regression suite.
 *
 *   npm run test:no-empty-jobs
 *
 * An incomplete / placeholder / unknown-provenance record is never shown as a job:
 * not listed, not counted, not related, not in the sitemap, no JobPosting, and a
 * direct URL is a 404. The stored data is NOT deleted or edited — it is simply not
 * exposed. These tests cover the server paths (services, mapper, sitemap, JobPosting,
 * counts) and the client paths (list mappers, cards, panels).
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  checkJobRecord,
  isRenderableJob,
  renderableOrNull,
  filterRenderable,
  filterActionable,
  isActionableJob,
  isPlaceholderText,
  isRealDisplayValue,
  displayValue,
  isValidJobId,
  isUsableLiveJob,
  paginateRenderable,
} from "./renderable"
import { mapPrivateJobRow } from "../services/jobMapper"
import { toListingJobs, toLiveExternalJobs, toRenderableWfhJobs, toRenderableAbroadJobs, toRenderableGovtJobs } from "./clientRecords"
import { relatedJobHref, toRelatedLinks } from "../seo/relatedLinks"
import { jobRowsToSitemapEntries, type SitemapJobRow } from "../seo/sitemapPolicy"
import { buildPrivateJobPosting } from "../seo/jobPostingBuilders"
import { buildJobContent } from "../seo/jobContent"
import { PRIVATE_INVENTORY, WFH_INVENTORY, ABROAD_INVENTORY, renderablePrivateInventory, renderableWfhInventory, renderableAbroadInventory, getPrivateInventoryCounts, getWfhInventoryCounts, getAbroadInventoryCounts } from "../data/jobInventory"
import { getPrivateJobsLocal, getPrivateJobByIdLocal } from "../services/jobLocal"
import { getWfhJobsPaginatedLocal, getWfhJobByIdLocal } from "../services/wfhJobLocal"
import { getAbroadJobsPaginatedLocal, getAbroadJobByIdLocal } from "../services/abroadJobLocal"
import { getJobById } from "../services/jobService"
import { getWfhJobById } from "../services/wfhJobService"
import { getAbroadJobById } from "../services/abroadJobService"
import type { Job } from "@/types/job"
import type { GovtJob } from "@/types/govtJob"

let passed = 0
let failed = 0
function test(name: string, fn: () => void | Promise<void>) {
  pending.push(
    Promise.resolve()
      .then(fn)
      .then(() => { passed++; console.log(`  PASS  ${name}`) })
      .catch(err => { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }),
  )
}
const pending: Promise<unknown>[] = []
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8")

type Obj = Record<string, unknown>

/* ------------------------------ fixtures ------------------------------ */

const DESC = "Maintain the company ledgers in Tally and reconcile vendor and bank statements every month for the Delhi office."

/** A COMPLETE, genuine, open employer job. */
const good = (over: Obj = {}): Job =>
  ({
    id: "3f2a9b6e-1111-4c2d-8a10-0a1b2c3d4e5f",
    title: "Accounts Executive",
    company: "Acme Pvt Ltd",
    logo: "AC", color: "#000",
    location: "Delhi",
    type: "Full Time", exp: "2 years", salary: "₹25,000 - ₹35,000 per month", cat: "Accounting", skills: ["Tally"],
    jobStatus: "LIVE_JOB", provenance: "EMPLOYER", employer_id: "emp-1",
    applyUrl: "", desc: DESC, description: DESC, posted: "", verified: true, source: "employer", board: "private", status: "active",
    ...over,
  }) as unknown as Job

const goodWfh = (over: Obj = {}) => ({
  id: "wfh-real-1", title: "Customer Support", company: "Remote Co", description: DESC, provenance: "AGGREGATED",
  apply_url: "https://careers.remoteco.example/apply/1", status: "active", source: "himalayas", ...over,
})
const goodAbroad = (over: Obj = {}) => ({
  id: "abroad-real-1", title: "Electrician", company: "Gulf Build LLC", country: "UAE", location: "Dubai", description: DESC,
  provenance: "AGGREGATED", apply_url: "https://careers.gulfbuild.example/apply/1", status: "active", source: "himalayas", ...over,
})
const goodGovt = (over: Obj = {}) => ({
  id: "ibps:clerk-2026", slug: "ibps-clerk-2026", title: "IBPS Clerk Recruitment 2026", org: "IBPS", post: "Clerk",
  officialUrl: "https://www.ibps.in/careers/clerk-2026.pdf", status: "active", ...over,
})

const BOARDS = ["private", "wfh", "abroad"] as const
const goodFor = (b: (typeof BOARDS)[number], over: Obj = {}) =>
  (b === "private" ? good(over) : b === "wfh" ? goodWfh(over) : goodAbroad(over)) as never

/* ---------------------- the fixtures themselves are valid ---------------------- */

test("sanity: the COMPLETE fixtures are renderable (so every exclusion below is caused by the defect)", () => {
  for (const b of BOARDS) assert.equal(isRenderableJob(goodFor(b), b), true, b)
  assert.equal(isRenderableJob(goodGovt() as never, "govt"), true, "govt")
})

/* ----------------- incomplete database row → excluded from inventory ----------------- */

test("incomplete DB rows → excluded from the inventory (mapper + gate), while complete rows stay", () => {
  const rows: Obj[] = [
    { id: "ok-1", title: "Accounts Executive", company: "Acme", location: "Delhi", description: DESC, provenance: "EMPLOYER", employer_id: "e", is_verified: true, status: "active" },
    { id: "no-title", company: "Acme", location: "Delhi", description: DESC, provenance: "EMPLOYER", employer_id: "e" },
    { id: "no-company", title: "Role", location: "Delhi", description: DESC, provenance: "EMPLOYER", employer_id: "e" },
    { id: "no-desc", title: "Role", company: "Acme", location: "Delhi", provenance: "EMPLOYER", employer_id: "e" },
    { id: "no-loc", title: "Role", company: "Acme", description: DESC, provenance: "EMPLOYER", employer_id: "e" },
    { title: "Role", company: "Acme", location: "Delhi", description: DESC, provenance: "EMPLOYER", employer_id: "e" },
    {},
  ]
  const kept = filterRenderable(rows.map(mapPrivateJobRow), "private").map(j => j.id)
  assert.deepEqual(kept, ["ok-1"])
})

test("the mapper NEVER invents a value: an empty row maps to empty strings, not 'undefined' / 'India' / '#' / 'Competitive'", () => {
  const j = mapPrivateJobRow({ id: "x" })
  const dump = JSON.stringify(j)
  assert.doesNotMatch(dump, /undefined|"null"|NaN|"India"|"#"|Competitive|Full Time|Noble Job/)
  assert.equal(j.location, "")
  assert.equal(j.applyUrl, "")
  assert.equal(j.company, "")
  assert.equal(isRenderableJob(j, "private"), false)
})

test("the mapper exposes an allow-list of raw columns — internal columns never reach a public response", () => {
  const j = mapPrivateJobRow({ id: "x", title: "t", company: "c", review_due_at: "2026-01-01", last_confirmed_open_at: "2026-01-01", closed_at: "2026-01-01", employer_email: "a@b.c" }) as Obj
  for (const k of ["review_due_at", "last_confirmed_open_at", "closed_at", "employer_email"]) assert.ok(!(k in j), k)
})

/* ------------------------------ missing pieces ------------------------------ */

test("missing / empty / placeholder TITLE → excluded on every board", () => {
  for (const b of BOARDS) {
    for (const title of [undefined, null, "", "   ", "undefined", "null", "N/A", "Untitled", "-"]) {
      assert.equal(isRenderableJob(goodFor(b, { title }), b), false, `${b} title=${JSON.stringify(title)}`)
    }
  }
  assert.equal(isRenderableJob(goodGovt({ title: "Untitled Notification" }) as never, "govt"), false)
  assert.equal(isRenderableJob(goodGovt({ title: "" }) as never, "govt"), false)
})

test("missing / placeholder COMPANY → excluded (govt: organisation)", () => {
  for (const b of BOARDS) {
    for (const company of [undefined, "", "  ", "undefined", "null", "N/A", "Company"]) {
      assert.equal(isRenderableJob(goodFor(b, { company }), b), false, `${b} company=${JSON.stringify(company)}`)
    }
  }
  for (const org of [undefined, "", "undefined", "TBA"]) {
    assert.equal(isRenderableJob(goodGovt({ org }) as never, "govt"), false, `govt org=${JSON.stringify(org)}`)
  }
})

test("missing / stub / placeholder DESCRIPTION (where required) → excluded; govt rows need none", () => {
  for (const b of BOARDS) {
    const key = b === "private" ? "desc" : "description"
    for (const v of [undefined, "", "  ", "undefined", "null", "N/A", "TBD", "Amazon SDE.", "lorem ipsum"]) {
      const over: Obj = { [key]: v }
      if (b === "private") over.description = v
      assert.equal(isRenderableJob(goodFor(b, over), b), false, `${b} desc=${JSON.stringify(v)}`)
    }
  }
  assert.equal(isRenderableJob(goodGovt() as never, "govt"), true, "govt rows carry no narrative and need none")
})

test("INVALID job id → excluded (undefined / null / blank / whitespace / path-like / too long)", () => {
  const bad = ["undefined", "null", "NaN", "", " ", " x", "x ", "a b", "a/b", "../etc", "a?b=1", "<script>", "x".repeat(200), "#", "-"]
  for (const id of bad) {
    assert.equal(isValidJobId(id), false, JSON.stringify(id))
    for (const b of BOARDS) assert.equal(isRenderableJob(goodFor(b, { id }), b), false, `${b} id=${JSON.stringify(id)}`)
  }
  for (const id of [undefined, null, 5, {}]) assert.equal(isValidJobId(id), false)
  for (const id of ["priv-1", "3f2a9b6e-1111-4c2d-8a10-0a1b2c3d4e5f", "ibps:clerk-2026", "a_b.c-d"]) assert.equal(isValidJobId(id), true, id)
})

test("MISSING / unknown PROVENANCE → excluded (fail closed)", () => {
  // A record with no provenance and no evidence at all is UNCLASSIFIED → not a job we can vouch for.
  // (An EXPLICIT provenance without its ownership evidence stays a renderable-but-not-genuine listing:
  // it can never be indexed or applied to — see the ACTIONABLE test below.)
  assert.equal(isRenderableJob(good({ provenance: undefined, employer_id: undefined, source: "", verified: false, jobStatus: undefined }), "private"), false)
  assert.equal(isRenderableJob(goodWfh({ provenance: undefined, apply_url: "", source: "" }) as never, "wfh"), false)
  assert.equal(isRenderableJob(goodAbroad({ provenance: "MADE_UP", apply_url: "", source: "" }) as never, "abroad"), false)
  assert.equal(isRenderableJob(goodGovt({ officialUrl: "", applyUrl: "", notificationUrl: "" }) as never, "govt"), false, "govt without a real official URL")
})

test("PLACEHOLDER / broken LOCATION → excluded (private: required; abroad+WFH: when present it must be real)", () => {
  for (const location of [undefined, "", "undefined", "null", "N/A", "-", "TBD"]) {
    assert.equal(isRenderableJob(good({ location }), "private"), false, `private location=${JSON.stringify(location)}`)
  }
  assert.equal(isRenderableJob(goodAbroad({ country: "" }) as never, "abroad"), false, "abroad without a country")
  assert.equal(isRenderableJob(goodAbroad({ location: "undefined" }) as never, "abroad"), false, "abroad junk location")
  assert.equal(isRenderableJob(goodAbroad({ location: "" }) as never, "abroad"), true, "abroad location is optional")
})

test("accidental stringified output ('undefined', 'null', 'NaN', 'N/A', '[object Object]', '#') is a placeholder", () => {
  for (const v of ["undefined", "null", "NaN", "N/A", "n/a", "[object Object]", "#", "-", "—", "TBA", "  ", "Acme undefined", "null · Delhi", "undefined LPA"]) {
    assert.equal(isPlaceholderText(v), true, JSON.stringify(v))
  }
  for (const v of ["Acme Pvt Ltd", "Delhi", "Accounts Executive", "Nullify Labs", "Undefined Behaviour Ltd. is a band", "₹25,000"]) {
    if (/undefined/i.test(v)) continue // an embedded whole-word token is intentionally rejected; the rest must pass
    assert.equal(isPlaceholderText(v), false, JSON.stringify(v))
  }
  assert.equal(isPlaceholderText(undefined), true)
  assert.equal(isPlaceholderText(null), true)
  assert.equal(isPlaceholderText(0 as never), true, "0 is not a value worth showing")
})

test("filler ('Competitive', 'Any Experience', 'Recent', 'Invalid Date') is never displayed as a fact", () => {
  for (const v of ["Competitive", "competitive", "Any", "Any Experience", "Recent", "Invalid Date", "Not disclosed", "N/A", "", undefined]) {
    assert.equal(isRealDisplayValue(v), false, JSON.stringify(v))
    assert.equal(displayValue(v), undefined)
  }
  assert.equal(displayValue("  ₹4-6 LPA "), "₹4-6 LPA")
})

/* ------------- missing application route → not in the ACTIONABLE inventory ------------- */

test("dead-end genuine-class record (no employer delivery, no genuine external URL) → NOT renderable ('no-application-route'): excluded from the candidate inventory, never a misleading Apply", () => {
  // Aggregated / curated jobs need a real external URL; without one there is nowhere to send the candidate.
  const noRoute = goodWfh({ apply_url: "" }) as never
  assert.equal(isRenderableJob(noRoute, "wfh"), false, "no destination and no employer → not shown as a job")
  assert.ok(checkJobRecord(noRoute, "wfh").reasons.includes("no-application-route"))
  assert.equal(isActionableJob(noRoute, "wfh"), false)
  const placeholderRoute = goodWfh({ apply_url: "#" }) as never
  assert.equal(isRenderableJob(placeholderRoute, "wfh"), false, "'#' is not an application destination")
  assert.equal(isActionableJob(placeholderRoute, "wfh"), false)
  const exampleRoute = goodWfh({ apply_url: "https://example.com/apply" }) as never
  assert.equal(isRenderableJob(exampleRoute, "wfh"), false, "example.* is not real")
  // Employer-owned jobs apply through NobleJob (no external URL needed) — but need the employer id.
  assert.equal(isActionableJob(good(), "private"), true)
  assert.equal(isRenderableJob(good({ employer_id: undefined }), "private"), false, "an 'employer' job that no employer owns receives nobody's application")
  assert.ok(checkJobRecord(good({ employer_id: undefined }), "private").reasons.includes("no-application-route"))
  assert.equal(filterRenderable([goodWfh(), noRoute, placeholderRoute, exampleRoute] as never[], "wfh").length, 1)
  assert.equal(filterActionable([goodWfh(), noRoute, placeholderRoute] as never[], "wfh").length, 1)
})
test("a record WITH a genuine route stays renderable: employer-owned, or a real external apply URL (no employer needed)", () => {
  assert.equal(isRenderableJob(good(), "private"), true)
  assert.equal(isRenderableJob(goodWfh({ employer_id: undefined }) as never, "wfh"), true, "aggregated + real URL → external Apply")
  assert.equal(isRenderableJob(goodWfh({ apply_url: "https://careers.acme.org/apply/9" }) as never, "wfh"), true)
})
test("sample (SYNTHETIC) rows are unaffected by the route gate: still labelled samples with a disabled control", () => {
  assert.equal(checkJobRecord(good({ provenance: "SYNTHETIC", id: "live-priv-1", employer_id: undefined }), "private").reasons.includes("no-application-route"), false)
})

test("closed / archived / past-deadline / synthetic jobs are not actionable", () => {
  assert.equal(isActionableJob(good({ status: "closed" }), "private"), false)
  assert.equal(isActionableJob(good({ jobStatus: "ARCHIVED_JOB" }), "private"), false)
  assert.equal(isActionableJob(good({ application_deadline: "2020-01-01T00:00:00Z" }), "private"), false)
  assert.equal(isActionableJob(good({ provenance: "SYNTHETIC", id: "live-priv-1" }), "private"), false)
})

/* ------------------- direct URL → 404 (null), never an empty shell ------------------- */

test("direct URL to a NON-EXISTENT / invalid / incomplete job → null (→ notFound), not an empty shell", async () => {
  for (const id of ["undefined", "null", "", " ", "does-not-exist", "../x", "a b", "priv-999999999"]) {
    assert.equal(await getJobById(id), null, `private ${JSON.stringify(id)}`)
    assert.equal(await getWfhJobById(id), null, `wfh ${JSON.stringify(id)}`)
    assert.equal(await getAbroadJobById(id), null, `abroad ${JSON.stringify(id)}`)
  }
  // The exact records the gate excludes from the inventory are also 404s by id.
  const badPriv = PRIVATE_INVENTORY.find(j => !isRenderableJob(j, "private"))
  const badWfh = WFH_INVENTORY.find(j => !isRenderableJob(j, "wfh"))
  assert.ok(badPriv, "the seeded inventory contains at least one incomplete private record")
  assert.ok(badWfh, "the seeded inventory contains at least one incomplete WFH record")
  assert.equal(getPrivateJobByIdLocal(badPriv!.id), null)
  assert.equal(getWfhJobByIdLocal(badWfh!.id), null)
  assert.equal(await getJobById(badPriv!.id), null)
  assert.equal(await getWfhJobById(badWfh!.id), null)
  // …and a COMPLETE one resolves.
  const okPriv = renderablePrivateInventory()[0]
  assert.equal(getPrivateJobByIdLocal(okPriv.id)?.id, okPriv.id)
})

test("a fetched row that exists but is incomplete resolves to null (renderableOrNull), never a local swap", () => {
  assert.equal(renderableOrNull(mapPrivateJobRow({ id: "row-1", title: "Role", company: "Acme" }), "private"), null)
  assert.equal(renderableOrNull(null, "private"), null)
  assert.equal(renderableOrNull(undefined, "wfh"), null)
  assert.ok(renderableOrNull(good(), "private"))
})

test("every detail page returns notFound() for a missing job and noindexes the not-found metadata", () => {
  for (const b of ["private", "wfh", "abroad", "govt"]) {
    const src = read(`src/app/jobs/${b}/[id]/page.tsx`)
    assert.match(src, /if \(!job\) notFound\(\)/, `${b} page must 404`)
    assert.match(src, /noIndex: true/, `${b} not-found metadata must be noindex`)
  }
  assert.match(read("src/app/api/govt-jobs/[[...params]]/route.ts"), /status: 404/)
  assert.match(read("src/app/api/jobs/[[...params]]/route.ts"), /isValidJobId\(p\[0\]\)/)
})

test("govt: incomplete rows are excluded (Untitled Notification, no organisation, invalid id, no official URL)", () => {
  const rows = [
    goodGovt(),
    goodGovt({ id: "g-2", title: "Untitled Notification" }),
    goodGovt({ id: "g-3", org: "" }),
    goodGovt({ id: "undefined" }),
    goodGovt({ id: "g-5", officialUrl: "", applyUrl: "" }),
    goodGovt({ id: "g-6", title: undefined }),
  ]
  assert.deepEqual(toRenderableGovtJobs(rows).map((j: GovtJob) => j.id), ["ibps:clerk-2026"])
  // The seeded government inventory is fully renderable (the gate must not empty the real dataset).
  const seed = read("src/lib/services/govtStatsSource.ts")
  assert.match(seed, /export function isServableGovtJob/)
  assert.match(seed, /isRenderableJob\(job as never, "govt"\)/)
  assert.match(seed, /rows\.filter\(isServableGovtJob\)/, "the pool read filters by the gate")
  assert.match(seed, /isServableGovtJob\(job\) \? job : null/, "the single-row read returns null for an incomplete row")
  assert.match(read("src/lib/services/govtJobService.ts"), /servableOrNull\(/, "by-id/by-slug lookups are gated")
})

/* ---------------------------- related / recommendations ---------------------------- */

test("related jobs NEVER include incomplete jobs — on indexable AND noindex pages", () => {
  const complete = good({ id: "ok-1" })
  const incomplete = [
    good({ id: "bad-1", title: "" }),
    good({ id: "bad-2", company: "undefined" }),
    good({ id: "bad-3", desc: "", description: "" }),
    good({ id: "undefined" }),
    good({ id: "bad-5", provenance: undefined, employer_id: undefined, source: "", verified: false, jobStatus: undefined }),
    good({ id: "bad-6", location: "" }),
  ]
  for (const fromIndexablePage of [true, false]) {
    const links = toRelatedLinks("private", [...incomplete, complete], { fromIndexablePage }, (j, href) => href)
    assert.deepEqual(links, ["/jobs/private/ok-1"], `fromIndexablePage=${fromIndexablePage}`)
    for (const j of incomplete) assert.equal(relatedJobHref("private", j, { fromIndexablePage }), null)
  }
  // WFH / abroad boards too.
  assert.equal(relatedJobHref("wfh", goodWfh({ title: "" }) as never, { fromIndexablePage: true }), null)
  assert.equal(relatedJobHref("abroad", goodAbroad({ company: "" }) as never, { fromIndexablePage: false }), null)
})

test("recommendations / featured / latest / blue-collar / alert e-mail all use the ACTIONABLE gate", () => {
  assert.match(read("src/app/api/candidate/[[...params]]/route.ts"), /filterActionable\(/)
  assert.match(read("src/components/candidate/RecommendedJobsList.tsx"), /isActionableJob\(/)
  const featured = read("src/lib/services/featuredJobs.ts")
  assert.doesNotMatch(featured, /\.filter\(isGenuine\)/, "featured must not rely on isGenuine alone")
  assert.match(featured, /filterActionable\(/)
  assert.match(read("src/lib/services/blueCollarJobs.ts"), /filterActionable\(/)
  assert.match(read("src/services/jobAlertDispatcher.ts"), /isActionableJob\(/)
  assert.match(read("src/components/home/LatestJobsGrid.tsx"), /getLatestJobCards/)
})

test("the homepage 'Latest Job Openings' grid contains NO hand-written jobs or invented counters", () => {
  const src = read("src/components/home/LatestJobsGrid.tsx")
  for (const fake of ["Software Engineer", "TCS · Bangalore", "SSC CGL 2024", "UPSC Civil Services", "Marriott International", "Believ", "4,800+", "1,245+", "8,500+", "2,300+"]) {
    assert.ok(!src.includes(fake), `hard-coded placeholder content remains: ${fake}`)
  }
  assert.match(src, /New openings are being added/, "an empty column is an intentional empty state")
})

/* ------------------------------ counts agree with rows ------------------------------ */

test("private listing: total / totalPages / counts describe EXACTLY the displayed jobs (all pages)", () => {
  const limit = 500
  const first = getPrivateJobsLocal({ limit, page: 1 })
  const renderable = renderablePrivateInventory().length
  assert.ok(renderable < PRIVATE_INVENTORY.length, "the seeded inventory has records the gate excludes")
  assert.equal(first.total, renderable, "total counts renderable jobs only")
  assert.equal(first.counts?.all, renderable, "counts.all agrees with total")
  assert.equal(first.totalPages, Math.ceil(renderable / limit))
  let seen = 0
  const ids = new Set<string>()
  for (let p = 1; p <= first.totalPages; p++) {
    const r = getPrivateJobsLocal({ limit, page: p })
    seen += r.jobs.length
    for (const j of r.jobs) { ids.add(j.id); assert.equal(isRenderableJob(j, "private"), true, j.id) }
  }
  assert.equal(seen, first.total, "sum of rows over every page === total")
  assert.equal(ids.size, first.total, "no duplicates / no filtered-out job on any page")
  const excluded = PRIVATE_INVENTORY.filter(j => !isRenderableJob(j, "private")).map(j => j.id)
  for (const id of excluded) assert.ok(!ids.has(id), `${id} must not appear in any page`)
})

test("WFH + abroad listings: totals exclude filtered-out jobs and equal the rows across pages", () => {
  const w = getWfhJobsPaginatedLocal({ limit: 400, page: 1 })
  assert.equal(w.total, renderableWfhInventory().length)
  assert.equal(w.counts?.all, w.total)
  assert.ok(w.total < WFH_INVENTORY.length, "the seeded WFH inventory has a record the gate excludes")
  let wSeen = 0
  for (let p = 1; p <= w.totalPages; p++) wSeen += getWfhJobsPaginatedLocal({ limit: 400, page: p }).items.length
  assert.equal(wSeen, w.total)

  const a = getAbroadJobsPaginatedLocal({ limit: 400, page: 1 })
  assert.equal(a.total, renderableAbroadInventory().length)
  let aSeen = 0
  for (let p = 1; p <= a.totalPages; p++) aSeen += getAbroadJobsPaginatedLocal({ limit: 400, page: p }).items.length
  assert.equal(aSeen, a.total)
  assert.equal(getAbroadJobByIdLocal("undefined"), null)
})

test("inventory / hero / marketplace counters count the RENDERABLE inventory, not the raw one", () => {
  assert.equal(getPrivateInventoryCounts().all, renderablePrivateInventory().length)
  assert.equal(getWfhInventoryCounts().all, renderableWfhInventory().length)
  assert.equal(getAbroadInventoryCounts().all, renderableAbroadInventory().length)
  assert.ok(getPrivateInventoryCounts().all < PRIVATE_INVENTORY.length)
  assert.ok(getWfhInventoryCounts().all < WFH_INVENTORY.length)
})

test("paginateRenderable: filter FIRST, then count and slice (count === rows displayed)", () => {
  const rows = [
    good({ id: "a" }), good({ id: "b", title: "" }), good({ id: "c" }), good({ id: "d", company: "" }), good({ id: "e" }), good({ id: "f" }),
  ]
  const p1 = paginateRenderable(rows, "private", 1, 2)
  assert.deepEqual(p1.jobs.map(j => j.id), ["a", "c"])
  assert.equal(p1.total, 4)
  assert.equal(p1.totalPages, 2)
  const p2 = paginateRenderable(rows, "private", 2, 2)
  assert.deepEqual(p2.jobs.map(j => j.id), ["e", "f"])
  assert.equal(p1.jobs.length + p2.jobs.length, p1.total)
  const none = paginateRenderable([good({ id: "x", title: "" })], "private", 1, 20)
  assert.deepEqual([none.jobs.length, none.total, none.totalPages], [0, 0, 0])
})

test("the DB list path filters BEFORE counting (in-memory pool) — no raw SQL count", () => {
  const svc = read("src/lib/services/jobService.ts")
  assert.match(svc, /filterRenderable\(/)
  assert.doesNotMatch(svc, /count:\s*["']exact["']/, "an SQL count cannot know which rows the gate drops")
  assert.match(svc, /total:\s*pool\.length/)
  assert.match(svc, /totalPages:\s*Math\.ceil\(pool\.length \/ limit\)/)
  assert.match(svc, /counts:\s*countByStatus\(pool\)/)
  // WFH / abroad DB paths filter too.
  assert.match(read("src/lib/services/wfhJobService.ts"), /filterRenderable\(data as unknown as WfhJob\[\], "wfh"\)/)
  assert.match(read("src/lib/services/abroadJobService.ts"), /filterRenderable\(data as unknown as AbroadJob\[\], "abroad"\)/)
})

test("API count / stats never use a raw `status = active` row count", () => {
  const jobsApi = read("src/app/api/jobs/[[...params]]/route.ts")
  assert.doesNotMatch(jobsApi, /count:\s*"exact"/)
  const stats = read("src/app/api/stats/route.ts")
  assert.doesNotMatch(stats, /count:\s*"exact",\s*head:\s*true\s*\}\)\.eq\("status",\s*"active"\)/)
  assert.match(stats, /getGenuineJobCounts/)
  assert.match(read("src/components/home/StatsStrip.tsx"), /getGenuineJobCounts/)
  assert.match(read("src/lib/services/genuineCounts.ts"), /jobRowsToSitemapEntries/, "the headline number uses the sitemap predicate")
})

/* ----------------- sitemap / JobPosting / indexing: no empty SEO pages ----------------- */

const row = (over: Partial<SitemapJobRow> = {}): SitemapJobRow => ({
  id: "row-1", posted_at: "2026-08-01T00:00:00Z", provenance: "EMPLOYER", employer_id: "e", is_verified: true, status: "active",
  title: "Accounts Executive", company: "Acme", location: "Delhi", country: "UAE", description: DESC, ...over,
})

test("sitemap excludes incomplete rows (no title / company / description / location / country, invalid id) on every board", () => {
  const NOW = new Date("2026-09-19T10:00:00Z")
  const base = "https://www.noblejob.in"
  for (const board of BOARDS) {
    assert.equal(jobRowsToSitemapEntries(board, [row()], base, { now: NOW }).length, 1, `${board}: complete row is listed`)
    for (const over of [{ title: "" }, { title: null }, { company: "" }, { company: "undefined" }, { description: "" }, { description: null }, { id: "undefined" }, { id: "a b" }] as Partial<SitemapJobRow>[]) {
      assert.equal(jobRowsToSitemapEntries(board, [row(over)], base, { now: NOW }).length, 0, `${board} ${JSON.stringify(over)}`)
    }
  }
  // Board-specific completeness.
  assert.equal(jobRowsToSitemapEntries("private", [row({ location: "" })], base, { now: NOW }).length, 0)
  assert.equal(jobRowsToSitemapEntries("abroad", [row({ country: "" })], base, { now: NOW }).length, 0)
  // A row read WITHOUT the completeness columns (an old reader) fails closed rather than being listed.
  const legacy: SitemapJobRow = { id: "row-2", provenance: "EMPLOYER", employer_id: "e", is_verified: true, status: "active" }
  assert.equal(jobRowsToSitemapEntries("private", [legacy], base, { now: NOW }).length, 0)
  assert.match(read("src/lib/seo/sitemapJobs.ts"), /title, company, description, location/)
})

test("no JobPosting for an incomplete record, even with a real source date and genuine provenance", () => {
  // JobPosting needs a substantive stored description (150+ chars / 20+ words) on top of the visibility minimum.
  const LONG = DESC + " The role reports to the finance manager and handles GST filing support, invoice processing and monthly closing for the office."
  const withDate = (over: Obj) => good({ source_posted_at: "2026-08-01T05:30:00.000Z", desc: LONG, description: LONG, ...over })
  const content = (j: Job) => buildJobContent({ board: "private", title: j.title, company: j.company, location: j.location } as never)
  const ok = withDate({})
  assert.ok(buildPrivateJobPosting(ok, content(ok)), "sanity: complete record → JobPosting")
  for (const over of [{ title: "" }, { company: "" }, { location: "" }, { id: "undefined" }, { desc: "", description: "" }]) {
    const j = withDate(over)
    assert.equal(buildPrivateJobPosting(j, content(j)), null, JSON.stringify(over))
  }
})

test("an unrepresentable job is not indexable and has no JobPosting: the pages gate robots on the same predicate", () => {
  for (const b of ["private", "wfh", "abroad"]) {
    const src = read(`src/app/jobs/${b}/[id]/page.tsx`)
    assert.match(src, /noIndex: !isIndexable\(job\)/, b)
  }
  const builders = read("src/lib/seo/jobPostingBuilders.ts")
  assert.equal((builders.match(/isRenderableJob\(/g) || []).length >= 4, true, "all four builders check renderability")
})

/* ----------------------------- client-rendered paths ----------------------------- */

test("client list mapper drops incomplete rows and defaults NOTHING", () => {
  const api = [
    { id: "ok-1", title: "Accounts Executive", company: "Acme", location: "Delhi", desc: DESC, provenance: "EMPLOYER", employer_id: "e", verified: true },
    { id: "undefined", title: "x", company: "y", location: "z", desc: DESC, provenance: "EMPLOYER", employer_id: "e" },
    { id: "bad-2", company: "Acme", location: "Delhi", desc: DESC, provenance: "EMPLOYER", employer_id: "e" },
    { id: "bad-3", title: "Role", location: "Delhi", desc: DESC, provenance: "EMPLOYER", employer_id: "e" },
    { id: "bad-4", title: "Role", company: "Acme", location: "Delhi", provenance: "EMPLOYER", employer_id: "e" },
    null,
    "string",
    42,
  ]
  const out = toListingJobs(api, "VERIFIED_JOB")
  assert.deepEqual(out.map(j => j.id), ["ok-1"])
  const j = out[0]
  assert.equal(j.salary, "", "no 'Competitive' default")
  assert.equal(j.applyUrl, "", "no '#' default")
  assert.equal(j.posted, "", "no 'Recent' default")
  assert.equal(j.exp, "", "no 'Any Experience' default")
  assert.equal(j.type, "", "no 'Full Time' default")
  assert.equal(j.verified, true)
  assert.equal(toListingJobs([{ id: "ok-2", title: "Role", company: "Acme", location: "Delhi", desc: DESC, provenance: "EMPLOYER", employer_id: "e" }])[0].verified, false, "no `verified ?? true`")
  assert.deepEqual(toListingJobs(undefined), [])
  assert.deepEqual(toListingJobs({}), [])
})

test("client live (Himalayas) mapper: needs id + title + company + a REAL apply URL; never String(undefined)", () => {
  const mk = (over: Obj = {}) => ({ id: "senior-eng-1", title: "Senior Engineer", company: "Acme", location: "Remote", applyUrl: "https://acme.example.org/jobs/1", ...over })
  const okOne = { ...mk(), applyUrl: "https://boards.greenhouse.io/acme/jobs/1" }
  assert.equal(isUsableLiveJob(okOne), true)
  const out = toLiveExternalJobs([okOne])
  assert.equal(out.length, 1)
  assert.equal(out[0].provenance, "AGGREGATED")
  assert.equal(out[0].verified, false, "no verified default")
  for (const over of [{ id: undefined }, { id: "undefined" }, { id: "a b" }, { title: undefined }, { title: "null" }, { company: "" }, { applyUrl: "" }, { applyUrl: "#" }, { applyUrl: "https://example.com/x" }, { applyUrl: "javascript:alert(1)" }, { location: "N/A" }]) {
    assert.equal(toLiveExternalJobs([{ ...okOne, ...over }]).length, 0, JSON.stringify(over))
  }
  const dump = JSON.stringify(out)
  assert.doesNotMatch(dump, /undefined|"#"|Competitive|Recent/)
})

test("client WFH / abroad / govt list filters drop incomplete rows", () => {
  assert.deepEqual(toRenderableWfhJobs([goodWfh(), goodWfh({ id: "w2", title: "" }), goodWfh({ id: "w3", company: undefined }), null]).map(j => j.id), ["wfh-real-1"])
  assert.deepEqual(toRenderableAbroadJobs([goodAbroad(), goodAbroad({ id: "a2", country: "" }), goodAbroad({ id: "a3", description: "" })]).map(j => j.id), ["abroad-real-1"])
  assert.deepEqual(toRenderableWfhJobs("not-an-array"), [])
})

test("client components: every list is re-checked, errors are an ERROR state (never an empty 'no jobs' or a fake job)", () => {
  const live = read("src/components/jobs/LiveJobsList.tsx")
  assert.match(live, /toListingJobs\(/)
  assert.match(live, /toLiveExternalJobs\(/)
  assert.doesNotMatch(live, /String\(raw\./, "no String(undefined) mapping")
  assert.doesNotMatch(live, /'#'|'Competitive'|'Recent'|\?\? true/, "no placeholder defaults")
  assert.match(live, /role="alert"/, "a failed load has its own intentional error state")
  for (const f of ["src/components/wfh/WfhJobsPanel.tsx", "src/components/abroad/AbroadJobsPanel.tsx"]) {
    const src = read(f)
    assert.match(src, /toRenderable(Wfh|Abroad)Jobs\(/, f)
    assert.match(src, /role="alert"/, `${f} error state`)
  }
  assert.match(read("src/components/govt/GovtJobsList.tsx"), /toRenderableGovtJobs\(/)
  assert.match(read("src/hooks/useGovtJobs.ts"), /toRenderableGovtJobs\(/)
})

test("cards never print 'undefined' / 'null' / filler chips and never claim an unsupported 'Verified'", () => {
  const card = read("src/components/jobs/JobCard.tsx")
  assert.doesNotMatch(card, /'Full Time'\)|'Any Experience'/)
  assert.match(card, /isActionableJob\(job, 'private'\)/, "Apply Now only for an actionable job")
  const wfh = read("src/components/wfh/WfhJobCard.tsx")
  assert.doesNotMatch(wfh, /'🏠 ' \+ job\.type|`👤 \$\{job\.applicants\} applicants · Verified`/)
  assert.match(wfh, /hasVerifiedTrust\(job\)/)
  assert.doesNotMatch(read("src/components/jobs/JobDetailModal.tsx"), /\|\| '#'/, "no '#' apply link")
  assert.match(read("src/lib/utils/formatters.ts"), /Number\.isNaN\(date\.getTime\(\)\)\) return ""/, "formatDate never returns 'Invalid Date'")
})

test("detail pages omit unusable badges/sections instead of printing placeholders; empty sections are not rendered", () => {
  for (const b of ["private", "wfh", "abroad"]) {
    const src = read(`src/app/jobs/${b}/[id]/page.tsx`)
    assert.match(src, /displayValue/, `${b} page filters placeholder values`)
    assert.doesNotMatch(src, /\|\| 'Any'\}|\|\| 'Freshers'|\|\| 'Any Graduate'/, `${b} page: no filler badge defaults`)
  }
  const tpl = read("src/components/jobs/JobDetailTemplate.tsx")
  for (const key of ["responsibilities", "eligibility", "skills", "benefits", "selectionProcess", "howToApply", "importantDates", "faqs"]) {
    assert.match(tpl, new RegExp(`content\\.${key}\\.length > 0`), `${key} section must not render empty`)
  }
  const govt = read("src/app/jobs/govt/[id]/page.tsx")
  assert.match(govt, /has\(job\.eligibility\)/)
  assert.match(govt, /job\.selectionProcess\?\.some\(has\)/)
})

test("live third-party server cache returns only usable cards", () => {
  assert.match(read("src/lib/services/himalayasCache.ts"), /isUsableLiveJob/)
})

/* ------------------------------- run + report ------------------------------- */

void Promise.all(pending).then(() => {
  console.log(`\nno-empty-jobs tests: ${passed} passed, ${failed} failed`)
  process.exitCode = failed ? 1 : 0
})
