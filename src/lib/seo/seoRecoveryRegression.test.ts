/**
 * seoRecoveryRegression.test.ts — regression guards for the SEO / HREF / indexing recovery.
 *
 *   npm run test:seo-recovery
 *
 * Each block pins one confirmed production defect so it cannot silently return:
 *
 *   1. HREF       — aggregated (Himalayas) featured cards must link to their real external
 *                   URL, never to an internal `/jobs/<board>/himalayas:<hash>` detail path
 *                   (detail resolution only reads the `jobs` table → guaranteed 404).
 *   2. SSR        — the three job-board listing pages must fetch page data on the server and
 *                   hand it to their client panels, so crawlers receive real job content
 *                   instead of an empty "Loading…" shell.
 *   3. COUNTS     — abroad country cards must be counted by the same DB-backed service that
 *                   powers the abroad listing, not by the local-inventory-only fallback.
 *   2b. HYDRATION — the server render and the client list assemble the Private listing with ONE
 *                   shared merge (employer table + live Himalayas cache), and the first client
 *                   fetch is skipped only for the exact view the server rendered, so real
 *                   content is neither empty in the crawler's HTML nor flashed back to "Loading…".
 *   4. CLAIMS     — no fabricated trust / scale claims ("80,000+ verified openings",
 *                   "2,500+ companies", "50,000+ placed") in any user-facing surface.
 *
 * These are hermetic: no Supabase, no network, no database writes.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { featuredCardLink } from "../jobs/featuredCardLink"
import { mergePrivateListing } from "../jobs/mergePrivateListing"

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

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8")
/** Source with block + line comments removed, so a comment can never satisfy (or trip) an assertion. */
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")

// ─────────────────────────────────────────────────────────────────────────────────────────
// 1. HREF — aggregated featured cards link out, internal cards keep their detail path
// ─────────────────────────────────────────────────────────────────────────────────────────

type Card = Parameters<typeof featuredCardLink>[0]

test("HREF: FeaturedJobCard carries apply_url + provenance so the section can route correctly", () => {
  const src = code("src/lib/services/featuredJobs.ts")
  assert.match(src, /interface\s+FeaturedJobCard\b[\s\S]*?apply_url\?:\s*string/, "apply_url on FeaturedJobCard")
  assert.match(src, /interface\s+FeaturedJobCard\b[\s\S]*?provenance\?:\s*string/, "provenance on FeaturedJobCard")
})

test("HREF: every card builder in featuredJobs.ts populates apply_url (no builder drops it)", () => {
  const src = code("src/lib/services/featuredJobs.ts")
  const populated = (src.match(/apply_url:\s*j\.(applyUrl\s*\|\|\s*j\.)?apply_url/g) ?? []).length
  assert.ok(populated >= 6, `expected every card builder to set apply_url, found ${populated}`)
})

