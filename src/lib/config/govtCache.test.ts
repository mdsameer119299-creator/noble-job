/**
 * govtCache.test.ts — cache boundary/configuration tests for PR-E1.
 *   npm run test:egress
 *
 * The govt data source is RSC-coupled (react/next `cache`), so it cannot be
 * imported in a plain node harness. We therefore assert the pure TTL value and
 * verify the wiring by inspecting the source files (regex), which robustly
 * guards the emergency egress configuration against regression.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { GOVT_ROWS_CACHE_TTL_SECONDS } from "./govtCache"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), "utf8")

test("govt cache TTL is ~300s (behaviour-neutral, sub-hourly)", () => {
  assert.equal(GOVT_ROWS_CACHE_TTL_SECONDS, 300)
  assert.ok(GOVT_ROWS_CACHE_TTL_SECONDS > 0 && GOVT_ROWS_CACHE_TTL_SECONDS <= 600)
})

test("getActiveGovtRows is wrapped in a SHARED cross-request unstable_cache", () => {
  const src = read("src/lib/services/govtStatsSource.ts")
  assert.match(src, /import\s*\{\s*unstable_cache\s*\}\s*from\s*["']next\/cache["']/)
  assert.match(src, /unstable_cache\(\s*loadActiveGovtRows/)
  assert.match(src, /revalidate:\s*GOVT_ROWS_CACHE_TTL_SECONDS/)
  // React cache() retained for per-render dedupe.
  assert.match(src, /export const getActiveGovtRows = cache\(/)
  // The DB query itself is unchanged (same filters/visibility).
  assert.match(src, /\.eq\("status", "active"\)[\s\S]*\.eq\("review_status", "approved"\)[\s\S]*\.eq\("published", true\)/)
})

test("sitemap declares a 3600s revalidate and is cookie-less", () => {
  const src = read("src/app/sitemap.ts")
  assert.match(src, /export const revalidate = 3600/)
  // Must not use the cookie-based server client (would force dynamic in prod).
  assert.doesNotMatch(src, /from\s*["']@\/lib\/supabase\/server["']/)
})

console.log(`\negress config tests: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
