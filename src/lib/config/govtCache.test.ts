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
import {
  GOVT_LIST_COLUMNS,
  GOVT_DETAIL_COLUMNS,
  GOVT_LIST_COLUMN_LIST,
  GOVT_HEAVY_DETAIL_COLUMN_LIST,
} from "./govtColumns"

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

// ── PR-E2: column projections ────────────────────────────────────────────
test("light pool projection EXCLUDES every heavy detail-body column", () => {
  for (const c of GOVT_HEAVY_DETAIL_COLUMN_LIST) {
    assert.ok(!GOVT_LIST_COLUMN_LIST.includes(c), `light projection must not include heavy column "${c}"`)
  }
})

test("light pool projection INCLUDES sitemap-indexability + card columns", () => {
  // govtClassifiable() reads these — dropping any would change sitemap contents.
  for (const c of ["id", "slug", "official_url", "notification_url", "notification_pdf", "apply_url", "job_status"]) {
    assert.ok(GOVT_LIST_COLUMN_LIST.includes(c), `light projection must include "${c}"`)
  }
  // Vacancy total comes from the `vacancies` string (not vacancy_breakup).
  assert.ok(GOVT_LIST_COLUMN_LIST.includes("vacancies"))
})

test("detail projection = light + heavy body columns; neither uses select(*)", () => {
  for (const c of GOVT_HEAVY_DETAIL_COLUMN_LIST) assert.match(GOVT_DETAIL_COLUMNS, new RegExp(`\\b${c}\\b`))
  for (const c of GOVT_LIST_COLUMN_LIST) assert.match(GOVT_DETAIL_COLUMNS, new RegExp(`\\b${c}\\b`))
  assert.doesNotMatch(GOVT_LIST_COLUMNS, /\*/)
  assert.doesNotMatch(GOVT_DETAIL_COLUMNS, /\*/)
})

test("pool read uses the light projection, not select(*)", () => {
  const src = read("src/lib/services/govtStatsSource.ts")
  assert.match(src, /\.select\(GOVT_LIST_COLUMNS\)/)
  assert.doesNotMatch(src, /\.select\("\*"\)/)
})

test("detail pages fetch a SINGLE row (slug/id .or) — not the full pool", () => {
  const src = read("src/lib/services/govtStatsSource.ts")
  assert.match(src, /\.select\(GOVT_DETAIL_COLUMNS\)/)
  assert.match(src, /\.or\(`slug\.eq\./)
  assert.match(src, /export const getGovtJobRow = cache\(/)
  const svc = read("src/lib/services/govtJobService.ts")
  // getGovtJobBySlug/ById must use the single-row fetch, not getActiveGovtRows.
  assert.match(svc, /getGovtJobRow\(slug\)/)
  assert.match(svc, /getGovtJobRow\(id\)/)
})

console.log(`\negress config tests: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
