/**
 * sitemapPolicy.test.ts — Phase 1 sitemap, location-gate, canonical, pagination
 * and related-link tests.
 *
 *   npm run test:seo-phase1
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  finalizeSitemap,
  isExcludedPath,
  jobRowsToSitemapEntries,
  latestDate,
  toLastModified,
  validateSitemapEntries,
  type SitemapEntry,
  type SitemapJobRow,
} from "./sitemapPolicy"
import {
  countGenuineOpen,
  meetsGenuineThreshold,
  thresholdFromEnv,
  TAIL_CITY_MIN_GENUINE_JOBS,
  CITY_CATEGORY_MIN_GENUINE_JOBS,
  GOVT_STATE_MIN_JOBS,
  GOVT_STATE_DEFAULT_MIN_JOBS,
} from "./indexThresholds"
import { buildPageMetadata, listingMeta, paginationMeta, pageFromSearchParams } from "./metadata"
import { relatedJobHref, toRelatedLinks } from "./relatedLinks"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), "utf8")
const BASE = "https://www.noblejob.in"
const NOW = new Date("2026-09-19T10:00:00.000Z")

const genuine = (id: string, posted: string, over: Partial<SitemapJobRow> = {}): SitemapJobRow => ({
  id, posted_at: posted, provenance: "EMPLOYER", employer_id: "emp-1", is_verified: true, status: "active", ...over,
})

/* ------------------------------ sitemap rows ------------------------------ */

test("synthetic jobs can NEVER enter the sitemap (explicit provenance, demo id, demo source)", () => {
  const rows: SitemapJobRow[] = [
    genuine("live-priv-1", "2026-08-01T00:00:00Z", { provenance: "SYNTHETIC" }),
    genuine("live-priv-2", "2026-08-01T00:00:00Z", { provenance: undefined, employer_id: undefined, is_verified: false }),
    genuine("ver-wfh-7", "2026-08-01T00:00:00Z", { provenance: null, employer_id: null }),
    genuine("arch-abroad-uae-3", "2026-08-01T00:00:00Z", { provenance: null, employer_id: null }),
    genuine("row-x", "2026-08-01T00:00:00Z", { provenance: null, employer_id: null, source: "Live Feed", is_verified: false }),
  ]
  for (const board of ["private", "wfh", "abroad"] as const) {
    assert.deepEqual(jobRowsToSitemapEntries(board, rows, BASE, { now: NOW }), [], board)
  }
})
test("unclassified rows (no provenance, no employer evidence) are excluded", () => {
  const r = genuine("u1", "2026-08-01T00:00:00Z", { provenance: null, employer_id: null, is_verified: false })
  assert.equal(jobRowsToSitemapEntries("private", [r], BASE, { now: NOW }).length, 0)
})
test("closed / paused / pending / archived / deadline-expired jobs are excluded (noindex pages never listed)", () => {
  const rows = [
    genuine("closed", "2026-08-01T00:00:00Z", { status: "closed" }),
    genuine("paused", "2026-08-01T00:00:00Z", { status: "paused" }),
    genuine("pending", "2026-08-01T00:00:00Z", { status: "pending" }),
    genuine("archived", "2026-08-01T00:00:00Z", { job_status: "ARCHIVED_JOB" }),
    genuine("expired", "2026-08-01T00:00:00Z", { application_deadline: "2026-09-01T00:00:00Z" }),
  ]
  assert.deepEqual(jobRowsToSitemapEntries("private", rows, BASE, { now: NOW }), [])
})
test("a genuine open job IS listed, on its own board path, with its REAL posting date as lastmod", () => {
  const [e] = jobRowsToSitemapEntries("wfh", [genuine("abc", "2026-08-01T05:30:00Z")], BASE, { now: NOW })
  assert.equal(e.url, `${BASE}/jobs/wfh/abc`)
  assert.equal(e.lastModified?.toISOString(), "2026-08-01T05:30:00.000Z")
})
test("a job with a future (real) deadline is still listed", () => {
  const rows = [genuine("ok", "2026-08-01T00:00:00Z", { application_deadline: "2026-12-31T00:00:00Z" })]
  assert.equal(jobRowsToSitemapEntries("private", rows, BASE, { now: NOW }).length, 1)
})
test("private / WFH / abroad rows come from the DB reader — never the local synthetic inventory", () => {
  const src = read("src/app/sitemap.ts")
  assert.doesNotMatch(src, /jobInventory|WFH_INVENTORY|ABROAD_INVENTORY/)
  assert.match(src, /readSitemapJobRows/)
  const reader = read("src/lib/seo/sitemapJobs.ts")
  for (const t of ["jobs", "wfh_jobs", "abroad_jobs"]) assert.match(reader, new RegExp(`"${t}"`))
})

