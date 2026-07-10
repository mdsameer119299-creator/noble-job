/**
 * intelligence.test.ts — pure candidate-intelligence helper tests (tsx).
 *   npm run test:intel
 */
import assert from "node:assert/strict"
import { profileCompletion } from "./profileCompletion"
import { suggestSkills } from "./recommendations"
import { isCandidateStatus, statusMeta, DEFAULT_CANDIDATE_STATUS } from "./status"
import { careerScoreOutcome } from "../services/candidateIntelligence"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}

test("empty profile → 0% and nextBest is the highest-impact item (resume)", () => {
  const r = profileCompletion({})
  assert.equal(r.percent, 0)
  assert.equal(r.completed, 0)
  assert.equal(r.nextBest?.key, "resume")
})
test("each item carries a benefit string", () => {
  const r = profileCompletion({})
  assert.ok(r.items.every(i => i.benefit.length > 0))
})
test("completion percent rises with fields and caps at 100", () => {
  const full = profileCompletion({
    first_name: "A", last_name: "B", phone: "9999999999", city: "Pune", category: "IT / Software",
    experience_years: "2-4", skills: ["Java", "SQL", "React"],
    resume_url: "cand/resume.pdf", availability_status: "looking",
  })
  assert.equal(full.percent, 100)
  assert.equal(full.nextBest, null)
})
test("partial profile is between 0 and 100", () => {
  const r = profileCompletion({ resume_url: "x", skills: ["Java"] })
  assert.ok(r.percent > 0 && r.percent < 100)
})
test("every completion item links to an existing candidate screen", () => {
  const allowed = new Set(["/candidate/resume", "/candidate/profile", "/candidate/dashboard"])
  for (const i of profileCompletion({}).items) assert.ok(allowed.has(i.href), `bad href ${i.href}`)
})

test("suggestSkills excludes skills already held and respects the field", () => {
  const s = suggestSkills("IT / Software", ["React", "Python"])
  assert.ok(!s.includes("React") && !s.includes("Python"))
  assert.ok(s.length > 0 && s.length <= 6)
})
test("suggestSkills falls back to generic skills for unknown field", () => {
  const s = suggestSkills(null, [])
  assert.ok(s.includes("Communication"))
})

test("status guard + meta", () => {
  assert.equal(isCandidateStatus("interviewing"), true)
  assert.equal(isCandidateStatus("nonsense"), false)
  assert.equal(statusMeta("bad").value, DEFAULT_CANDIDATE_STATUS)
  assert.equal(statusMeta("hired").value, "hired")
})

// Career Score persistence outcome (idempotency + strict failure reporting)
test("first score → persisted, changed, logs activity", () => {
  const o = careerScoreOutcome(null, 72, true)
  assert.deepEqual(o, { scorePersisted: true, changed: true, shouldLogActivity: true })
})
test("recompute with same score → idempotent, no duplicate activity", () => {
  const o = careerScoreOutcome(72, 72, true)
  assert.equal(o.changed, false)
  assert.equal(o.shouldLogActivity, false)
})
test("failed DB write → NOT persisted and never logs a misleading event", () => {
  const o = careerScoreOutcome(50, 72, false)
  assert.equal(o.scorePersisted, false)
  assert.equal(o.shouldLogActivity, false)
})

console.log(`\ncandidate-intelligence tests: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
