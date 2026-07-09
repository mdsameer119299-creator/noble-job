/**
 * provenance.test.ts — fail-closed classification + publication-gate tests.
 *
 * Self-contained runner (no test framework dependency) so it runs anywhere with
 * just tsx. Exits non-zero on the first failing assertion count.
 *
 *   npm run test:provenance      # tsx src/lib/jobs/provenance.test.ts
 *
 * Covers: synthetic, employer, aggregated, curated, official government,
 * malformed, missing provenance, placeholder URLs, unknown sources, archived
 * jobs, and legacy DB rows.
 */
import assert from "node:assert/strict"
import {
  classifyProvenance,
  isGenuine,
  isOpen,
  isPublishableAsOpen,
  isIndexable,
  isSchemaEligible,
  isDistributable,
  isCountableAsGenuine,
  hasVerifiedTrust,
  hasRealApplyUrl,
  jobDetailHref,
  GENUINE_PROVENANCE,
  KNOWN_PROVENANCE,
  type Classifiable,
} from "./provenance"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`  PASS  ${name}`)
  } catch (err) {
    failed++
    console.error(`  FAIL  ${name}`)
    console.error(`        ${(err as Error).message.split("\n")[0]}`)
  }
}

const REAL_URL = "https://careers.acme.com/jobs/123"

// ── Synthetic ────────────────────────────────────────────────────────────
test("explicit SYNTHETIC is classified and non-genuine", () => {
  const j: Classifiable = { id: "x", provenance: "SYNTHETIC", apply_url: REAL_URL }
  assert.equal(classifyProvenance(j), "SYNTHETIC")
  assert.equal(isGenuine(j), false)
  assert.equal(isCountableAsGenuine(j), false)
})
test("generated demo id prefix → SYNTHETIC", () => {
  assert.equal(classifyProvenance({ id: "live-priv-1" }), "SYNTHETIC")
  assert.equal(classifyProvenance({ id: "arch-abroad-uae-3" }), "SYNTHETIC")
  assert.equal(isIndexable({ id: "live-priv-1", jobStatus: "LIVE_JOB" }), false)
})
test("known synthetic source strings → SYNTHETIC", () => {
  assert.equal(classifyProvenance({ id: "a", source: "Live Feed" }), "SYNTHETIC")
  assert.equal(classifyProvenance({ id: "a", source: "Archived Inventory" }), "SYNTHETIC")
})

// ── Placeholder URLs ─────────────────────────────────────────────────────
test("placeholder apply URLs are not real and → SYNTHETIC", () => {
  assert.equal(hasRealApplyUrl("#"), false)
  assert.equal(hasRealApplyUrl("https://careers.example.com/x"), false)
  assert.equal(hasRealApplyUrl(""), false)
  assert.equal(hasRealApplyUrl(REAL_URL), true)
  assert.equal(classifyProvenance({ id: "p", apply_url: "https://careers.example.com/x" }), "SYNTHETIC")
  assert.equal(classifyProvenance({ id: "p", apply_url: "#" }), "SYNTHETIC")
})

// ── Employer ─────────────────────────────────────────────────────────────
test("explicit EMPLOYER with ownership is genuine + indexable", () => {
  const j: Classifiable = { id: "e1", provenance: "EMPLOYER", employer_id: "emp-1", jobStatus: "LIVE_JOB" }
  assert.equal(classifyProvenance(j), "EMPLOYER")
  assert.equal(isGenuine(j), true)
  assert.equal(isIndexable(j), true)
  assert.equal(isSchemaEligible(j), true)
  assert.equal(isDistributable(j), true)
})
test("EMPLOYER internal apply flow needs no external apply URL", () => {
  const j: Classifiable = { provenance: "EMPLOYER", employer_id: "emp-1", jobStatus: "LIVE_JOB" }
  assert.equal(isGenuine(j), true)
})

