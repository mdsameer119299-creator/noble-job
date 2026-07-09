/**
 * intelligence.test.ts — pure candidate-intelligence helper tests (tsx).
 *   npm run test:intel
 */
import assert from "node:assert/strict"
import { profileCompletion } from "./profileCompletion"
import { suggestSkills } from "./recommendations"
import { isCandidateStatus, statusMeta, DEFAULT_CANDIDATE_STATUS } from "./status"

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
    first_name: "A", last_name: "B", city: "Pune", category: "IT / Software",
    experience_years: "2-4", expected_salary: 800000, skills: ["Java", "SQL", "React"],
    resume_url: "cand/resume.pdf", email_verified: true, phone_verified: true, availability_status: "looking",
  })
  assert.equal(full.percent, 100)
  assert.equal(full.nextBest, null)
})
test("partial profile is between 0 and 100", () => {
  const r = profileCompletion({ resume_url: "x", skills: ["Java"] })
  assert.ok(r.percent > 0 && r.percent < 100)
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

console.log(`\ncandidate-intelligence tests: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
