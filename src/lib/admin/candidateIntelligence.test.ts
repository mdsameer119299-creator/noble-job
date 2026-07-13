/**
 * candidateIntelligence.test.ts — pure logic for the admin Candidates view.
 *   npm run test:admin-candidates
 */
import assert from "node:assert/strict"
import {
  resolveCategory,
  formatCareerScore,
  computeLastActivity,
  aggregateApplications,
  latestScoreByUser,
  mergeCandidateRows,
  type CandidateBase,
  type AppRow,
  type ScoreRow,
} from "./candidateIntelligence"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}

// ── category: never overwrite a candidate-selected one ───────────────────
test("resolveCategory keeps the candidate's own category (never overwritten)", () => {
  assert.deepEqual(resolveCategory("Banking", "IT"), { category: "Banking", derived: false })
  assert.deepEqual(resolveCategory("  Banking  ", "IT"), { category: "Banking", derived: false })
})
test("resolveCategory derives from the applied job only when own is empty", () => {
  assert.deepEqual(resolveCategory(null, "IT"), { category: "IT", derived: true })
  assert.deepEqual(resolveCategory("", "IT"), { category: "IT", derived: true })
  assert.deepEqual(resolveCategory("   ", " Railway "), { category: "Railway", derived: true })
})
test("resolveCategory → null when neither is present (no fabrication)", () => {
  assert.deepEqual(resolveCategory(null, null), { category: null, derived: false })
  assert.deepEqual(resolveCategory("", ""), { category: null, derived: false })
})

// ── career score: never 0% for a missing score ───────────────────────────
test("formatCareerScore shows a real number, else 'Not Scored'", () => {
  assert.equal(formatCareerScore(72), "72")
  assert.equal(formatCareerScore(72.6), "73")
  assert.equal(formatCareerScore(null), "Not Scored")
  assert.equal(formatCareerScore(undefined), "Not Scored")
  assert.equal(formatCareerScore(NaN), "Not Scored")
  // a genuine 0 is a real score, not the "missing" sentinel
  assert.equal(formatCareerScore(0), "0")
})

// ── last activity ────────────────────────────────────────────────────────
test("computeLastActivity picks the most recent valid timestamp", () => {
  assert.equal(computeLastActivity("2026-01-01T00:00:00Z", "2026-05-01T00:00:00Z", null), "2026-05-01T00:00:00Z")
  assert.equal(computeLastActivity(null, undefined, ""), null)
  assert.equal(computeLastActivity("2026-01-01T00:00:00Z"), "2026-01-01T00:00:00Z")
})

// ── aggregation ──────────────────────────────────────────────────────────
test("aggregateApplications counts + picks the latest job (real or imported)", () => {
  const apps: AppRow[] = [
    { candidate_id: "c1", applied_at: "2026-01-01T00:00:00Z", jobs: { title: "Clerk", category: "Banking" } },
    { candidate_id: "c1", applied_at: "2026-03-01T00:00:00Z", jobs: null, notes: JSON.stringify({ title: "Data Analyst" }) },
    { candidate_id: "c2", applied_at: "2026-02-01T00:00:00Z", jobs: { title: "Engineer", category: "IT" } },
  ]
  const agg = aggregateApplications(apps)
  assert.equal(agg.get("c1")!.count, 2)
  assert.equal(agg.get("c1")!.latestTitle, "Data Analyst") // most recent, from imported notes
  assert.equal(agg.get("c2")!.latestTitle, "Engineer")
})

test("latestScoreByUser keeps the most recent real numeric score", () => {
  const scores: ScoreRow[] = [
    { user_id: "u1", created_at: "2026-01-01T00:00:00Z", props: { score: 40 } },
    { user_id: "u1", created_at: "2026-04-01T00:00:00Z", props: { score: 81 } },
    { user_id: "u2", created_at: "2026-02-01T00:00:00Z", props: { score: null } }, // ignored
    { user_id: null, created_at: "2026-02-01T00:00:00Z", props: { score: 50 } },    // ignored
  ]
  const m = latestScoreByUser(scores)
  assert.equal(m.get("u1"), 81)
  assert.equal(m.has("u2"), false)
})

// ── full merge ───────────────────────────────────────────────────────────
test("mergeCandidateRows produces truthful enriched rows", () => {
  const candidates: CandidateBase[] = [
    { id: "c1", user_id: "u1", first_name: "Ravi", last_name: "Kumar", category: null, profile_score: 0, resume_url: "path.pdf", updated_at: "2026-01-01T00:00:00Z", users: { email: "ravi@x.com", status: "active" } },
    { id: "c2", user_id: "u2", first_name: "Asha", last_name: null, category: "Banking", profile_score: 60, resume_url: null, updated_at: "2026-01-02T00:00:00Z", users: { email: "asha@x.com", status: "suspended" } },
  ]
  const apps: AppRow[] = [
    { candidate_id: "c1", applied_at: "2026-05-01T00:00:00Z", jobs: { title: "SDE", category: "IT" } },
  ]
  const scores: ScoreRow[] = [{ user_id: "u1", created_at: "2026-06-01T00:00:00Z", props: { score: 77 } }]
  const rows = mergeCandidateRows(candidates, apps, scores)

  const r1 = rows.find(r => r.id === "c1")!
  assert.equal(r1.name, "Ravi Kumar")
  assert.equal(r1.category, "IT")            // derived from applied job (own was empty)
  assert.equal(r1.categoryDerived, true)
  assert.equal(r1.applicationsCount, 1)
  assert.equal(r1.latestAppliedJob, "SDE")
  assert.equal(r1.resumeUploaded, true)
  assert.equal(r1.careerScore, 77)           // real persisted score
  assert.equal(r1.profileCompletion, 0)      // real profile score (0 is legitimate here)
  assert.equal(r1.lastActivity, "2026-06-01T00:00:00Z") // latest of updated/apply/score

  const r2 = rows.find(r => r.id === "c2")!
  assert.equal(r2.category, "Banking")       // own category kept, never overwritten
  assert.equal(r2.categoryDerived, false)
  assert.equal(r2.applicationsCount, 0)
  assert.equal(r2.latestAppliedJob, null)
  assert.equal(r2.resumeUploaded, false)
  assert.equal(r2.careerScore, null)         // no persisted score → UI shows "Not Scored"
})

console.log(`\ncandidate-intelligence tests: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