// ── Malformed ────────────────────────────────────────────────────────────
test("malformed EMPLOYER without ownership is NOT genuine (defense in depth)", () => {
  const j: Classifiable = { id: "m", provenance: "EMPLOYER" } // no employer_id
  assert.equal(classifyProvenance(j), "EMPLOYER")
  assert.equal(isGenuine(j), false)
  assert.equal(isIndexable(j), false)
})
test("garbage/unknown provenance string → UNCLASSIFIED", () => {
  assert.equal(classifyProvenance({ id: "g", provenance: "TOTALLY_BOGUS" }), "UNCLASSIFIED")
  assert.equal(classifyProvenance({ id: "g", provenance: "" }), "UNCLASSIFIED")
  assert.equal(isGenuine({ id: "g", provenance: "TOTALLY_BOGUS" }), false)
})

// ── Aggregated ───────────────────────────────────────────────────────────
test("trusted aggregator + real apply URL → AGGREGATED genuine", () => {
  const j: Classifiable = { id: "h1", source: "Himalayas", apply_url: REAL_URL }
  assert.equal(classifyProvenance(j), "AGGREGATED")
  assert.equal(isGenuine(j), true)
  assert.equal(isDistributable(j), true)
})
test("trusted aggregator WITHOUT real apply URL → UNCLASSIFIED", () => {
  const j: Classifiable = { id: "h2", source: "Himalayas", apply_url: "" }
  assert.equal(classifyProvenance(j), "UNCLASSIFIED")
  assert.equal(isGenuine(j), false)
})

// ── Curated ──────────────────────────────────────────────────────────────
test("editorial evidence + real apply URL → CURATED genuine", () => {
  const j: Classifiable = { id: "c1", source: "Noble Job — Curated", apply_url: REAL_URL }
  assert.equal(classifyProvenance(j), "CURATED")
  assert.equal(isGenuine(j), true)
})
test("curated label with placeholder URL is not genuine", () => {
  // A present placeholder URL trips the synthetic guard before curation.
  const j: Classifiable = { id: "c2", source: "Curated", apply_url: "#" }
  assert.equal(isGenuine(j), false)
})
test("explicit CURATED without a real apply URL is not genuine", () => {
  const j: Classifiable = { id: "c3", provenance: "CURATED" }
  assert.equal(isGenuine(j), false)
})

// ── Official government ──────────────────────────────────────────────────
test("govt board WITH real official URL → OFFICIAL genuine", () => {
  const j: Classifiable = { id: "gov1", board: "govt", official_url: "https://ssc.gov.in/notice" }
  assert.equal(classifyProvenance(j), "OFFICIAL")
  assert.equal(isGenuine(j), true)
  assert.equal(isSchemaEligible(j), true)
})
test("govt board WITHOUT any official/notification URL → UNCLASSIFIED", () => {
  const j: Classifiable = { id: "gov2", board: "govt" }
  assert.equal(classifyProvenance(j), "UNCLASSIFIED")
  assert.equal(isGenuine(j), false)
  assert.equal(isSchemaEligible(j), false)
})
test("govt board with notification URL is OFFICIAL", () => {
  const j: Classifiable = { id: "gov3", board: "govt", notification_url: "https://upsc.gov.in/n.pdf" }
  assert.equal(classifyProvenance(j), "OFFICIAL")
  assert.equal(isGenuine(j), true)
})
test("govt board with placeholder official URL → UNCLASSIFIED", () => {
  const j: Classifiable = { id: "gov4", board: "govt", official_url: "#" }
  assert.equal(classifyProvenance(j), "UNCLASSIFIED")
  assert.equal(isGenuine(j), false)
})

// ── Missing provenance / unknown sources / legacy DB rows ────────────────
test("missing provenance + no evidence → UNCLASSIFIED (fail closed)", () => {
  assert.equal(classifyProvenance({ id: "u1" }), "UNCLASSIFIED")
  assert.equal(isGenuine({ id: "u1" }), false)
})
test("unknown source with a real apply URL but no evidence → UNCLASSIFIED", () => {
  const j: Classifiable = { id: "u2", source: "Some Random Board", apply_url: REAL_URL }
  assert.equal(classifyProvenance(j), "UNCLASSIFIED")
  assert.equal(isGenuine(j), false)
})
test("legacy employer row: verified → EMPLOYER, unverified → UNCLASSIFIED", () => {
  const verified: Classifiable = { id: "l1", employer_id: "emp-9", is_verified: true }
  const unverified: Classifiable = { id: "l2", employer_id: "emp-9", is_verified: false }
  assert.equal(classifyProvenance(verified), "EMPLOYER")
  assert.equal(isGenuine(verified), true)
  assert.equal(classifyProvenance(unverified), "UNCLASSIFIED")
  assert.equal(isGenuine(unverified), false)
})

