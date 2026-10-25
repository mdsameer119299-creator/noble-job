/**
 * cardApplyGating.test.ts — the candidate-facing CARD must show "Apply Now" iff a
 * candidate really can apply inside Noble Job, on every board, and the homepage
 * must show genuine listings (actionable or informational) without ever fabricating
 * content or a count.
 *
 *   npm run test:card-apply-gating
 *
 * This complements applyRoute.test.ts (which proves the *route* model) and
 * renderable.test.ts / gateCoverage.test.ts (which prove the *gate*) with the one
 * layer neither covers: the actual card components' own "Apply Now" vs "View
 * Details" decision (`canApply`, duplicated here from JobCard.tsx / WfhJobCard.tsx /
 * AbroadJobCard.tsx on purpose — if a card's formula ever drifts from this, that is
 * exactly the kind of regression this suite exists to catch), confirmed against the
 * real component source so a future edit cannot silently re-break it; and
 * `isListableJob` / `getLatestJobCards`, the new (fixed) homepage data path.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { applyStateFor } from "./applyRoute"
import { isActionableJob, isListableJob, isRenderableJob, filterListable } from "./renderable"
import { classifyProvenance } from "./provenance"
import { isActiveStatus } from "../config/jobStrategy"
import type { Job } from "@/types/job"
import type { WfhJob } from "@/types/wfhJob"
import type { AbroadJob } from "@/types/abroadJob"

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
const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), "utf8")
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
type Obj = Record<string, unknown>

/* ------------------------------ fixtures (same shape as applyRoute.test.ts) ------------------------------ */

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
    provenance: "EMPLOYER", employer_id: "emp-1", source: "employer", status: "active", jobStatus: "LIVE_JOB", ...over,
  }) as unknown as WfhJob
const abroadJob = (over: Obj = {}) =>
  ({
    id: "abroad-1", title: "Electrician", company: "Gulf Build LLC", logo: "GB", country: "UAE", location: "Dubai", type: "Full Time",
    salary: "AED 2,500 per month", experience: "3 years", category: "Construction", apply_url: REAL_URL, source_posted_at: SOURCE,
    description: DESC.replace("Accounts Executive", "Electrician"), provenance: "AGGREGATED", source: "himalayas", status: "active",
    jobStatus: "LIVE_JOB", ...over,
  }) as unknown as AbroadJob

/** Exactly the `canApply` formula implemented in JobCard.tsx / WfhJobCard.tsx / AbroadJobCard.tsx. */
function canApply(board: "private" | "wfh" | "abroad", job: Obj, company: string): boolean {
  return (
    isActiveStatus(job.jobStatus as never) &&
    classifyProvenance(job as never) !== "SYNTHETIC" &&
    applyStateFor(board, job as never, company).kind === "employer" &&
    isActionableJob(job as never, board)
  )
}

/* ───────────────────────────── H: per-board Apply Now gating ───────────────────────────── */

test("Private: genuine, open, employer-owned job → Apply Now", () => {
  assert.equal(canApply("private", privateJob() as unknown as Obj, "Acme Pvt Ltd"), true)
})
test("Private: genuine aggregated/sourced listing → no Apply Now (stays an honest 'View Details')", () => {
  const agg = privateJob({ provenance: "AGGREGATED", employer_id: undefined, source: "himalayas", applyUrl: REAL_URL })
  assert.equal(canApply("private", agg as unknown as Obj, "Acme Pvt Ltd"), false)
  // ...but it is still a genuine, shown listing — never hidden outright.
  assert.equal(isRenderableJob(agg as never, "private"), true)
})

test("WFH: genuine, open, employer-owned job → Apply Now", () => {
  assert.equal(canApply("wfh", wfhJob() as unknown as Obj, "Remote Co"), true)
})
test("WFH: genuine aggregated/sourced listing → no Apply Now", () => {
  const agg = wfhJob({ provenance: "AGGREGATED", employer_id: undefined, source: "himalayas", apply_url: REAL_URL })
  assert.equal(canApply("wfh", agg as unknown as Obj, "Remote Co"), false)
  assert.equal(isRenderableJob(agg as never, "wfh"), true)
})

