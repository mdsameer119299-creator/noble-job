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
import { govtKeyLookups } from "./govtKey"

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

test("detail pages fetch a SINGLE row — not the full pool", () => {
  const src = read("src/lib/services/govtStatsSource.ts")
  assert.match(src, /\.select\(GOVT_DETAIL_COLUMNS\)/)
  assert.match(src, /export const getGovtJobRow = cache\(/)
  const svc = read("src/lib/services/govtJobService.ts")
  // getGovtJobBySlug/ById must use the single-row fetch, not getActiveGovtRows.
  assert.match(svc, /getGovtJobRow\(slug\)/)
  assert.match(svc, /getGovtJobRow\(id\)/)
})

// ── PR-E3: govt id resolution (colon-ids) + injection safety ──────────────
test("single-row fetch uses parameterized .eq() (slug + id), NOT a raw .or() string", () => {
  const src = read("src/lib/services/govtStatsSource.ts")
  assert.match(src, /govtKeyLookups\(slugOrId\)/)
  assert.match(src, /\.eq\(column, value\)/)
  // Must NOT interpolate the user key into a combined .or() filter grammar.
  assert.doesNotMatch(src, /\.or\(`slug\.eq\.\$\{/)
  assert.doesNotMatch(src, /\.or\(`[^`]*\$\{(key|slugOrId|value)/)
  // Must NOT strip characters from the key (would corrupt colon-ids).
  assert.doesNotMatch(src, /sanitizeGovtKey/)
  assert.doesNotMatch(src, /replace\(\/\[\^a-zA-Z0-9/)
})

test("govtKeyLookups preserves colon-containing ids VERBATIM (PR-E2 regression)", () => {
  const id = "mppsc:mppsc-2025-20-06-20"
  const l = govtKeyLookups(id)
  assert.deepEqual(l, [["slug", id], ["id", id]])
  // slug tried first (public URLs are slugs), id second (may contain ':').
  assert.equal(l[0][0], "slug")
  assert.equal(l[1][0], "id")
  assert.equal(l[1][1], id) // colon NOT stripped
})

test("govtKeyLookups passes filter-breaking chars through as a VALUE (no injection)", () => {
  for (const bad of ["a,b)c(d", 'x".eq."y', "id.eq.evil", "a)or(b"]) {
    const l = govtKeyLookups(bad)
    // The raw string is preserved as the .eq() value — it is never spliced into
    // filter grammar, so it cannot add or break filters.
    assert.equal(l[0][1], bad)
    assert.equal(l[1][1], bad)
  }
})

test("govtKeyLookups: normal + hyphen/number slugs preserved; empty → none", () => {
  assert.equal(govtKeyLookups("ssc-cgl-2026-27-recruitment")[0][1], "ssc-cgl-2026-27-recruitment")
  assert.equal(govtKeyLookups("madhya-pradesh-public-service-commission-2025-20-06-2026")[1][1], "madhya-pradesh-public-service-commission-2025-20-06-2026")
  assert.deepEqual(govtKeyLookups(""), [])
  assert.deepEqual(govtKeyLookups("   "), [])
})

console.log(`\negress config tests: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
