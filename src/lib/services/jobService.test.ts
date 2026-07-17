/**
 * jobService.test.ts — proves withTimeout() actually bounds a stalled query
 * instead of just asserting it "should". Real timers (not fake/mocked) so the
 * race condition itself is exercised, not a simulation of it.
 *   npm run test:jobservice-timeout
 */
import assert from "node:assert/strict"
import { withTimeout, QueryTimeoutError } from "./jobService"

let passed = 0
let failed = 0
async function test(name: string, fn: () => Promise<void>) {
  try { await fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}

function delay<T>(ms: number, value: T): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), ms))
}

async function main() {
  await test("a fast promise resolves through withTimeout with its real value", async () => {
    const result = await withTimeout(delay(10, "ok"), 200)
    assert.equal(result, "ok")
  })

  await test("a promise that never settles is bounded — rejects at the timeout, not left hanging", async () => {
    const neverSettles = new Promise<string>(() => {})
    const start = Date.now()
    await assert.rejects(() => withTimeout(neverSettles, 50), QueryTimeoutError)
    const elapsed = Date.now() - start
    // Must reject at ~the bound, not immediately (else it's not really timing the promise)
    // and not way past it (else the timer itself is broken).
    assert.ok(elapsed >= 45 && elapsed < 500, `expected ~50ms, got ${elapsed}ms`)
  })

  await test("a promise that rejects on its own passes its real error through, not a timeout error", async () => {
    const boom = new Error("real supabase error")
    await assert.rejects(() => withTimeout(Promise.reject(boom), 200), (e: unknown) => e === boom)
  })

  await test("a slow-but-still-faster-than-the-bound promise is not falsely timed out", async () => {
    const result = await withTimeout(delay(20, "eventually"), 200)
    assert.equal(result, "eventually")
  })

  console.log(`\njobService withTimeout tests: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exitCode = 1
}

main()