test("Abroad: genuine, open, employer-owned job → Apply Now", () => {
  const emp = abroadJob({ provenance: "EMPLOYER", employer_id: "emp-1", source: "employer" })
  assert.equal(canApply("abroad", emp as unknown as Obj, "Gulf Build LLC"), true)
})
test("Abroad: genuine aggregated/sourced listing → no Apply Now (the default fixture: real external URL, no employer)", () => {
  assert.equal(canApply("abroad", abroadJob() as unknown as Obj, "Gulf Build LLC"), false)
  assert.equal(isRenderableJob(abroadJob() as never, "abroad"), true)
})

test("every board: a SYNTHETIC/sample row never shows Apply Now even if it claims employer_id", () => {
  assert.equal(canApply("private", privateJob({ provenance: "SYNTHETIC" }) as unknown as Obj, "Acme Pvt Ltd"), false)
  assert.equal(canApply("wfh", wfhJob({ provenance: "SYNTHETIC" }) as unknown as Obj, "Remote Co"), false)
  assert.equal(canApply("abroad", abroadJob({ provenance: "SYNTHETIC", employer_id: "emp-1", source: "employer" }) as unknown as Obj, "Gulf Build LLC"), false)
})
test("every board: a closed / archived employer job never shows Apply Now (honest 'View Details' instead)", () => {
  assert.equal(canApply("private", privateJob({ jobStatus: "ARCHIVED_JOB" }) as unknown as Obj, "Acme Pvt Ltd"), false)
  assert.equal(canApply("private", privateJob({ status: "closed" }) as unknown as Obj, "Acme Pvt Ltd"), false)
  assert.equal(canApply("wfh", wfhJob({ status: "closed" }) as unknown as Obj, "Remote Co"), false)
  const emp = abroadJob({ provenance: "EMPLOYER", employer_id: "emp-1", source: "employer", status: "closed" })
  assert.equal(canApply("abroad", emp as unknown as Obj, "Gulf Build LLC"), false)
})
test("an unknown/garbage jobStatus never crashes canApply and is treated as not active (isActiveStatus fails closed)", () => {
  assert.equal(isActiveStatus("SOME_FUTURE_STATUS" as never), false)
  assert.doesNotThrow(() => canApply("private", privateJob({ jobStatus: "SOME_FUTURE_STATUS" }) as unknown as Obj, "Acme Pvt Ltd"))
  assert.equal(canApply("private", privateJob({ jobStatus: "SOME_FUTURE_STATUS" }) as unknown as Obj, "Acme Pvt Ltd"), false)
})

/* ───────────────────────── component source actually implements the gate ───────────────────────── */