test("HREF: FeaturedJobsSection delegates to featuredCardLink() and branches on link.external", () => {
  const src = code("src/components/home/FeaturedJobsSection.tsx")
  assert.match(src, /import\s*\{\s*featuredCardLink\s*\}\s*from\s*["']@\/lib\/jobs\/featuredCardLink["']/, "imports the shared resolver")
  assert.match(src, /featuredCardLink\(\s*job\s*\)/, "resolves every card through it")
  assert.match(src, /link\.external\s*\?/, "renders external and internal cards differently")
})

test("HREF: featuredCardLink.ts is the ONLY place that builds an internal detail href from a card id", () => {
  const resolver = code("src/lib/jobs/featuredCardLink.ts")
  assert.match(resolver, /startsWith\(\s*["']himalayas:["']\s*\)/, "detects himalayas-sourced ids")
  assert.equal((resolver.match(/\/jobs\/\$\{[^}]+\}\/\$\{[^}]+\}/g) ?? []).length, 1, "one internal template in the resolver")
  const section = code("src/components/home/FeaturedJobsSection.tsx")
  assert.doesNotMatch(section, /\/jobs\/\$\{[^}]+\}\/\$\{[^}]+\}/, "the component must not hand-build a detail href from job.id")
})

test("HREF: external aggregated cards render as <a target=_blank rel=noopener noreferrer>, internal ones as next/link", () => {
  const src = code("src/components/home/FeaturedJobsSection.tsx")
  assert.match(src, /<a\b[^>]*href=\{link\.href\}[^>]*target="_blank"[^>]*rel="noopener noreferrer"/, "external anchor")
  assert.match(src, /<Link\b[^>]*href=\{link\.href\}/, "internal next/link")
})

test("HREF: aggregated cards are never labelled 'Verified' (aggregator jobs are not employer-verified)", () => {
  const src = code("src/components/home/FeaturedJobsSection.tsx")
  assert.match(src, /link\.external\s*\n?\s*\?\s*<span[^>]*>Source/, "external cards get the 'Source' badge")
  assert.match(src, /:\s*<span[^>]*>Verified<\/span>/, "only internal (genuine) cards get 'Verified'")
})

test("HREF matrix: himalayas card → external URL; native cards → internal detail path", () => {
  const cases: Array<[Card, { href: string; external: boolean }]> = [
    [{ id: "himalayas:3f9a1c", board: "wfh", apply_url: "https://himalayas.app/jobs/abc" }, { href: "https://himalayas.app/jobs/abc", external: true }],
    [{ id: "himalayas:77be02", board: "private", apply_url: "https://himalayas.app/jobs/xyz" }, { href: "https://himalayas.app/jobs/xyz", external: true }],
    [{ id: "himalayas:55d0e1", board: "abroad", apply_url: "https://himalayas.app/jobs/qrs" }, { href: "https://himalayas.app/jobs/qrs", external: true }],
    // A native row id (uuid) keeps its internal detail page on every board.
    [{ id: "9b2f6c1e-0000-4000-8000-000000000001", board: "private", apply_url: "https://employer.example/apply" }, { href: "/jobs/private/9b2f6c1e-0000-4000-8000-000000000001", external: false }],
    [{ id: "9b2f6c1e-0000-4000-8000-000000000002", board: "wfh" }, { href: "/jobs/wfh/9b2f6c1e-0000-4000-8000-000000000002", external: false }],
    [{ id: "9b2f6c1e-0000-4000-8000-000000000003", board: "abroad" }, { href: "/jobs/abroad/9b2f6c1e-0000-4000-8000-000000000003", external: false }],
    // Defensive: an aggregated id with NO source URL must not become an external link to nowhere;
    // it falls through to the internal path (and is filtered upstream by filterActionable).
    [{ id: "himalayas:deadbeef", board: "wfh" }, { href: "/jobs/wfh/himalayas:deadbeef", external: false }],
  ]
  for (const [card, want] of cases) assert.deepEqual(featuredCardLink(card), want, card.id)
})

// ─────────────────────────────────────────────────────────────────────────────────────────
// 2. SSR — listing pages ship real job markup on first response
// ─────────────────────────────────────────────────────────────────────────────────────────

const BOARDS = [
  { page: "src/app/jobs/private/page.tsx", panel: "src/components/jobs/LiveJobsList.tsx", component: "LiveJobsList", type: "InitialJobData", service: "getJobs", field: "" },
  { page: "src/app/jobs/wfh/page.tsx", panel: "src/components/wfh/WfhJobsPanel.tsx", component: "WfhJobsPanel", type: "InitialWfhData", service: "getWfhJobsPaginated", field: "result.items" },
  { page: "src/app/jobs/abroad/page.tsx", panel: "src/components/abroad/AbroadJobsPanel.tsx", component: "AbroadJobsPanel", type: "InitialAbroadData", service: "getAbroadJobsPaginated", field: "result.items" },
] as const

for (const b of BOARDS) {
  test(`SSR: ${b.page} fetches page data on the server via ${b.service}()`, () => {
    const src = code(b.page)
    assert.match(src, new RegExp(`await[\\s\\S]{0,80}\\b${b.service}\\s*\\(`), `awaits ${b.service}`)
    assert.doesNotMatch(src, /^\s*["']use client["']/m, "listing page must stay a server component")
  })

  test(`SSR: ${b.page} passes initialData (incl. the rendered page) into <${b.component}>`, () => {
    const src = code(b.page)
    assert.match(src, new RegExp(`<${b.component}\\b[^>]*initialData=\\{initialData\\}`), `initialData prop on ${b.component}`)
    if (b.field) assert.match(src, new RegExp(`jobs:\\s*${b.field.replace(".", "\\.")}`), `maps ${b.field} → jobs (service return shape)`)
    assert.match(src, /\bpage,?\s*\n?\s*\}|\bpage\s*\}|,\s*page\s*\}/, "initialData carries the page the server rendered")
  })

  test(`SSR: ${b.page} survives a failed fetch (client panel re-fetches instead of the page 500ing)`, () => {
    assert.match(code(b.page), /try\s*\{[\s\S]*?await\s+[\w.]+\([\s\S]*?\}\s*catch/, "server fetch is wrapped in try/catch")
  })

  test(`SSR: ${b.panel} seeds state from initialData and does not start in a loading shell`, () => {
    const src = code(b.panel)
    assert.match(src, new RegExp(`export\\s+interface\\s+${b.type}\\b`), `${b.type} exported`)
    assert.match(src, /useState<[^>]+>\(\s*initialData\?\.jobs\s*\?\?\s*\[\]\s*\)/, "jobs state seeded from initialData")
    assert.match(src, /useState\(\s*!initialData\s*\)/, "loading starts false when initialData is present")
  })
}

test("SSR: the three listing services keep the field names the pages map from (items vs jobs)", () => {
  assert.match(code("src/lib/services/wfhJobService.ts"), /items/, "wfh service returns items")
  assert.match(code("src/lib/services/abroadJobService.ts"), /items/, "abroad service returns items")
  assert.match(code("src/types/job.ts"), /interface\s+JobSearchResult\b[\s\S]*?\bjobs:\s*Job\[\]/, "private service returns jobs")
})

test("SSR: the optional JobSearchResult.counts is tolerated (shared merge falls back instead of a type hole)", () => {
  assert.match(code("src/lib/jobs/mergePrivateListing.ts"), /dbData\.counts\s*\|\|\s*\{/, "falls back when counts is undefined")
})

test("SSR: listing pages keep their indexation rules (page>=2 / filtered variants stay noindex,follow)", () => {
  for (const b of BOARDS) assert.match(code(b.page), /listingMeta\(/, `${b.page} still uses listingMeta`)
})

// ── 2b. HYDRATION + the shared private merge ────────────────────────────────────────────

test("HYDRATION: /jobs/private SSR merges the employer table AND the live Himalayas cache (not DB-only)", () => {
  const src = code("src/app/jobs/private/page.tsx")
  assert.match(src, /getHimalayasJobsForDisplay\(/, "reads the live cache on the server")
  assert.match(src, /mergePrivateListing\(/, "uses the shared merge")
  assert.match(src, /page\s*===\s*1\s*\?\s*getHimalayasJobsForDisplay/, "live jobs only on page 1, like the client")
  assert.match(src, /getHimalayasJobsForDisplay\([^)]*\)\.catch\(/, "a live-cache failure degrades to none instead of failing the page")
})

test("HYDRATION: LiveJobsList uses the shared merge — no private copy of the merge logic left in the component", () => {
  const src = code("src/components/jobs/LiveJobsList.tsx")
  assert.match(src, /mergePrivateListing\(/, "client list calls the shared merge")
  assert.doesNotMatch(src, /toLiveExternalJobs|toListingJobs/, "no inline re-implementation of the merge")
})

for (const [panel, view] of [
  ["src/components/jobs/LiveJobsList.tsx", "isServerView"],
  ["src/components/wfh/WfhJobsPanel.tsx", "isServerView"],
  ["src/components/abroad/AbroadJobsPanel.tsx", "isServerView"],
] as const) {
  test(`HYDRATION: ${panel} skips its mount fetch only for the exact server-rendered view`, () => {
    const src = code(panel)
    assert.match(src, /useRef\(\s*!!initialData\s*\)/, "tracks whether the first run follows a server render")
    assert.match(src, new RegExp(`const\\s+${view}\\b[\\s\\S]*?page\\s*===\\s*initialData\\?\\.page`), "view check includes the page number")
    assert.match(src, new RegExp(`if\\s*\\(\\s*${view}\\s*\\)\\s*return`), "returns before setLoading(true)")
    assert.ok(src.indexOf(`if (${view}) return`) < src.indexOf("setLoading(true)"), "skip happens before the loading flash")
  })
}

test("HYDRATION: filters are part of the server-view check, so a filtered URL still refetches", () => {
  assert.match(code("src/components/jobs/LiveJobsList.tsx"), /isServerView\s*=[\s\S]*?!q[\s\S]*?!location[\s\S]*?!exp[\s\S]*?status/)
  assert.match(code("src/components/wfh/WfhJobsPanel.tsx"), /isServerView\s*=\s*[\s\S]*?!q\s*&&\s*cat\s*===\s*'all'[\s\S]*?sort\s*===\s*'latest'/)
  assert.match(code("src/components/abroad/AbroadJobsPanel.tsx"), /isServerView\s*=\s*!q\s*&&\s*!country\s*&&\s*!category/)
})

test("HYDRATION: WFH page requests exactly the defaults the client/API use (cat=all, exp=all, sort=latest, limit=20)", () => {
  assert.match(code("src/app/jobs/wfh/page.tsx"), /getWfhJobsPaginated\(\{\s*cat:\s*'all',\s*exp:\s*'all',\s*sort:\s*'latest',\s*page,\s*limit:\s*20\s*\}\)/)
})

// Behavioural: the real merge. Rows must satisfy the real renderability gates.
const live = (n: number, over: Record<string, unknown> = {}) => ({
  id: `himalayas:${"a".repeat(39)}${n}`, title: `Remote Engineer ${n}`, company: `Remote Co ${n}`,
  location: "Worldwide", applyUrl: `https://himalayas.app/companies/remote-co-${n}/jobs/engineer-${n}`,
  description: "Build and ship distributed systems for a remote-first product team.", ...over,
})
const dbRow = (n: number, over: Record<string, unknown> = {}) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`, title: `Staff Accountant ${n}`, company: `Acme Industries ${n}`,
  location: "Pune, India", description: "Own month-end close and reconciliations for a growing manufacturing group.",
  provenance: "EMPLOYER", employer_id: `emp-${n}`, applyUrl: `https://acme.example/careers/${n}`, jobStatus: "LIVE_JOB", ...over,
})
const emptyDb = { jobs: [], total: 0, totalPages: 1, counts: { all: 0, live: 0, verified: 0, archived: 0 } }

test("MERGE: empty employer table + live cache → the server render is NOT empty (the crawler-visible fix)", () => {
  const m = mergePrivateListing(emptyDb, [live(1), live(2), live(3)])
  assert.equal(m.jobs.length, 3)
  assert.equal(m.total, 3)
  assert.equal(m.counts.all, 3)
  assert.equal(m.counts.live, 3)
  assert.equal(m.counts.verified, 0, "aggregated jobs are never counted as verified")
})

test("MERGE: live (aggregator) jobs stay AGGREGATED — never employer-verified or GENUINE", () => {
  for (const j of mergePrivateListing(emptyDb, [live(1)]).jobs) {
    assert.equal(j.provenance, "AGGREGATED")
    assert.notEqual(j.verified, true)
  }
})

test("MERGE: a live row without a real application URL is dropped, not invented or counted", () => {
  const m = mergePrivateListing(emptyDb, [live(1, { applyUrl: "" }), live(2, { applyUrl: "#" }), live(3)])
  assert.deepEqual(m.jobs.map(j => j.title), ["Remote Engineer 3"])
  assert.equal(m.total, 1)
  assert.equal(m.counts.all, 1)
})

test("MERGE: an id present in both sources appears once (live copy wins, order preserved)", () => {
  const dup = dbRow(1, { id: live(1).id })
  const m = mergePrivateListing({ jobs: [dup, dbRow(2)], total: 2, totalPages: 1, counts: { all: 2, live: 2, verified: 0, archived: 0 } }, [live(1)])
  const ids = m.jobs.map(j => j.id)
  assert.equal(new Set(ids).size, ids.length, "no duplicate ids")
  assert.equal(ids[0], live(1).id, "live jobs lead")
})

test("MERGE: counts equal what is displayed — non-renderable employer rows are subtracted", () => {
  const bad = dbRow(9, { title: "", description: "" })
  const m = mergePrivateListing({ jobs: [dbRow(1), bad], total: 2, totalPages: 1, counts: { all: 2, live: 1, verified: 1, archived: 0 } }, [live(1)])
  assert.equal(m.jobs.length, 2, "1 renderable employer job + 1 live job")
  assert.equal(m.total, 2)
  assert.equal(m.counts.all, 2)
})

test("MERGE: page 2+ (no live rows) is the employer page untouched; bad/absent input never throws", () => {
  const m = mergePrivateListing({ jobs: [dbRow(1)], total: 21, totalPages: 2, counts: { all: 21, live: 5, verified: 16, archived: 0 } }, [])
  assert.equal(m.jobs.length, 1)
  assert.equal(m.total, 21)
  assert.equal(m.totalPages, 2)
  assert.deepEqual(m.counts, { all: 21, live: 5, verified: 16, archived: 0 })
  const z = mergePrivateListing({}, undefined)
  assert.deepEqual(z, { jobs: [], total: 0, totalPages: 1, counts: { all: 0, live: 0, verified: 0, archived: 0 } })
})

// ─────────────────────────────────────────────────────────────────────────────────────────
// 3. COUNTS — abroad country cards are DB-backed, same service as the list they open
// ─────────────────────────────────────────────────────────────────────────────────────────

test("COUNTS: getVisibleAbroadCountryCounts() uses getAbroadJobsPaginated, not the local-inventory fallback", () => {
  const src = code("src/lib/services/visibleCounts.ts")
  const fn = src.slice(src.indexOf("export async function getVisibleAbroadCountryCounts"))
  assert.match(fn, /getAbroadJobsPaginated\s*\(/, "country counts come from the DB-backed list service")
  assert.doesNotMatch(src, /getAbroadJobsPaginatedLocal/, "visibleCounts must not import the local-only fallback")
})

test("COUNTS: country count is the list's counts.all for that country (card === list it opens)", () => {
  const src = code("src/lib/services/visibleCounts.ts")
  assert.match(src, /country:\s*c\.country/, "queries by the card's country")
  assert.match(src, /jobs:\s*result\.counts\.all/, "card number is the list's own all-count")
})

test("COUNTS: one failing country degrades to 0 for that card only (Promise.all never rejects the page)", () => {
  const src = code("src/lib/services/visibleCounts.ts")
  const fn = src.slice(src.indexOf("export async function getVisibleAbroadCountryCounts"))
  assert.match(fn, /catch\s*\{[\s\S]*?jobs:\s*0/, "per-country catch returns 0")
})

test("COUNTS: never falls back to the marketing target as a count", () => {
  const fn = code("src/lib/services/visibleCounts.ts")
  assert.doesNotMatch(fn, /ABROAD_COUNTRY_TARGETS\b[^;]*\.jobs\b/, "marketing target used as a count")
})

// ─────────────────────────────────────────────────────────────────────────────────────────
// 4. CLAIMS — no fabricated scale / trust numbers on user-facing surfaces
// ─────────────────────────────────────────────────────────────────────────────────────────

const USER_FACING = [
  "src/app/layout.tsx",
  "src/app/opengraph-image.tsx",
  "src/app/about/page.tsx",
  "src/app/jobs/private/page.tsx",
  "src/components/employer/PostJobModal.tsx",
  "src/lib/data/landingCategories.ts",
]
const FABRICATED = [
  /80,000\+/,
  /2,500\+\s*(companies|employers)/i,
  /50,000\+\s*(placed|happy|candidates)/i,
  /800\+\s*cities/i,
  /Trusted by\s+[\d,]+\+/i,
]

for (const f of USER_FACING) {
  test(`CLAIMS: ${f} contains no fabricated scale/trust numbers`, () => {
    const src = code(f)
    for (const re of FABRICATED) assert.doesNotMatch(src, re, `${f} still matches ${re}`)
  })
}

test("CLAIMS: replacements stay honest (no new unverifiable numeric claim introduced)", () => {
  const about = code("src/app/about/page.tsx")
  assert.doesNotMatch(about, /["'>]\s*\d{1,3}(,\d{3})+\+/, "about page must not hard-code a large-number stat")
  const og = code("src/app/opengraph-image.tsx")
  assert.doesNotMatch(og, /["'>]\s*\d{1,3}(,\d{3})+\+/, "OG image must not hard-code a large-number stat")
})

test("CLAIMS: site description no longer promises 'verified openings' it cannot back", () => {
  assert.doesNotMatch(code("src/app/layout.tsx"), /verified openings/i)
})

console.log(`\nseo-recovery regression tests: ${passed} passed, ${failed} failed`)
process.exitCode = failed ? 1 : 0
