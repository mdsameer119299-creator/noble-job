/**
 * syntheticApply.test.ts — Phase 1: the Apply experience for synthetic/demo jobs,
 * plus the openness (isOpen) rules the lifecycle relies on.
 *
 *   npm run test:seo-phase1
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { classifyProvenance, isIndexable, isOpen } from "./provenance"
import { nonGenuineListingLabel, syntheticOpenLabel, SAMPLE_LISTING_LABEL, UNVERIFIED_LISTING_LABEL } from "../config/jobStrategy"
import { buildJobContent } from "../seo/jobContent"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}
const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), "utf8")

test("synthetic rows are labelled 'Sample listing'; unclassified 'Unverified listing' — never 'Live Vacancy' / 'Hiring Now'", () => {
  assert.equal(nonGenuineListingLabel({ id: "live-priv-1" }), SAMPLE_LISTING_LABEL)
  assert.equal(syntheticOpenLabel("live-priv-2"), SAMPLE_LISTING_LABEL)
  assert.equal(nonGenuineListingLabel({ id: "legacy-1" }), UNVERIFIED_LISTING_LABEL)
  for (const f of ["src/lib/config/jobStrategy.ts", "src/components/jobs/JobCard.tsx", "src/components/wfh/WfhJobCard.tsx", "src/components/abroad/AbroadJobCard.tsx"]) {
    assert.doesNotMatch(read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""), /["'`>](Live Vacancy|Hiring Now|Recently Posted)/, f)
  }
})
test("the TopHiringRemotely panel no longer asserts 'Hiring Now' / 'Verified Employer' for static company names", () => {
  const src = read("src/components/wfh/TopHiringRemotely.tsx").replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  assert.doesNotMatch(src, /Hiring Now|Verified Employer/)
})
test("all three detail pages render the disabled 'sample' apply state for SYNTHETIC rows", () => {
  for (const f of ["src/app/jobs/private/[id]/page.tsx", "src/app/jobs/wfh/[id]/page.tsx", "src/app/jobs/abroad/[id]/page.tsx"]) {
    assert.match(read(f), /classifyProvenance\([^)]*\)\s*===\s*['"]SYNTHETIC['"]/, f)
  }
  assert.match(read("src/app/jobs/private/[id]/page.tsx"), /sample=\{isSample\}/)
  assert.match(read("src/components/abroad/AbroadApplySlot.tsx"), /sample=\{/)
})
test("ApplyButton(sample): disabled control, plain 'no application can be submitted' note, and NO modal", () => {
  const src = read("src/components/jobs/ApplyButton.tsx")
  const start = src.indexOf("if (sample)")
  const sampleBranch = src.slice(start, src.indexOf("return (\n    <>", start))
  assert.ok(sampleBranch.length > 50, "sample branch located")
  assert.match(sampleBranch, /disabled/)
  assert.match(sampleBranch, /no application can be submitted/)
  assert.doesNotMatch(sampleBranch, /ApplicationModal|setOpen\(true\)/)
  assert.match(sampleBranch, /Browse current openings/)
})
test("WFH detail modal has the same sample state and does not open ApplicationModal for demo rows", () => {
  const src = read("src/components/wfh/WfhDetailModal.tsx")
  assert.match(src, /SYNTHETIC/)
  assert.match(src, /no application can be submitted|not a confirmed/i)
})
test("job cards: a sample row's Apply CTA is withheld (canApply excludes samples)", () => {
  assert.match(read("src/components/jobs/JobCard.tsx"), /canApply\s*=\s*isActiveStatus\([^)]*\)\s*&&\s*!isSample/)
})
test("API guard: a direct POST for a synthetic job is rejected using id/source only (never the client URL)", () => {
  const src = read("src/app/api/applications/[[...params]]/route.ts")
  assert.match(src, /classifyProvenance\(\{\s*id:\s*parsed\.data\.jobId,\s*source:\s*parsed\.data\.source\s*\}\)\s*===\s*["']SYNTHETIC["']/)
  assert.match(src, /status:\s*422/)
  // The guard's input must not include the client-supplied apply URL ("#" for many REAL jobs).
  assert.doesNotMatch(src, /classifyProvenance\(\{[^}]*(applyUrl|apply_url)/)
  // …and it classifies demo ids as SYNTHETIC but leaves a genuine job (even with a "#" URL) alone.
  assert.equal(classifyProvenance({ id: "live-priv-1", source: "" }), "SYNTHETIC")
  assert.equal(classifyProvenance({ id: "ver-wfh-3", source: "" }), "SYNTHETIC")
  assert.notEqual(classifyProvenance({ id: "3f2a9b6e-1111-4c2d-8a10-0a1b2c3d4e5f", source: "employer" }), "SYNTHETIC")
})
test("genuine employer applications are untouched: the modal/API success path for real jobs is unchanged", () => {
  const src = read("src/components/jobs/ApplyButton.tsx")
  assert.match(src, /ApplicationModal/)
  assert.match(src, /setApplied/)
})
test("sample copy never claims the named company is hiring or that an application was received", () => {
  const c = buildJobContent({ board: "private", title: "Accounts Executive", company: "Infosys", location: "Pune", sample: true } as never)
  const txt = JSON.stringify(c)
  assert.match(txt, /not a confirmed vacancy/i)
  assert.doesNotMatch(txt, /is hiring for the position/i)
  assert.doesNotMatch(txt, /apply before the closing date/i)
  assert.doesNotMatch(txt, /Message to employer|received your application/i)
})

/* ---------------------------------- isOpen ---------------------------------- */
const genuine = { id: "j", provenance: "EMPLOYER", employer_id: "e", is_verified: true }
const NOW = new Date("2026-09-19T00:00:00Z")
test("isOpen: only status=active is open; closed/paused/pending/rejected/archived/expired are not", () => {
  assert.equal(isOpen({ ...genuine, status: "active" }, NOW), true)
  assert.equal(isOpen({ ...genuine }, NOW), true, "rows with no lifecycle info (generated/local) stay as before")
  for (const status of ["closed", "paused", "pending", "rejected", "archived", "expired", "draft"]) {
    assert.equal(isOpen({ ...genuine, status }, NOW), false, status)
    assert.equal(isIndexable({ ...genuine, status }), false, status)
  }
})
test("isOpen: a REAL past application_deadline closes; a future/junk one does not", () => {
  assert.equal(isOpen({ ...genuine, application_deadline: "2026-09-01T00:00:00Z" }, NOW), false)
  assert.equal(isOpen({ ...genuine, application_deadline: "2026-10-01T00:00:00Z" }, NOW), true)
  assert.equal(isOpen({ ...genuine, application_deadline: "whenever" }, NOW), true)
  assert.equal(isOpen({ ...genuine, applicationDeadline: "2026-09-01T00:00:00Z" }, NOW), false)
})

console.log(`\nsynthetic apply / openness tests: ${passed} passed, ${failed} failed`)
process.exitCode = failed ? 1 : 0
