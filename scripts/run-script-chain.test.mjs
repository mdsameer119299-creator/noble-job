// Proves the chain runner (a) runs steps AFTER a failure, (b) still exits non-zero, (c) exits 0 when all pass.
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const runner = path.resolve("scripts/run-script-chain.mjs")
let passed = 0, failed = 0
const test = (name, fn) => { try { fn(); passed++; console.log(`  PASS  ${name}`) } catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${String(e.message).split("\n")[0]}`) } }

function fixture(scripts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "chain-"))
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "t", version: "1.0.0", scripts }))
  return dir
}
const run = (dir, name) => spawnSync("node", [runner, name, "--cwd", dir], { encoding: "utf8" })

test("a failing step does not stop later steps, and the chain still FAILS", () => {
  const dir = fixture({
    a: "node -e \"console.log('A ran')\"", bad: "node -e \"process.exit(1)\"", c: "node -e \"console.log('C ran')\"",
    chain: "npm run a && npm run bad && npm run c",
  })
  const r = run(dir, "chain")
  assert.equal(r.status, 1, "must report failure")
  assert.match(r.stdout, /A ran/); assert.match(r.stdout, /C ran/, "step after the failure still executed")
  assert.match(r.stdout, /FAIL\s+bad/); assert.match(r.stderr, /1 suite\(s\) FAILED: bad/)
})
test("all steps passing exits 0", () => {
  const dir = fixture({ a: "node -e 0", b: "node -e 0", chain: "npm run a && npm run b" })
  const r = run(dir, "chain"); assert.equal(r.status, 0); assert.match(r.stdout, /2\/2 suites passed/)
})
test("multiple failures are all listed", () => {
  const dir = fixture({ x: "node -e \"process.exit(2)\"", y: "node -e \"process.exit(3)\"", z: "node -e 0", chain: "npm run x && npm run y && npm run z" })
  const r = run(dir, "chain"); assert.equal(r.status, 1); assert.match(r.stderr, /2 suite\(s\) FAILED: x, y/)
})
test("a script that is not a pure npm-run chain is rejected rather than half-run", () => {
  const dir = fixture({ a: "node -e 0", chain: "npm run a && echo hi" })
  assert.equal(run(dir, "chain").status, 2)
})
test("unknown script name is an error", () => {
  assert.equal(run(fixture({ a: "node -e 0" }), "nope").status, 2)
})
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