/* -------------------------------- lastmod -------------------------------- */

test("lastmod is NOT the generation time: sitemap.ts never assigns `now` as lastModified", () => {
  const src = read("src/app/sitemap.ts")
  assert.doesNotMatch(src, /lastModified:\s*now\b/)
  assert.doesNotMatch(src, /lastModified:\s*new Date\(\)/)
  assert.doesNotMatch(src, /new Date\([^)]*\|\|\s*now/)
})
test("lastmod comes from real per-row dates and therefore DIFFERS across URLs", () => {
  const rows = [
    genuine("a", "2026-07-01T00:00:00Z"),
    genuine("b", "2026-07-15T00:00:00Z"),
    genuine("c", "2026-08-01T00:00:00Z"),
    genuine("d", "2026-08-20T00:00:00Z"),
    genuine("e", "2026-09-10T00:00:00Z"),
  ]
  const entries = jobRowsToSitemapEntries("private", rows, BASE, { now: NOW })
  assert.equal(new Set(entries.map(e => e.lastModified!.getTime())).size, 5)
  assert.deepEqual(validateSitemapEntries(entries, { base: BASE, now: NOW }).errors, [])
})
test("validator REJECTS a sitemap stamped with the generation time on every URL", () => {
  const stamped: SitemapEntry[] = Array.from({ length: 8 }, (_, i) => ({ url: `${BASE}/p${i}`, lastModified: new Date(NOW) }))
  const { errors } = validateSitemapEntries(stamped, { base: BASE, now: NOW })
  assert.ok(errors.some(e => /generation time/.test(e)), errors.join(" | "))
  // One shared value across a LARGE sitemap (not the generation time) is also rejected…
  const same: SitemapEntry[] = Array.from({ length: 25 }, (_, i) => ({ url: `${BASE}/q${i}`, lastModified: new Date("2026-06-20T00:00:00Z") }))
  assert.ok(validateSitemapEntries(same, { base: BASE, now: NOW }).errors.some(e => /identical lastmod/.test(e)))
  // …while a few pages sharing one authored date only warn.
  const few = same.slice(0, 5)
  const v = validateSitemapEntries(few, { base: BASE, now: NOW })
  assert.deepEqual(v.errors, []); assert.ok(v.warnings.some(w => /identical lastmod/.test(w)))
})
test("a row with no valid posting date is listed WITHOUT lastmod (never a made-up one)", () => {
  const rows = [
    genuine("nodate", ""),
    genuine("junk", "2 days ago"),
    genuine("future", "2099-01-01T00:00:00Z"),
  ]
  for (const e of jobRowsToSitemapEntries("private", rows, BASE, { now: NOW })) {
    assert.equal(e.lastModified, undefined, e.url)
  }
})
test("toLastModified: first REAL non-future date wins; junk/empty → undefined", () => {
  assert.equal(toLastModified([undefined, "", "junk", "2026-08-01"], NOW)?.toISOString(), "2026-08-01T00:00:00.000Z")
  assert.equal(toLastModified(["2099-01-01"], NOW), undefined)
  assert.equal(toLastModified([], NOW), undefined)
  assert.equal(latestDate([undefined, new Date("2026-01-01"), new Date("2026-06-01")])?.toISOString(), "2026-06-01T00:00:00.000Z")
  assert.equal(latestDate([]), undefined)
})
test("govt lastmod is content_changed_at only — never updated_at or now", () => {
  const src = read("src/app/sitemap.ts")
  assert.match(src, /j\.contentChangedAt/)
  assert.doesNotMatch(src, /updatedAt|updated_at/)
})

/* ------------------------------- exclusions ------------------------------- */

