/**
 * seoRecoveryRegression.test.ts — regression guards for the SEO / HREF / indexing recovery.
 *
 *   npm run test:seo-recovery
 *
 * Each block pins one confirmed production defect so it cannot silently return:
 *
 *   1. HREF       — aggregated (Himalayas) featured cards link ONLY to a valid external http(s) URL.
 *                   They never get an internal `/jobs/<board>/himalayas:<hash>` href (a guaranteed 404
 *                   on the Private board), and a card with no valid external URL is dropped — there is
 *                   no internal fallback and no invented destination.
 *   2. SSR        — the three job-board listing pages must fetch page data on the server and
 *                   hand it to their client panels, so crawlers receive real job content
 *                   instead of an empty "Loading…" shell.
 *   3. COUNTS     — abroad country cards come from ONE shared read of the Abroad pool (not one full list
 *                   query per country) and equal the size of the list each card opens
 *                   (behavioural proof: abroadCountryCounts.test.ts, `npm run test:abroad-counts`).
 *                   Country identity is ONE shared rule (countryIdentity.ts: aliases, whole-country tokens —
 *                   UK≠Ukraine, Oman≠Romania) for the list, the counts, local inventory and the live feed.
 *   1b. BADGE     — the Featured card's trust/source badge comes from provenance + verification evidence
 *                   (featuredCardBadge.ts), never from whether the link is internal or external
 *                   (behavioural proof: featuredCardBadge.test.ts, `npm run test:featured-badge`).
 *   2b. HYDRATION — the server render and the client list assemble the Private listing with ONE
 *                   shared merge (employer table + live Himalayas cache), and the first client
 *                   fetch is skipped only for the exact view the server rendered, so real
 *                   content is neither empty in the crawler's HTML nor flashed back to "Loading…".
 *   2c. COPY      — the homepage Featured section never claims every card is a verified opening from a
 *                   real employer while external-source (aggregator) jobs can be included.
 *   4. CLAIMS     — no fabricated trust / scale claims ("80,000+ verified openings",
 *                   "2,500+ companies", "50,000+ placed") in any user-facing surface.
 *
 * These are hermetic: no Supabase, no network, no database writes.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { featuredCardLink, onlyLinkableCards, safeExternalUrl } from "../jobs/featuredCardLink"
import { hasRealApplyUrl } from "../jobs/provenance"
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

test("HREF: FeaturedJobsSection resolves every card through featuredCardLink() and DROPS cards that have no link", () => {
  const src = code("src/components/home/FeaturedJobsSection.tsx")
  assert.match(src, /import\s*\{\s*featuredCardLink\s*\}\s*from\s*["']@\/lib\/jobs\/featuredCardLink["']/, "imports the shared resolver")
  assert.match(src, /\.flatMap\(\s*job\s*=>\s*\{[\s\S]*?featuredCardLink\(\s*job\s*\)[\s\S]*?return\s+link\s*\?\s*\[\s*\{\s*job\s*,\s*link\s*,\s*badge:\s*featuredCardBadge\(\s*job\s*\)\s*\}\s*\]\s*:\s*\[\s*\]/, "a card without a link is omitted, not rendered")
  assert.match(src, /cards\.length\s*===\s*0\)\s*return\s+null/, "the section renders nothing when no card is linkable")
  assert.match(src, /cards\.map\(\s*\(\{\s*job\s*,\s*link\s*,\s*badge\s*\}\)/, "only linkable cards are rendered")
  assert.match(src, /link\.external\s*\?/, "renders external and internal cards differently")
})

test("HREF: getFeaturedJobsMix drops unlinkable cards BEFORE mixing, so other boards can still fill the section", () => {
  const src = code("src/lib/services/featuredJobs.ts")
  assert.match(src, /import\s*\{\s*onlyLinkableCards\s*\}\s*from\s*["']@\/lib\/jobs\/featuredCardLink["']/)
  assert.match(src, /\[\s*privateCards\s*,\s*wfhCards\s*,\s*abroadCards\s*\]\.map\(\s*onlyLinkableCards\s*\)/, "each board's list is filtered before the round-robin mix")
})

test("HREF: featuredCardLink.ts builds an internal detail href ONLY on the non-aggregator path", () => {
  const resolver = code("src/lib/jobs/featuredCardLink.ts")
  assert.match(resolver, /AGGREGATOR_ID_PREFIX\s*=\s*['"]himalayas:['"]/, "Himalayas id prefix")
  assert.match(resolver, /id\.startsWith\(\s*AGGREGATOR_ID_PREFIX\s*\)\s*\|\|\s*card\.provenance\s*===\s*['"]AGGREGATED['"]/, "aggregator = Himalayas id OR AGGREGATED provenance")
  assert.equal((resolver.match(/\/jobs\/\$\{[^}]+\}\/\$\{[^}]+\}/g) ?? []).length, 1, "one internal template in the resolver")
  const fn = resolver.slice(resolver.indexOf("export function featuredCardLink"))
  const branch = fn.slice(fn.indexOf("if (isAggregatorCard(card))"), fn.indexOf("if (!isValidJobId(card.id))"))
  assert.ok(branch.length > 0 && !branch.includes("/jobs/"), "the aggregator branch never mentions an internal /jobs/ path")
  assert.match(branch, /return\s+href\s*\?\s*\{[^}]*external:\s*true[^}]*\}\s*:\s*null/, "aggregator → external link or null, nothing else")
  const section = code("src/components/home/FeaturedJobsSection.tsx")
  assert.doesNotMatch(section, /\/jobs\/\$\{[^}]+\}\/\$\{[^}]+\}/, "the component must not hand-build a detail href from job.id")
})

test("HREF: external aggregated cards render as <a target=_blank rel=noopener noreferrer>, internal ones as next/link", () => {
  const src = code("src/components/home/FeaturedJobsSection.tsx")
  assert.match(src, /<a\b[^>]*href=\{link\.href\}[^>]*target="_blank"[^>]*rel="noopener noreferrer"/, "external anchor")
  assert.match(src, /<Link\b[^>]*href=\{link\.href\}/, "internal next/link")
})

test("BADGE: the badge is decided by featuredCardBadge() from provenance + evidence — NOT by whether the link is external/internal", () => {
  const src = code("src/components/home/FeaturedJobsSection.tsx")
  assert.match(src, /featuredCardBadge\(\s*job\s*\)/, "badge resolved from the card's provenance/evidence")
  assert.doesNotMatch(src, /link\.external\s*\?[^:]*<span/, "no link.external ? <badge> : <badge> ternary")
  assert.doesNotMatch(src, /Verified|Source\s*↗/, "no hard-coded trust label in the component — the labels come from featuredCardBadge")
  // The only place the word "Verified" can come from is the badge module, for the 'verified' kind.
  const badge = code("src/lib/jobs/featuredCardBadge.ts")
  assert.equal((badge.match(/'Verified'/g) ?? []).length, 1, "one 'Verified' label")
  assert.match(badge, /verified:\s*\{\s*kind:\s*'verified',\s*label:\s*'Verified'\s*\}/)
  assert.match(badge, /card\.employerVerified\s*===\s*true\s*\?\s*BADGES\.verified\s*:\s*BADGES\.employer/, "Verified only with explicit evidence")
  assert.doesNotMatch(badge, /external|href|isValidJobId|uuid/i, "the badge module never looks at the link or the id shape")
})

test("BADGE: every card builder stamps provenance + employerVerified from the job row's own evidence", () => {
  const src = code("src/lib/services/featuredJobs.ts")
  assert.match(src, /interface\s+FeaturedJobCard\b[\s\S]*?employerVerified\?:\s*boolean/, "evidence field on FeaturedJobCard")
  assert.equal((src.match(/\.\.\.featuredCardTrust\(\s*j\s*\)/g) ?? []).length, 9, "all nine builders")
  assert.doesNotMatch(src, /provenance:\s*j\.provenance/, "no builder copies a possibly-missing provenance label")
  assert.doesNotMatch(src, /employerVerified:\s*(true|!!j\.id|Boolean\(j\.id)/, "never hard-coded or inferred from the id")
  const badge = code("src/lib/jobs/featuredCardBadge.ts")
  assert.match(badge, /employerVerified:\s*isEmployerVerified\(\s*job\s*\)/, "the application's own verification predicate")
  assert.match(code("src/lib/jobs/provenance.ts"), /export function isEmployerVerified[\s\S]*?classifyProvenance\(j\)\s*===\s*"EMPLOYER"\s*&&\s*hasVerifiedTrust\(j\)/)
})

const UUID = "9b2f6c1e-0000-4000-8000-000000000001"
type Linked = { href: string; external: boolean } | null

test("HREF matrix: valid aggregator → its external URL; native → internal detail page; on every board", () => {
  const cases: Array<[Card, Linked]> = [
    [{ id: "himalayas:3f9a1c", board: "wfh", apply_url: "https://himalayas.app/jobs/abc" }, { href: "https://himalayas.app/jobs/abc", external: true }],
    [{ id: "himalayas:77be02", board: "private", apply_url: "https://himalayas.app/jobs/xyz", provenance: "AGGREGATED" }, { href: "https://himalayas.app/jobs/xyz", external: true }],
    [{ id: "himalayas:55d0e1", board: "abroad", apply_url: "http://careers.acme.co.in/apply?id=1&x=y#top" }, { href: "http://careers.acme.co.in/apply?id=1&x=y#top", external: true }],
    [{ id: "himalayas:55d0e2", board: "abroad", apply_url: "  https://himalayas.app/jobs/trim \n" }, { href: "https://himalayas.app/jobs/trim", external: true }],
    // An AGGREGATED-provenance card is external even without a himalayas: id.
    [{ id: UUID, board: "wfh", provenance: "AGGREGATED", apply_url: "https://jobs.example-board.io/p/1" }, { href: "https://jobs.example-board.io/p/1", external: true }],
    // Native employer-owned rows keep their internal page on every board (their apply_url is irrelevant to the link).
    [{ id: UUID, board: "private", provenance: "EMPLOYER", apply_url: "https://employer.test-co.in/apply" }, { href: `/jobs/private/${UUID}`, external: false }],
    [{ id: UUID, board: "wfh" }, { href: `/jobs/wfh/${UUID}`, external: false }],
    [{ id: UUID, board: "abroad", apply_url: "#" }, { href: `/jobs/abroad/${UUID}`, external: false }],
  ]
  for (const [card, want] of cases) assert.deepEqual(featuredCardLink(card), want, `${card.id} ${card.apply_url ?? ""}`)
})

// Every URL that is blank / non-actionable / unsafe. None may ever become an href.
const BAD_URLS: Array<string | undefined | null> = [
  undefined, null, "", "   ", "\n\t", "#", "#top", "javascript:alert(1)", "JaVaScRiPt:alert(1)", " javascript:alert(1)", "data:text/html,<b>x</b>", "vbscript:msgbox(1)",
  "mailto:hr@acme.co.in", "tel:+911234567890", "file:///etc/passwd", "ftp://files.acme.co.in/job", "blob:https://acme.co.in/x",
  "https://", "http://", "https:///path-only", "//evil.example.net/x", "/jobs/private/abc", "jobs/abc", "himalayas.app/jobs/abc", "https:himalayas.app",
  "https://example.com/apply", "http://www.example.org/x", "https://user:secret@himalayas.app/jobs/1", "https://localhost/x", "https://intranet/job", "https://[::1]/x",
  "https://host with space.com/x", "https://himalayas.app/jo bs", "https://himalayas.app/x\u0000y",
]

test("HREF: an aggregator card with a missing / blank / unsafe / non-actionable URL has NO link (null) — never an internal fallback", () => {
  for (const board of ["private", "wfh", "abroad"] as const) {
    for (const id of ["himalayas:deadbeef", "himalayas:0123456789abcdef0123456789abcdef01234567"]) {
      for (const apply_url of BAD_URLS) {
        assert.equal(featuredCardLink({ id, board, apply_url: apply_url as string | undefined }), null, `${board} ${id} ${JSON.stringify(apply_url)}`)
      }
    }
  }
})

test("HREF: AGGREGATED provenance without a valid URL is also dropped, whatever the id looks like", () => {
  for (const apply_url of BAD_URLS) {
    assert.equal(featuredCardLink({ id: UUID, board: "private", provenance: "AGGREGATED", apply_url: apply_url as string | undefined }), null, JSON.stringify(apply_url))
  }
})

test("HREF: PROPERTY — for any aggregator card the result is null or an external http(s) link; never an internal /jobs/ href", () => {
  const urls = [...BAD_URLS, "https://himalayas.app/jobs/ok", "http://careers.acme.co.in/x", "/jobs/private/himalayas:abc", "https://a.b/" ]
  for (const board of ["private", "wfh", "abroad"] as const) {
    for (const card of [{ id: "himalayas:abc" }, { id: UUID, provenance: "AGGREGATED" }, { id: "himalayas:xyz", provenance: "AGGREGATED" }]) {
      for (const apply_url of urls) {
        const link = featuredCardLink({ ...card, board, apply_url: apply_url as string | undefined })
        if (link === null) continue
        assert.equal(link.external, true, `${board} ${card.id} ${apply_url}`)
        assert.match(link.href, /^https?:\/\/[^\s/]+\.[^\s/]+/i, `${board} ${card.id} ${apply_url}`)
        assert.ok(!link.href.startsWith("/jobs/"), `${board} ${card.id} ${apply_url}`)
      }
    }
  }
})

test("HREF: native cards are unaffected by apply_url, but an invalid id or non-genuine provenance gets no link", () => {
  for (const apply_url of BAD_URLS) assert.deepEqual(featuredCardLink({ id: UUID, board: "private", apply_url: apply_url as string | undefined }), { href: `/jobs/private/${UUID}`, external: false })
  for (const id of ["", " ", "undefined", "null", "a b", "../etc", "x/y", "x?y=1", "x#y", " " + UUID]) assert.equal(featuredCardLink({ id, board: "private" }), null, JSON.stringify(id))
  for (const provenance of ["SYNTHETIC", "UNCLASSIFIED"]) assert.equal(featuredCardLink({ id: UUID, board: "wfh", provenance }), null, provenance)
  for (const provenance of ["EMPLOYER", "CURATED", "OFFICIAL", undefined]) assert.ok(featuredCardLink({ id: UUID, board: "abroad", provenance }), String(provenance))
})

test("HREF: onlyLinkableCards removes exactly the unlinkable cards and keeps order (so a broken card cannot render)", () => {
  const cards: Card[] = [
    { id: "himalayas:a", board: "private", apply_url: "https://himalayas.app/jobs/a" },
    { id: "himalayas:b", board: "wfh" },
    { id: UUID, board: "private" },
    { id: "himalayas:c", board: "abroad", apply_url: "javascript:alert(1)" },
    { id: "himalayas:d", board: "abroad", apply_url: "https://himalayas.app/jobs/d" },
    { id: "undefined", board: "wfh" },
  ]
  assert.deepEqual(onlyLinkableCards(cards).map(c => c.id), ["himalayas:a", UUID, "himalayas:d"])
  assert.deepEqual(onlyLinkableCards([]), [])
})

test("HREF: safeExternalUrl accepts real http(s) job URLs unchanged (trimmed) and does not loosen hasRealApplyUrl", () => {
  assert.equal(safeExternalUrl("https://himalayas.app/companies/acme/jobs/engineer"), "https://himalayas.app/companies/acme/jobs/engineer")
  assert.equal(safeExternalUrl("  http://jobs.acme.co.in/apply?id=7  "), "http://jobs.acme.co.in/apply?id=7")
  for (const u of BAD_URLS) assert.equal(safeExternalUrl(u), null, JSON.stringify(u))
  // Anything the platform's own gate rejects stays rejected here.
  for (const u of ["https://example.com/x", "#", "", "ftp://a.b.com/x"]) assert.equal(hasRealApplyUrl(u), false, u)
  assert.match(code("src/lib/jobs/featuredCardLink.ts"), /hasRealApplyUrl\(url\)/, "builds on the platform gate instead of replacing it")
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

const fnBody = (src: string, name: string) => {
  const i = src.indexOf(`export async function ${name}(`)
  assert.ok(i >= 0, `${name} exists`)
  const end = src.indexOf("\n}\n", i) // top-level function: ends at the first column-0 closing brace
  assert.ok(end > i, `${name} has a closing brace`)
  return src.slice(i, end + 2)
}

test("COUNTS: getVisibleAbroadCountryCounts() makes ONE shared-read call — no full list query per country", () => {
  const src = code("src/lib/services/visibleCounts.ts")
  const fn = fnBody(src, "getVisibleAbroadCountryCounts")
  assert.equal((fn.match(/getAbroadCountryCounts\(/g) ?? []).length, 1, "exactly one call to the shared-read function")
  assert.doesNotMatch(fn, /getAbroadJobsPaginated\s*\(|getAbroadJobs\s*\(|getAbroadJobsPaginatedLocal/, "no per-country list-service query")
  assert.doesNotMatch(fn, /\.map\(\s*async|for\s*\(.*await|await[\s\S]*\.map\(\s*async/, "no async fan-out over the countries")
  assert.doesNotMatch(src, /getAbroadJobsPaginatedLocal/, "visibleCounts must not import the local-only fallback")
})

test("COUNTS: the country-count function reads the pool once through the list's own loader — no query of its own", () => {
  const svc = code("src/lib/services/abroadJobService.ts")
  const fn = fnBody(svc, "getAbroadCountryCounts")
  assert.equal((fn.match(/loadAbroadRest\(/g) ?? []).length, 1, "one pool read")
  assert.match(fn, /loadAbroadRest\(\s*undefined\s*,\s*undefined\s*,\s*undefined\s*\)/, "the UNFILTERED pool, with the same cache key the list uses")
  assert.doesNotMatch(fn, /\.from\(|getAbroadJobsPaginated\s*\(|getAbroadJobs\s*\(|createClient|getSupabaseClient/, "no query or list-service call of its own")
  for (const name of ["getAbroadJobsPaginated", "getAbroadJobs", "getAbroadCountryCounts"]) {
    assert.doesNotMatch(fnBody(svc, name), /\.from\(/, `${name} has no query of its own`)
  }
  const loader = svc.slice(svc.indexOf("const loadAbroadRest"), svc.indexOf("function composeAbroadJobs"))
  assert.equal((loader.match(/\.from\(\s*["']abroad_jobs["']\s*\)/g) ?? []).length, 1, "the list/count path reads abroad_jobs in exactly one place (the shared loader)")
})

test("COUNTS: the list and the counts share one loader and one set of rules (list = compose(live, loader))", () => {
  const svc = code("src/lib/services/abroadJobService.ts")
  assert.match(fnBody(svc, "getAbroadJobs"), /loadAbroadRest\(/, "the list reads through the same loader")
  assert.match(svc, /const\s+loadAbroadRest\s*=\s*perRequest\(/, "the loader is memoised per request, so list + counts + hero share one read")
  assert.match(svc, /applySyntheticVisibility\(\s*filterRenderable\(/, "renderability + synthetic visibility are applied in the loader")
  assert.match(svc, /\.eq\(\s*["']status["']\s*,\s*["']active["']\s*\)/, "active rows only")
})

test("COUNTS: list and count apply ONE shared country-identity rule (aliases, whole-country tokens) — no source-specific substring/equality", () => {
  const svc = code("src/lib/services/abroadJobService.ts")
  assert.match(svc, /import\s*\{\s*filterByCountry\s*\}\s*from\s*["']@\/lib\/jobs\/countryIdentity["']/)
  assert.match(fnBody(svc, "getAbroadJobs"), /filterByCountry\(\s*rest\.jobs\s*,\s*filters\.country\s*\)/, "the list narrows the stored rows with the shared rule")
  assert.match(fnBody(svc, "getAbroadCountryCounts"), /filterByCountry\(\s*rest\.jobs\s*,\s*country\s*\)/, "the count narrows the SAME rows with the SAME rule")
  assert.doesNotMatch(svc, /ilike\(\s*["']country["']/, "country is never pushed down to SQL with a different rule")
  assert.doesNotMatch(svc, /countryMatchers|\.includes\(country\.toLowerCase\(\)\)/, "the per-source substring/equality matchers are gone")
  const loaderSig = svc.slice(svc.indexOf("const loadAbroadRest"), svc.indexOf("const loadAbroadRest") + 200)
  assert.doesNotMatch(loaderSig, /country/, "country is not a parameter (nor cache key) of the shared read")
  assert.match(code("src/lib/services/abroadJobLocal.ts"), /filterByCountry\(\s*pre\s*,\s*country\s*\)/, "the local list filter uses the shared rule")
  assert.match(code("src/lib/services/liveJobOpportunities.ts"), /countryMatches\(r\.country,\s*wanted\)\s*\|\|\s*countryMatches\(r\.location,\s*wanted\)/, "the live feed uses the shared rule")
})

test("COUNTS: failure is safe — a failed read reports 0 for every country, never a marketing target", () => {
  const svc = code("src/lib/services/abroadJobService.ts")
  assert.match(fnBody(svc, "getAbroadCountryCounts"), /Object\.fromEntries\(countries\.map\(c\s*=>\s*\[c,\s*0\]\)\)[\s\S]*try\s*\{[\s\S]*\}\s*catch/, "zeros first, then the read inside try/catch")
  assert.doesNotMatch(code("src/lib/services/visibleCounts.ts"), /ABROAD_COUNTRY_TARGETS\b[^;]*\.(jobs|count)\b/, "marketing target used as a count")
})

// ─────────────────────────────────────────────────────────────────────────────────────────
// 2c. COPY — the Featured section must not claim every card is a verified employer opening
// ─────────────────────────────────────────────────────────────────────────────────────────

const SECTION = "src/components/home/FeaturedJobsSection.tsx"

test("COPY: the section can include external-source jobs (so an 'all verified' claim would be false)", () => {
  assert.match(code("src/lib/services/featuredJobs.ts"), /getHimalayasJobsForDisplay\(/, "the featured mix draws on the Himalayas source")
  assert.match(code("src/lib/jobs/featuredCardBadge.ts"), /label:\s*'Source ↗'/, "external-source cards are labelled 'Source ↗' (badge module)")
  assert.match(code(SECTION), /featuredCardBadge\(/, "…and the section renders that badge")
})

test("COPY: no unconditional 'verified openings / real employers / all verified' claim in the Featured section", () => {
  const src = code(SECTION)
  for (const re of [/verified\s+(openings|jobs|vacancies|employers|listings)/i, /real\s+employers/i, /\ball\b[^<>{}]{0,40}\bverified\b/i, /every\b[^<>{}]{0,40}\bverified\b/i, /\bverified\b[^<>{}]{0,30}\bfrom\b[^<>{}]{0,20}\bemployers\b/i]) {
    assert.doesNotMatch(src, re, `Featured section still matches ${re}`)
  }
})

test("COPY: 'Verified' is never header copy, and appears nowhere in the section component itself", () => {
  const src = code(SECTION)
  assert.equal((src.match(/Verified/g) ?? []).length, 0, "the word comes only from the evidence-based badge module")
  const header = src.slice(src.indexOf("<h2"), src.indexOf("</p>", src.indexOf("<h2")))
  assert.doesNotMatch(header, /verified/i, "no 'verified' in the section heading or subtitle")
})

test("COPY: the subtitle honestly covers BOTH employer listings and external job sources", () => {
  const src = code(SECTION)
  const sub = src.slice(src.indexOf("<p style", src.indexOf("<h2")), src.indexOf("</p>", src.indexOf("<h2")))
  assert.match(sub, /employers/i, "mentions employers")
  assert.match(sub, /external/i, "mentions external job sources")
  assert.match(sub, /where it comes from/i, "points readers at the per-card source label")
})

test("COPY: comments no longer say the section is 'genuine-employer jobs only'", () => {
  const raw = read(SECTION)
  assert.doesNotMatch(raw, /genuine[- ]employer jobs only/i)
  assert.match(raw, /NOT all employer-verified/, "the doc comment states the mix includes non-employer sources")
  assert.match(raw, /external-source/i)
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