test("WfhJobCard.tsx: wired with the real canApply gate, ApplicationModal, and 'Apply Now' only behind it", () => {
  const src = strip(read("src/components/wfh/WfhJobCard.tsx"))
  assert.match(src, /const canApply\s*=\s*isActiveStatus\(job\.jobStatus\)\s*&&\s*!isSample\s*&&\s*apply\.kind === 'employer'\s*&&\s*isActionableJob\(job, 'wfh'\)/)
  assert.match(src, /canApply \?/)
  assert.match(src, /'Apply Now/)
  assert.match(src, /<ApplicationModal/)
})
test("AbroadJobCard.tsx: wired with the real canApply gate, ApplicationModal, and 'Apply Now' only behind it", () => {
  const src = strip(read("src/components/abroad/AbroadJobCard.tsx"))
  assert.match(src, /const canApply\s*=\s*isActiveStatus\(job\.jobStatus\)\s*&&\s*!isSample\s*&&\s*apply\.kind==='employer'\s*&&\s*isActionableJob\(job,'abroad'\)/)
  assert.match(src, /canApply\?/)
  assert.match(src, /Apply Now/)
  assert.match(src, /<ApplicationModal/)
})
test("JobCard.tsx (Private): unchanged, already has the same canApply gate", () => {
  const src = strip(read("src/components/jobs/JobCard.tsx"))
  assert.match(src, /canApply/)
  assert.match(src, /isActionableJob\(job, 'private'\)/)
  assert.match(src, /<ApplicationModal/)
})
test("WfhJobCard / AbroadJobCard: ApplicationModal is NOT nested inside the onClick'd card — it is a Fragment sibling, rendered only after the card's own JSX fully closes (a portaled modal's clicks still bubble through the React tree, so nesting it would re-fire the card's onClick and pop the detail view open on top of it)", () => {
  function assertModalIsSibling(src: string, label: string) {
    const modalStart = src.indexOf("<ApplicationModal")
    assert.ok(modalStart > -1, `${label}: ApplicationModal not found`)
    const before = src.slice(0, modalStart)
    const openDiv = (before.match(/<div\b/g) ?? []).length
    const closeDiv = (before.match(/<\/div>/g) ?? []).length
    const openArticle = (before.match(/<article\b/g) ?? []).length
    const closeArticle = (before.match(/<\/article>/g) ?? []).length
    assert.ok(openDiv + openArticle > 0, `${label}: expected a card root element before the modal`)
    assert.equal(openDiv, closeDiv, `${label}: a <div> opened before ApplicationModal is never closed — the modal is nested inside it, not a sibling`)
    assert.equal(openArticle, closeArticle, `${label}: an <article> opened before ApplicationModal is never closed — the modal is nested inside it, not a sibling`)
    // The component must wrap card + modal in a single top-level Fragment.
    assert.match(src, /return\s*\(\s*(?:\/\/[^\n]*\n\s*)*<>/)
  }
  assertModalIsSibling(strip(read("src/components/wfh/WfhJobCard.tsx")), "WfhJobCard")
  assertModalIsSibling(strip(read("src/components/abroad/AbroadJobCard.tsx")), "AbroadJobCard")
})

/* ───────────────────────────── H: homepage ───────────────────────────── */

test("isListableJob: a genuine, open, informational (aggregated/curated, no employer) listing IS listable, but still not actionable", () => {
  const aggPrivate = privateJob({ provenance: "AGGREGATED", employer_id: undefined, source: "himalayas", applyUrl: REAL_URL })
  assert.equal(isListableJob(aggPrivate as never, "private"), true)
  assert.equal(isActionableJob(aggPrivate as never, "private"), false)
  const aggAbroad = abroadJob()
  assert.equal(isListableJob(aggAbroad as never, "abroad"), true)
  assert.equal(isActionableJob(aggAbroad as never, "abroad"), false)
})
test("isListableJob: a genuine employer-owned open job is also listable (actionable implies listable)", () => {
  assert.equal(isListableJob(privateJob() as never, "private"), true)
  assert.equal(isListableJob(wfhJob() as never, "wfh"), true)
})
test("isListableJob: SYNTHETIC / unclassified / unverifiable content is never listable on the homepage", () => {
  assert.equal(isListableJob(privateJob({ provenance: "SYNTHETIC" }) as never, "private"), false)
  assert.equal(isListableJob(privateJob({ provenance: undefined, employer_id: undefined, source: "unknown" }) as never, "private"), false)
  // "employer" claim with no actual employer, and "aggregated" claim with no real URL, are unverifiable → hidden.
  assert.equal(isListableJob(privateJob({ employer_id: undefined }) as never, "private"), false)
  assert.equal(isListableJob(abroadJob({ apply_url: "" }) as never, "abroad"), false)
})
test("isListableJob: a closed / expired genuine job is not listable (it must be currently open)", () => {
  assert.equal(isListableJob(privateJob({ status: "closed" }) as never, "private"), false)
  assert.equal(isListableJob(privateJob({ jobStatus: "ARCHIVED_JOB" }) as never, "private"), false)
})
test("isListableJob: government rows keep the stricter current-notification actionable gate, unchanged", () => {
  const openGovt = { id: "ibps:clerk-2026", title: "IBPS Clerk Recruitment 2026", org: "IBPS", officialUrl: "https://www.ibps.in/careers/clerk-2026.pdf", status: "active" }
  assert.equal(isListableJob(openGovt as never, "govt"), isActionableJob(openGovt as never, "govt"))
})
test("filterListable: keeps genuine+open rows (actionable or informational) in order, drops synthetic/non-genuine/closed", () => {
  const rows = [
    privateJob({ id: "a1" }), // employer, open → kept
    privateJob({ id: "a2", provenance: "AGGREGATED", employer_id: undefined, source: "himalayas", applyUrl: REAL_URL }), // informational, open → kept
    privateJob({ id: "a3", provenance: "SYNTHETIC" }), // sample → dropped
    privateJob({ id: "a4", status: "closed" }), // closed → dropped
  ]
  const kept = filterListable(rows as never, "private").map(j => (j as unknown as Job).id)
  assert.deepEqual(kept, ["a1", "a2"])
})

test("featuredJobs.ts: getLatestJobCards queries the database for EVERY board, not only when the live external pool is empty (the early-return bug that discarded genuine DB jobs behind a live job)", () => {
  const src = strip(read("src/lib/services/featuredJobs.ts"))
  const fn = src.slice(src.indexOf("export async function getLatestJobCards"), src.indexOf("async function getLatestPrivateDbCards"))
  assert.doesNotMatch(fn, /if\s*\(\s*live\.length/, "must not skip the DB query just because a live external job exists")
  assert.equal((fn.match(/mergeById\(/g) ?? []).length, 3, "private / wfh / abroad branches each merge live + DB results")
  assert.match(fn, /getLatestPrivateDbCards/)
  assert.match(fn, /getLatestBoardDbCards\("wfh"/)
  assert.match(fn, /getLatestBoardDbCards\("abroad"/)
})
test("featuredJobs.ts: the homepage's DB fetch uses the looser LISTABLE gate (filterListable / privateListable), not the stricter actionable-only gate", () => {
  const src = strip(read("src/lib/services/featuredJobs.ts"))
  const dbFns = src.slice(src.indexOf("async function getLatestPrivateDbCards"))
  assert.match(dbFns, /privateListable\(/)
  assert.match(dbFns, /filterListable\(/)
})
test("LatestJobsGrid.tsx: no fake 'Apply' control on a homepage item, and an empty column stays an honest empty state (never hand-written/sample fallback jobs)", () => {
  const src = strip(read("src/components/home/LatestJobsGrid.tsx"))
  assert.doesNotMatch(src, /Apply Now/i)
  assert.match(src, /items\.length === 0/)
  assert.doesNotMatch(src, /\bSAMPLE\b|\bDEMO\b|\bFAKE\b/i)
})
test("LatestJobsGrid.tsx: no hard-coded job-count marketing numbers", () => {
  const src = strip(read("src/components/home/LatestJobsGrid.tsx"))
  assert.doesNotMatch(src, /["'`]\s*\d{1,3}(,\d{3})+\+?\s*(jobs|openings|vacancies|roles)/i)
})
test("getLatestJobCards resolves cleanly for all three boards in the default (no-Supabase, non-production) environment and never fabricates content — real empty, not sample-padded", async () => {
  for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_JOB_DATA_SOURCE"]) delete process.env[k]
  const { getLatestJobCards } = await import("../services/featuredJobs")
  for (const board of ["private", "wfh", "abroad"] as const) {
    const cards = await getLatestJobCards(board, 4)
    assert.ok(Array.isArray(cards), board)
    assert.ok(cards.length <= 4, board)
    for (const c of cards) {
      assert.ok(c.id && c.title && c.company, `${board}: every returned card has a real id/title/company, never a placeholder`)
    }
  }
})

void (async () => {
  await Promise.all(pending)
  console.log(`\ncard apply-gating / homepage tests: ${passed} passed, ${failed} failed`)
  process.exitCode = failed ? 1 : 0
})()
