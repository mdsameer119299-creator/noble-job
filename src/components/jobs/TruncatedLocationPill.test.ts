/**
 * TruncatedLocationPill.test.ts — regression coverage for `splitLocationList`,
 * the pure helper behind the job-card overflow fix (long Himalayas
 * `locationRestrictions` lists like "United States / Canada / United Kingdom
 * / Germany / France" no longer render as one unbounded pill).
 *
 * Only the pure split logic is tested here (no React render harness exists in
 * this repo's test convention — see other `*.test.ts` files, all dependency-
 * free `tsx` scripts). The component itself was verified by `tsc --noEmit` and
 * a production build.
 */
import assert from "node:assert"
import { splitLocationList } from "./TruncatedLocationPill"

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ok - ${name}`)
  } catch (e) {
    console.error(`  FAIL - ${name}`)
    console.error(e)
    process.exitCode = 1
  }
}

console.log("TruncatedLocationPill.splitLocationList")

test("splits a Himalayas-style slash-joined country list", () => {
  const parts = splitLocationList("United States / Canada / United Kingdom / Germany / France")
  assert.deepEqual(parts, ["United States", "Canada", "United Kingdom", "Germany", "France"])
})

test("splits a comma-joined list", () => {
  const parts = splitLocationList("Bengaluru, Mumbai, Delhi")
  assert.deepEqual(parts, ["Bengaluru", "Mumbai", "Delhi"])
})

test("a single plain value is returned as one-item list, not split further", () => {
  assert.deepEqual(splitLocationList("Remote — Worldwide"), ["Remote — Worldwide"])
  assert.deepEqual(splitLocationList("Bengaluru"), ["Bengaluru"])
})

test("empty/undefined input yields an empty list, never a fabricated placeholder", () => {
  assert.deepEqual(splitLocationList(""), [])
})

test("never drops a location: joining the split parts reconstructs every item", () => {
  const original = "USA / UK / Canada / Australia / Germany / Netherlands / Ireland"
  const parts = splitLocationList(original)
  assert.equal(parts.length, 7)
  for (const p of original.split(" / ")) assert.ok(parts.includes(p))
})

if (process.exitCode) process.exit(process.exitCode)
