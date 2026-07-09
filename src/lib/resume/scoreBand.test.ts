/**
 * scoreBand.test.ts — pure helper tests (no framework; run with tsx).
 *   npm run test:acq
 */
import assert from "node:assert/strict"
import { resumeScoreBand, anonProfileCompletion } from "./scoreBand"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`  PASS  ${name}`)
  } catch (err) {
    failed++
    console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`)
  }
}

test("bands map by threshold", () => {
  assert.equal(resumeScoreBand(92).label, "Excellent")
  assert.equal(resumeScoreBand(75).label, "Strong")
  assert.equal(resumeScoreBand(55).label, "Fair")
  assert.equal(resumeScoreBand(20).label, "Needs work")
})
test("score is clamped and non-finite is safe", () => {
  assert.equal(resumeScoreBand(1000).label, "Excellent")
  assert.equal(resumeScoreBand(-5).label, "Needs work")
  assert.equal(resumeScoreBand(NaN).label, "Needs work")
})
test("anon completion caps at 40 and rewards resume+skills+quality", () => {
  assert.equal(anonProfileCompletion({ hasResume: false, skillsCount: 0, score: 0 }), 0)
  assert.equal(anonProfileCompletion({ hasResume: true, skillsCount: 0, score: 0 }), 25)
  assert.equal(anonProfileCompletion({ hasResume: true, skillsCount: 3, score: 60 }), 40)
  assert.equal(anonProfileCompletion({ hasResume: true, skillsCount: 9, score: 99 }), 40)
})

console.log(`\ncandidate-acquisition tests: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