test("auth / api / admin / dashboards / 404 paths are excluded", () => {
  for (const p of ["/auth", "/auth/callback", "/api/jobs", "/admin", "/admin/users", "/employer/dashboard", "/candidate/profile", "/404", "/_next/static/x"]) {
    assert.equal(isExcludedPath(p), true, p)
  }
  for (const p of ["/", "/jobs/govt", "/authors", "/jobs/private/abc", "/guides"]) assert.equal(isExcludedPath(p), false, p)
})
test("finalizeSitemap drops filtered / paginated / tracking URLs, auth, redirect sources and duplicates", () => {
  const all: SitemapEntry[] = [
    { url: `${BASE}/jobs/govt` },
    { url: `${BASE}/jobs/govt` }, // dup
    { url: `${BASE}/jobs/govt?page=2` }, // pagination
    { url: `${BASE}/jobs/private?q=driver` }, // filter
    { url: `${BASE}/jobs/wfh?utm_source=x` }, // tracking
    { url: `${BASE}/auth` },
    { url: `${BASE}/api/health` },
    { url: `${BASE}/jobs` }, // redirect source
    { url: `https://evil.example/jobs/x` }, // off-origin
    { url: `${BASE}/jobs/private/abc` },
  ]
  const out = finalizeSitemap(all, { base: BASE, redirectSources: new Set(["/jobs"]) }).map(e => e.url)
  assert.deepEqual(out, [`${BASE}/jobs/govt`, `${BASE}/jobs/private/abc`])
})
test("validator flags query URLs, auth paths, redirect sources, duplicates, off-origin and future lastmod", () => {
  const bad: SitemapEntry[] = [
    { url: `${BASE}/jobs/govt?page=2` },
    { url: `${BASE}/auth` },
    { url: `${BASE}/jobs` },
    { url: `${BASE}/x` }, { url: `${BASE}/x` },
    { url: `https://other.example/y` },
    { url: `${BASE}/z`, lastModified: new Date("2099-01-01") },
  ]
  const { errors } = validateSitemapEntries(bad, { base: BASE, now: NOW, redirectSources: new Set(["/jobs"]) })
  for (const re of [/query/, /auth/, /redirect source/, /duplicate/, /off-origin/, /future lastmod/]) {
    assert.ok(errors.some(e => re.test(e)), `expected an error matching ${re}: ${errors.join(" | ")}`)
  }
})
test("sitemap.ts wires the exclusions in and only lists govt states that have their own jobs", () => {
  const src = read("src/app/sitemap.ts")
  assert.match(src, /finalizeSitemap\(/)
  assert.match(src, /GOVT_STATE_MIN_JOBS/)
  assert.match(src, /export const revalidate = 3600/)
  assert.doesNotMatch(src, /INDIAN_STATES\.map\(s => \(\{\s*url/)
})
test("sitemap failure policy: strict govt read + throws at runtime, tolerant only during next build", () => {
  const src = read("src/app/sitemap.ts")
  assert.match(src, /getActiveGovtRowsStrict/)
  assert.match(src, /phase-production-build/)
})
test("sitemap does not list auth (raw source check used by verify-seo too)", () => {
  assert.doesNotMatch(read("src/app/sitemap.ts"), /["'`]\/auth/)
})

/* ---------------------------- genuine location gates ---------------------------- */

const synthetic = (i: number) => ({ id: `live-priv-${i}`, board: "private", jobStatus: "LIVE_JOB" })
const real = (i: number) => ({ id: `real-${i}`, board: "private", provenance: "EMPLOYER", employer_id: "e", is_verified: true, status: "active" })

test("govt state threshold: default is 3 (no Search Console evidence for a lower bar)", () => {
  assert.equal(GOVT_STATE_DEFAULT_MIN_JOBS, 3)
  assert.equal(thresholdFromEnv("SEO_MIN_JOBS_GOVT_STATE", GOVT_STATE_DEFAULT_MIN_JOBS, {}), 3)
  if (process.env.SEO_MIN_JOBS_GOVT_STATE === undefined) assert.equal(GOVT_STATE_MIN_JOBS, 3)
  // Still tunable per environment, but junk falls back to 3, never to 1 or 0.
  assert.equal(thresholdFromEnv("SEO_MIN_JOBS_GOVT_STATE", GOVT_STATE_DEFAULT_MIN_JOBS, { SEO_MIN_JOBS_GOVT_STATE: "5" }), 5)
  for (const bad of ["0", "-1", "abc", "", "2.5"]) {
    assert.equal(thresholdFromEnv("SEO_MIN_JOBS_GOVT_STATE", GOVT_STATE_DEFAULT_MIN_JOBS, { SEO_MIN_JOBS_GOVT_STATE: bad }), 3, bad)
  }
})
test("govt state threshold: 1–2 own openings are NOT enough; the page and the sitemap use the same rule", () => {
  const passes = (own: number) => own >= GOVT_STATE_MIN_JOBS
  if (process.env.SEO_MIN_JOBS_GOVT_STATE === undefined) {
    assert.equal(passes(0), false)
    assert.equal(passes(1), false)
    assert.equal(passes(2), false)
    assert.equal(passes(3), true)
  }
  assert.match(read("src/app/sitemap.ts"), /s\.total >= GOVT_STATE_MIN_JOBS/)
  assert.match(read("src/app/jobs/govt/state/[slug]/page.tsx"), /own\.total < GOVT_STATE_MIN_JOBS/)
  assert.doesNotMatch(read("src/lib/seo/indexThresholds.ts"), /SEO_MIN_JOBS_GOVT_STATE",\s*1\)/)
})
test("location gates ignore synthetic inventory: 500 demo rows do not clear any threshold", () => {
  const demo = Array.from({ length: 500 }, (_, i) => synthetic(i))
  assert.equal(countGenuineOpen(demo), 0)
  assert.equal(meetsGenuineThreshold(demo, TAIL_CITY_MIN_GENUINE_JOBS), false)
  assert.equal(meetsGenuineThreshold(demo, CITY_CATEGORY_MIN_GENUINE_JOBS), false)
})
test("location gates count only genuine open jobs (mixed list)", () => {
  const mixed = [
    ...Array.from({ length: 100 }, (_, i) => synthetic(i)),
    ...Array.from({ length: 3 }, (_, i) => real(i)),
    { ...real(99), status: "closed" }, // closed → does not count
    { id: "u", board: "private" }, // unclassified → does not count
  ]
  assert.equal(countGenuineOpen(mixed), 3)
  assert.equal(meetsGenuineThreshold(mixed, 3), true)
  assert.equal(meetsGenuineThreshold(mixed, 4), false)
})
test("thresholds are configurable and validated", () => {
  assert.equal(thresholdFromEnv("X", 5, { X: "9" }), 9)
  assert.equal(thresholdFromEnv("X", 5, { X: "0" }), 5)
  assert.equal(thresholdFromEnv("X", 5, { X: "abc" }), 5)
  assert.equal(thresholdFromEnv("X", 5, {}), 5)
})
test("tail-city and city×category landings read jobs through the genuine-only reader", () => {
  for (const f of ["src/lib/seo/tailCityLanding.ts", "src/lib/seo/cityCategoryLanding.ts"]) {
    assert.match(read(f), /getGenuineOpenJobs/, f)
  }
})
test("gate lives in the data layer; the existing 404-under-threshold architecture is retained (no new pages/routes)", () => {
  assert.match(read("src/components/landing/renderTailCityLanding.tsx"), /TAIL_CITY_MIN_JOBS[\s\S]*notFound\(\)|notFound\(\)[\s\S]*TAIL_CITY_MIN_JOBS/)
  assert.match(read("src/lib/seo/tailCityLanding.ts"), /TAIL_CITY_MIN_GENUINE_JOBS/)
  assert.match(read("src/lib/seo/cityCategoryLanding.ts"), /CITY_CATEGORY_MIN_GENUINE_JOBS/)
})

/* ------------------------- canonicals / 404 / auth ------------------------- */

test("404 page: metadata has NO canonical and NO og:url, and is noindex", () => {
  const m = buildPageMetadata({ title: "Page Not Found", description: "d", noIndex: true, noCanonical: true })
  assert.equal(m.alternates, undefined)
  assert.equal((m.openGraph as { url?: string } | undefined)?.url, undefined)
  assert.equal((m.robots as { index?: boolean }).index, false)
  const src = read("src/app/not-found.tsx")
  assert.doesNotMatch(src, /path:\s*['"]\/404['"]/, "404 must not canonicalise to /404")
  assert.match(src, /noCanonical:\s*true/)
})
test("root layout no longer hands EVERY route the homepage canonical", () => {
  const src = read("src/app/layout.tsx")
  assert.match(src, /noCanonical:\s*true/)
  const m = buildPageMetadata({ title: "t", description: "d", noCanonical: true })
  assert.equal(m.alternates, undefined)
})
test("/auth: noindex and NO inherited homepage canonical (self or absent)", () => {
  const layout = read("src/app/auth/layout.tsx")
  assert.match(layout, /index:\s*false/)
  assert.doesNotMatch(layout, /canonical/)
  assert.doesNotMatch(read("src/app/auth/page.tsx"), /canonical|alternates/)
  // Effective canonical chain: root has none, auth sets none → absent.
  assert.match(read("src/app/layout.tsx"), /noCanonical:\s*true/)
})
test("the homepage still sets its OWN canonical", () => {
  assert.match(read("src/app/page.tsx"), /buildPageMetadata/)
})
test("normal pages still canonicalise to the clean path (tracking params ignored)", () => {
  const m = buildPageMetadata({ title: "t", description: "d", path: "/jobs/private" })
  assert.equal((m.alternates as { canonical: string }).canonical, `https://www.noblejob.in/jobs/private`)
  assert.deepEqual(listingMeta("/jobs/private", { utm_source: "x", gclid: "y", fbclid: "z" }), {})
})

/* -------------------------------- pagination -------------------------------- */

test("page >= 2 → noindex,follow with a self canonical", () => {
  const m = paginationMeta("/jobs/private", 2)
  assert.equal((m.robots as { index: boolean; follow: boolean }).index, false)
  assert.equal((m.robots as { index: boolean; follow: boolean }).follow, true)
  assert.equal((m.alternates as { canonical: string }).canonical, "https://www.noblejob.in/jobs/private?page=2")
  assert.deepEqual(paginationMeta("/jobs/private", 1), {})
})
test("listingMeta is the ONE policy: filters → noindex,follow (clean canonical); page≥2 → noindex,follow", () => {
  for (const sp of [{ q: "driver" }, { category: "it" }, { country: "uae" }, { location: "delhi" }, { sort: "latest" }, { state: "up" }]) {
    const m = listingMeta("/jobs/wfh", sp)
    assert.equal((m.robots as { index: boolean }).index, false, JSON.stringify(sp))
    assert.equal(m.alternates, undefined, "filter variants keep the page's clean canonical")
  }
  const p2 = listingMeta("/jobs/govt", { page: "2" })
  assert.equal((p2.robots as { index: boolean; follow: boolean }).index, false)
  assert.equal((p2.robots as { index: boolean; follow: boolean }).follow, true)
  assert.deepEqual(listingMeta("/jobs/govt", { page: "1" }), {})
  assert.deepEqual(listingMeta("/jobs/govt", {}), {})
  assert.deepEqual(listingMeta("/jobs/govt", { q: "  " }), {}, "blank filter is not a filter")
})
test("pageFromSearchParams is safe on junk", () => {
  assert.equal(pageFromSearchParams({ page: "abc" }), 1)
  assert.equal(pageFromSearchParams({ page: "-4" }), 1)
  assert.equal(pageFromSearchParams({ page: ["3", "4"] }), 3)
  assert.equal(pageFromSearchParams(undefined), 1)
})
test("every job board and govt taxonomy page uses listingMeta (consistent pagination)", () => {
  for (const f of [
    "src/app/jobs/private/page.tsx", "src/app/jobs/wfh/page.tsx", "src/app/jobs/abroad/page.tsx", "src/app/jobs/govt/page.tsx",
    "src/app/jobs/govt/category/[slug]/page.tsx", "src/app/jobs/govt/qualification/[slug]/page.tsx", "src/app/jobs/govt/state/[slug]/page.tsx",
  ]) {
    assert.match(read(f), /listingMeta/, f)
  }
})
test("query params never create keyword landing pages: no page maps ?q= to a canonical of its own", () => {
  for (const f of ["src/app/jobs/private/page.tsx", "src/app/jobs/wfh/page.tsx", "src/app/jobs/abroad/page.tsx", "src/app/jobs/govt/page.tsx"]) {
    assert.doesNotMatch(read(f), /canonical:\s*`[^`]*\$\{[^}]*(q|search)[^}]*\}/, f)
  }
})

/* ------------------------------ related links ------------------------------ */

const gJob = { id: "g1", provenance: "EMPLOYER", employer_id: "e", is_verified: true, status: "active" }
const sJob = { id: "live-priv-9", jobStatus: "LIVE_JOB" }

test("a genuine indexable page never links to a synthetic/noindex job page", () => {
  assert.equal(relatedJobHref("private", sJob, { fromIndexablePage: true }), null)
  assert.equal(relatedJobHref("private", { ...gJob, status: "closed" }, { fromIndexablePage: true }), null)
  assert.equal(relatedJobHref("private", gJob, { fromIndexablePage: true }), "/jobs/private/g1")
  const links = toRelatedLinks("wfh", [sJob, gJob, sJob], { fromIndexablePage: true }, (j, href) => href)
  assert.deepEqual(links, ["/jobs/wfh/g1"])
})
test("a noindex/demo page keeps its own browsing continuity", () => {
  assert.equal(relatedJobHref("private", sJob, { fromIndexablePage: false }), "/jobs/private/live-priv-9")
})
test("all three job detail pages use the provenance-aware link builder", () => {
  for (const b of ["private", "wfh", "abroad"]) assert.match(read(`src/app/jobs/${b}/[id]/page.tsx`), /toRelatedLinks/, b)
})

console.log(`\nsitemap/seo policy tests: ${passed} passed, ${failed} failed`)
process.exitCode = failed ? 1 : 0