// ── Archived (openness axis) ─────────────────────────────────────────────
test("archived genuine job is countable but NOT publishable/indexable", () => {
  const j: Classifiable = { id: "a1", provenance: "EMPLOYER", employer_id: "emp-1", jobStatus: "ARCHIVED_JOB" }
  assert.equal(isOpen(j), false)
  assert.equal(isGenuine(j), true)
  assert.equal(isCountableAsGenuine(j), true)
  assert.equal(isPublishableAsOpen(j), false)
  assert.equal(isIndexable(j), false)
  assert.equal(isDistributable(j), false)
})
test("openness reads snake_case job_status alias", () => {
  assert.equal(isOpen({ job_status: "ARCHIVED_JOB" }), false)
  assert.equal(isOpen({ job_status: "LIVE_JOB" }), true)
})

// ── Verified-trust badge ─────────────────────────────────────────────────
test("hasVerifiedTrust: never for synthetic/unclassified, yes for genuine verified", () => {
  assert.equal(hasVerifiedTrust({ id: "live-priv-1", jobStatus: "VERIFIED_JOB", verified: true }), false)
  assert.equal(hasVerifiedTrust({ id: "u", verified: true }), false) // unclassified
  assert.equal(
    hasVerifiedTrust({ provenance: "EMPLOYER", employer_id: "e", jobStatus: "VERIFIED_JOB" }),
    true,
  )
})

// ── Invariants ───────────────────────────────────────────────────────────
test("UNCLASSIFIED and SYNTHETIC are not in GENUINE_PROVENANCE", () => {
  assert.equal(GENUINE_PROVENANCE.has("UNCLASSIFIED" as never), false)
  assert.equal(GENUINE_PROVENANCE.has("SYNTHETIC" as never), false)
  assert.equal(KNOWN_PROVENANCE.has("UNCLASSIFIED"), true)
  assert.equal(KNOWN_PROVENANCE.has("SYNTHETIC"), true)
})
test("gate aliases agree with isPublishableAsOpen", () => {
  const j: Classifiable = { provenance: "EMPLOYER", employer_id: "e", jobStatus: "LIVE_JOB" }
  assert.equal(isIndexable(j), isPublishableAsOpen(j))
  assert.equal(isSchemaEligible(j), isPublishableAsOpen(j))
  assert.equal(isDistributable(j), isPublishableAsOpen(j))
})

// ── Internal-link hygiene: jobDetailHref only links GENUINE jobs ──────────
test("jobDetailHref: synthetic/unclassified → null (no crawlable link)", () => {
  assert.equal(jobDetailHref("private", { id: "live-priv-101", provenance: "SYNTHETIC" }), null)
  assert.equal(jobDetailHref("wfh", { id: "ver-wfh-10193" }), null) // demo id prefix
  assert.equal(jobDetailHref("abroad", { id: "u", source: "Some Board", apply_url: REAL_URL }), null) // unclassified
})
test("jobDetailHref: genuine job → board-scoped path", () => {
  const emp: Classifiable & { id: string } = { id: "9f3k2a", provenance: "EMPLOYER", employer_id: "e" }
  assert.equal(jobDetailHref("private", emp), "/jobs/private/9f3k2a")
  const agg: Classifiable & { id: string } = { id: "h-1", source: "Himalayas", apply_url: REAL_URL }
  assert.equal(jobDetailHref("wfh", agg), "/jobs/wfh/h-1")
})
test("jobDetailHref: genuine but archived still links (openness ≠ genuineness)", () => {
  assert.equal(
    jobDetailHref("private", { id: "a1", provenance: "EMPLOYER", employer_id: "e", jobStatus: "ARCHIVED_JOB" }),
    "/jobs/private/a1",
  )
})
test("jobDetailHref: missing id → null", () => {
  assert.equal(jobDetailHref("private", { provenance: "EMPLOYER", employer_id: "e" }), null)
})

console.log(`\nprovenance tests: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
