/**
 * previewQaFixes.test.ts — regression guards for the five defects found in the PR #54 preview QA.
 *
 *   npm run test:preview-qa
 *
 *   1. Private listing cards linked Himalayas jobs to `/jobs/private/himalayas:<hash>` (404).
 *   2. The Private hero said "0 Roles to Explore" while the list showed live third-party jobs.
 *   3. Blanket "verified" trust claims (hero, metadata, About, Private / WFH copy) without evidence.
 *   4. "$0K-$0K/yr" shown as a salary.
 *   5. A filtered Abroad deep link flashed the unfiltered totals before settling.
 *
 * Pure and hermetic: behavioural where the logic is pure, source-level only where the guarantee is a wiring
 * fact (and then the behaviour behind it is tested separately).
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { privateCardLink, isExternalSourceId } from "./privateCardLink"
import { jobDetailHref, isEmployerVerified, isGenuine } from "./provenance"
import { toListingJobs, toLiveExternalJobs } from "./clientRecords"
import { mergePrivateListing, withLiveListingCounts, countLiveListing } from "./mergePrivateListing"
import { formatSalaryRange, isZeroSalaryText } from "./salaryRange"
import { displayValue, isRealDisplayValue } from "./renderable"
import {
  abroadViewFromSearchParams, abroadViewFromParams, sameAbroadView, sameAbroadFilters, abroadTransition, shownAbroadView, abroadQueryFor, normalisePage,
} from "./abroadView"
import { getAbroadJobsPaginatedLocal } from "../services/abroadJobLocal"
import { mapRawHimalayasJob } from "../services/himalayasService"

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
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")

// Rows built the way the application builds them (they must clear the real renderability gates).
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

/* ───────────────────────── 1. Private listing links ───────────────────────── */

test("LINK: a live Himalayas card links ONLY to its own source URL — never an internal path", () => {
  const [job] = toLiveExternalJobs([live(1)])
  assert.ok(job && isExternalSourceId(job.id))
  const link = privateCardLink(job)
  assert.deepEqual(link, { kind: "external", href: "https://himalayas.app/companies/remote-co-1/jobs/engineer-1" })
  assert.equal(jobDetailHref("private", job), null, "no internal detail href exists for a live external id")
})

test("LINK: every merged Himalayas job in the real Private listing is external; none gets /jobs/private/himalayas:", () => {
  const merged = mergePrivateListing({ ...emptyDb, jobs: [dbRow(1)], total: 1, counts: { all: 1, live: 1, verified: 0, archived: 0 } }, [live(1), live(2), live(3)])
  const hrefs = merged.jobs.map(j => privateCardLink(j))
  for (const j of merged.jobs) {
    const l = privateCardLink(j)
    if (isExternalSourceId(j.id)) assert.equal(l.kind, "external", j.id)
    if (l.kind === "internal") assert.doesNotMatch(l.href, /himalayas:/)
    if (l.kind === "external") assert.match(l.href, /^https:\/\//)
  }
  assert.equal(hrefs.filter(l => l.kind === "external").length, 3)
})

test("LINK: an employer-owned genuine job keeps its working internal detail link", () => {
  const [job] = toListingJobs([dbRow(1)], "VERIFIED_JOB")
  assert.ok(job && isGenuine(job))
  assert.deepEqual(privateCardLink(job), { kind: "internal", href: `/jobs/private/${job.id}` })
  assert.equal(jobDetailHref("private", job), `/jobs/private/${job.id}`)
})

test("LINK: an external job without a valid http(s) source URL is 'unavailable' (not linked) — nothing is invented", () => {
  const [job] = toLiveExternalJobs([live(1)])
  for (const bad of ["", "   ", "#", "javascript:alert(1)", "data:text/html,x", "ftp://himalayas.app/x", "https://", "https:///x", "https://user:pw@himalayas.app/x", "//himalayas.app/x", "/relative/path", "https://localhost/x", "https://intranet/x", "https://example.com/job", "https://himalayas.app/a b"]) {
    const l = privateCardLink({ ...job, applyUrl: bad })
    assert.notEqual(l.kind, "external", `"${bad}" must never become an external href`)
    assert.notEqual(l.kind, "internal", `"${bad}" must never fall back to an internal href`)
  }
  for (const bad of ["", "https://", "#", "javascript:alert(1)"]) {
    assert.deepEqual(privateCardLink({ ...job, applyUrl: bad }), { kind: "unavailable" }, `"${bad}" → rendered without a link`)
  }
})

test("LINK: an explicitly sample / unclassified external id is never linked — no external, no internal fallback", () => {
  const [job] = toLiveExternalJobs([live(1)])
  assert.deepEqual(privateCardLink({ ...job, provenance: "SYNTHETIC" }), { kind: "unavailable" })
  assert.deepEqual(privateCardLink({ ...job, provenance: "UNCLASSIFIED" }), { kind: "unavailable" })
})

test("LINK: a non-genuine NON-external job keeps the existing 'Similar Jobs' path (kind 'none'), unchanged", () => {
  assert.deepEqual(privateCardLink({ id: "live-priv-1", title: "x", source: "Live Feed" } as never), { kind: "none" })
})

test("LINK: only the PRIVATE board is affected — WFH / Abroad Himalayas rows have real detail pages and keep their link", () => {
  const row = { id: `himalayas:${"b".repeat(40)}`, provenance: "AGGREGATED", source: "Himalayas", apply_url: "https://himalayas.app/companies/x/jobs/y" }
  assert.equal(jobDetailHref("wfh", row), `/jobs/wfh/${row.id}`)
  assert.equal(jobDetailHref("abroad", row), `/jobs/abroad/${row.id}`)
  assert.equal(jobDetailHref("private", row), null)
})

test("LINK: JobCard wires privateCardLink — external = new tab + noopener noreferrer, unavailable = no link, no raw /jobs/private/${id}", () => {
  const src = code("src/components/jobs/JobCard.tsx")
  assert.match(src, /privateCardLink\(\s*job\s*\)/)
  assert.doesNotMatch(src, /jobDetailHref/, "the card no longer builds its own internal href")
  assert.doesNotMatch(src, /\/jobs\/private\/\$\{/, "no hand-built private detail path")
  assert.match(src, /link\.kind\s*===\s*'external'[\s\S]*?target="_blank"\s+rel="noopener noreferrer"/)
  assert.equal((src.match(/target="_blank"/g) ?? []).length, 2, "title link + CTA, both new-tab")
  assert.equal((src.match(/rel="noopener noreferrer"/g) ?? []).length, 2)
  assert.match(src, /link\.kind\s*===\s*'unavailable'\s*\?\s*\(?\s*<span/, "title is plain text when there is no destination")
  assert.match(src, /link\.kind\s*===\s*'unavailable'\s*\?\s*null/, "no CTA when there is no destination")
})

/* ───────────────────────── 2. Private count ───────────────────────── */

test("COUNT: empty employer table + 7 live jobs → the hero count is 7 — the number of cards the list renders (was 0)", () => {
  const rows = [1, 2, 3, 4, 5, 6, 7].map(n => live(n))
  const merged = mergePrivateListing(emptyDb, rows)
  assert.equal(merged.jobs.length, 7)
  const hero = withLiveListingCounts(emptyDb.counts, rows)
  assert.equal(hero.all, 7)
  assert.equal(hero.all, merged.total, "hero 'Roles to Explore' === the list's 'Showing N jobs'")
  assert.deepEqual(hero, merged.counts, "every status tab count agrees with the list's own")
})

test("COUNT: with employer rows the hero equals the merged list total and tab counts (no double count, no drop)", () => {
  const db = { jobs: [dbRow(1), dbRow(2)], total: 2, totalPages: 1, counts: { all: 2, live: 2, verified: 0, archived: 0 } }
  const rows = [live(1), live(2), live(3)]
  const merged = mergePrivateListing(db, rows)
  const hero = withLiveListingCounts(db.counts, rows)
  assert.equal(hero.all, 5)
  assert.equal(hero.all, merged.total)
  assert.deepEqual(hero, merged.counts)
})

test("COUNT: the live part counts only RENDERABLE, de-duplicated live rows — the same set the list shows", () => {
  const rows = [live(1), live(1), live(2, { applyUrl: "" }), live(3, { title: "" }), live(4, { company: "undefined" }), { nope: true }, null, live(5)]
  assert.equal(countLiveListing(rows), 2, "only live(1) and live(5) can be displayed")
  assert.equal(countLiveListing(rows), mergePrivateListing(emptyDb, rows).jobs.length)
  assert.equal(countLiveListing(undefined), 0)
  assert.equal(countLiveListing("not rows"), 0)
  assert.deepEqual(withLiveListingCounts(null, null), { all: 0, live: 0, verified: 0, archived: 0 })
})

test("COUNT: aggregated live jobs never become 'verified' or 'archived' in the counts", () => {
  const c = withLiveListingCounts({ all: 4, live: 1, verified: 3, archived: 0 }, [live(1), live(2)])
  assert.deepEqual(c, { all: 6, live: 3, verified: 3, archived: 0 })
})

test("COUNT: wiring — the private hero and the board totals read the listing count; the page still uses the shared merge", () => {
  assert.match(code("src/lib/services/heroStatsService.ts"), /case "private":[\s\S]*?getPrivateListingCounts\(\)/)
  const vc = code("src/lib/services/visibleCounts.ts")
  assert.match(vc, /export async function getPrivateListingCounts[\s\S]*?withLiveListingCounts\(\s*base\s*,\s*await getHimalayasJobsForDisplay\(100\)\s*\)/, "same 100-row live read the page uses")
  assert.match(vc, /getVisibleBoardCounts[\s\S]*?getPrivateListingCounts\(\)/)
  // Hermetic: with no configured database (tests / CI / bare checkout) a COUNT never reaches the network.
  assert.match(vc, /getPrivateListingCounts[\s\S]*?if \(!isSupabaseConfigured\(\)\) return base[\s\S]*?getHimalayasJobsForDisplay/)
  assert.match(code("src/app/api/jobs/[[...params]]/route.ts"), /getPrivateListingCounts\(\)/, "/api/jobs/count agrees with the hero and the list")
  assert.match(code("src/app/jobs/private/page.tsx"), /getHimalayasJobsForDisplay\(100\)[\s\S]*?mergePrivateListing\(/)
})

/* ───────────────────────── 3. Trust claims ───────────────────────── */

const CLAIM_FILES = [
  "src/components/home/HeroSection.tsx", "src/app/page.tsx", "src/lib/seo/constants.ts", "src/lib/seo/faq.ts",
  "src/app/about/page.tsx", "src/app/jobs/private/page.tsx", "src/app/jobs/wfh/layout.tsx",
  "src/lib/config/categoryHeroThemes.ts", "src/lib/services/heroStatsService.ts", "src/app/editorial-policy/page.tsx",
  "src/components/heroes/CategoryHeroView.tsx", "src/components/home/StatsStrip.tsx", "src/components/home/EmployerCta.tsx",
  "src/components/jobs/JobCard.tsx",
]

test("CLAIMS: the blanket / unsupported phrases the QA found are gone from every audited surface", () => {
  const banned: [RegExp, string][] = [
    [/thousands of verified/i, "thousands of verified jobs"],
    [/verified employers only/i, "verified employers only"],
    [/live verified openings/i, "Live verified openings"],
    [/verified WFH jobs/i, "verified WFH jobs"],
    [/verified openings from top employers/i, "verified openings from top employers"],
    [/from verified employers/i, "from verified employers"],
    [/free registration, verified employers/i, "free registration, verified employers"],
    [/40-point/i, "40-point anti-scam filter"],
    [/Zero Fake Jobs/i, "Zero Fake Jobs"],
    [/TCS and Infosys/i, "named employer network"],
    [/most trusted employers/i, "most trusted employers"],
    [/verified listings daily/i, "verified listings daily"],
    [/verified remote roles/i, "verified remote roles"],
    [/3,200\+|500\+ Live Remote|200\+ Verified Companies/i, "fabricated WFH figures"],
    [/verified employer partners hiring remotely/i, "verified employer partners hiring remotely"],
    [/Trusted companies/i, "WFH 'Verified Employers / Trusted companies' card"],
    [/'Growing'|'Daily',\s*label:\s*'Live Jobs'/, "word standing in for a missing count"],
    [/100% verified/i, "100% verified profiles"],
    [/save 80%/i, "save 80% time"],
    [/Remote Verified/, "'Remote Verified' on an external-source card"],
  ]
  for (const f of CLAIM_FILES) {
    const src = read(f)
    for (const [re, label] of banned) assert.doesNotMatch(src, re, `${f}: "${label}"`)
  }
})

test("CLAIMS: stats strip shows 'Live Jobs' / 'Verified Employers' ONLY when a real count exists", () => {
  const src = code("src/components/home/StatsStrip.tsx")
  assert.match(src, /liveJobs\s*>\s*0\s*\?\s*\[\{\s*key:\s*'live'/)
  assert.match(src, /employers\s*>\s*0\s*\?\s*\[\{\s*key:\s*'employers',\s*num:\s*formatCounter\(employers\)/)
  assert.match(src, /\.eq\('verified',\s*true\)/, "the verified-employer figure is the DB count of employers flagged verified")
})

test("CLAIMS: 'Verified' on a WFH card needs the employer-verified predicate — an aggregated row with a stale flag never shows it", () => {
  const src = code("src/components/wfh/WfhJobCard.tsx")
  assert.match(src, /isEmployerVerified\(job\)\s*\?\s*'Verified'/)
  assert.doesNotMatch(src, /hasVerifiedTrust/)
  const aggregated = { id: `himalayas:${"c".repeat(40)}`, provenance: "AGGREGATED", source: "Himalayas", apply_url: "https://himalayas.app/x/y", verified: true, jobStatus: "VERIFIED_JOB" as const }
  assert.equal(isEmployerVerified(aggregated), false)
  const employer = { id: "e1", provenance: "EMPLOYER", employer_id: "emp-1", verified: true, jobStatus: "VERIFIED_JOB" as const }
  assert.equal(isEmployerVerified(employer), true, "a verified employer's own posting keeps its label")
})

test("CLAIMS: an external-source card names its source ('via …') and never says Verified", () => {
  const src = code("src/components/jobs/JobCard.tsx")
  assert.match(src, /link\.kind\s*===\s*'external'\s*\|\|\s*link\.kind\s*===\s*'unavailable'\s*\?\s*'🌐 via '/)
  assert.doesNotMatch(src, /\|\|\s*'Verified'/, "no unconditional 'Verified' fallback in the card footer")
  // The source-name cleanup used for the label: "Himalayas (Verified Remote)" → "Himalayas".
  assert.equal("Himalayas (Verified Remote)".replace(/\s*\((?:verified[^)]*)\)/i, ""), "Himalayas")
})

test("CLAIMS: the OG image carries no counts and no verification claim (verifiable from its source)", () => {
  const src = code("src/app/opengraph-image.tsx")
  assert.doesNotMatch(src, /verified/i)
  assert.doesNotMatch(src, /\d[\d,]*\+/, "no 'N+' figure")
})

/* ───────────────────────── 4. Salary ───────────────────────── */

const usd = (n: number) => `$${Math.round(n / 1000)}K`
const inr = (n: number) => `₹${Math.round(n / 100000)}L`

test("SALARY: formatSalaryRange — real figures format; zero / missing / invalid / rounds-to-zero are unavailable", () => {
  assert.equal(formatSalaryRange(60000, 90000, usd), "$60K-$90K/yr")
  assert.equal(formatSalaryRange(60000, undefined, usd), "$60K/yr")
  assert.equal(formatSalaryRange(0, 90000, usd), "$90K/yr", "a zero bound is 'missing', not a floor of zero")
  assert.equal(formatSalaryRange(800000, 1500000, inr), "₹8L-₹15L/yr")
  for (const [a, b] of [[undefined, undefined], [0, 0], [null, null], [NaN, NaN], [-5, -9], ["60000", "90000"], [Infinity, undefined]] as [unknown, unknown][]) {
    assert.equal(formatSalaryRange(a, b, usd), "", `${String(a)} / ${String(b)}`)
  }
  for (const [a, b] of [[100, 400], [300, 80000], [200, undefined], [undefined, 450], [499, 499]] as [number | undefined, number | undefined][]) {
    assert.equal(formatSalaryRange(a, b, usd), "", `${a} / ${b} would render as $0K`)
  }
  assert.equal(formatSalaryRange(500, 900, usd), "$1K-$1K/yr", "500 rounds to 1K — a real (if odd) figure is not hidden")
  assert.equal(formatSalaryRange(30000, 40000, inr), "", "₹0L is not a salary")
})

test("SALARY: the exact QA string and its siblings are placeholders and never displayed", () => {
  for (const v of ["$0K-$0K/yr", "$0K–$0K/yr", "$0K-$0K", "₹0L-₹0L/yr", "USD 0K-USD 0K/yr", "$0K/yr", "₹0L/yr", "$0", "0-0", "$0K - $0K / yr", "$0K to $0K"]) {
    assert.equal(isZeroSalaryText(v), true, v)
    assert.equal(isRealDisplayValue(v), false, v)
    assert.equal(displayValue(v), undefined, v)
  }
  for (const v of ["$60K-$90K/yr", "$10K/yr", "₹0.5L/yr", "₹8-14 LPA", "$100K+", "15,000/mo", "0 openings", "Remote — 0 relocation"]) {
    assert.equal(isZeroSalaryText(v), false, v)
  }
  assert.equal(displayValue("$60K-$90K/yr"), "$60K-$90K/yr")
  assert.equal(displayValue("₹0.5L/yr"), "₹0.5L/yr")
})

test("SALARY: the live Himalayas mapper no longer emits '$0K-$0K/yr' (or 'Competitive' filler) — it emits '' (hidden)", () => {
  const raw = (over: Record<string, unknown>) => ({
    title: "Backend Engineer", companyName: "micro1", companySlug: "micro1", employmentType: "Full-time", seniority: ["Mid-level"],
    currency: "USD", categories: ["software-engineering"], locationRestrictions: [], excerpt: "Build and ship backend services.",
    applicationLink: "https://himalayas.app/companies/micro1/jobs/backend-engineer/apply",
    guid: "https://himalayas.app/companies/micro1/jobs/backend-engineer", ...over,
  })
  const salaryOf = (over: Record<string, unknown>) => mapRawHimalayasJob(raw(over), new Set())?.salary
  assert.equal(salaryOf({ minSalary: 60000, maxSalary: 90000 }), "$60K-$90K/yr")
  assert.equal(salaryOf({ minSalary: 100, maxSalary: 400 }), "")
  assert.equal(salaryOf({ minSalary: 0, maxSalary: 0 }), "")
  assert.equal(salaryOf({}), "")
})

test("SALARY: all three Himalayas formatters share the one rule — none keeps a raw 'min && max' K-rounding", () => {
  for (const f of ["src/lib/services/himalayasService.ts", "src/lib/services/himalayasWfhIngest.ts", "src/lib/services/himalayasAbroadIngest.ts"]) {
    const src = code(f)
    assert.match(src, /formatSalaryRange\(/, f)
    assert.doesNotMatch(src, /min\s*&&\s*max/, `${f}: raw range formatting`)
  }
  assert.match(code("src/lib/jobs/renderable.ts"), /isZeroSalaryText\(t\)/, "stored zero-ranges are hidden on display too")
})

/* ───────────────────────── 5. URL → view initialisation ───────────────────────── */

test("VIEW: the server (searchParams object) and the client (URLSearchParams) derive the SAME view from one URL", () => {
  const url = "country=UAE&category=Aviation&q=pilot&status=LIVE_JOB&page=3"
  const client = abroadViewFromParams(new URLSearchParams(url))
  const server = abroadViewFromSearchParams({ country: "UAE", category: "Aviation", q: "pilot", status: "LIVE_JOB", page: "3" })
  assert.deepEqual(client, { q: "pilot", country: "UAE", category: "Aviation", status: "LIVE_JOB", page: 3 })
  assert.equal(sameAbroadView(client, server), true)
  assert.equal(sameAbroadView(abroadViewFromParams(new URLSearchParams("")), abroadViewFromSearchParams({})), true, "unfiltered ↔ unfiltered")
  assert.equal(sameAbroadView(abroadViewFromSearchParams({ country: ["UAE", "UK"] }), abroadViewFromParams(new URLSearchParams("country=UAE"))), true, "first value wins on both sides")
})

test("VIEW: a different filter or page is a DIFFERENT view, so a change still refetches", () => {
  const base = abroadViewFromSearchParams({ country: "UAE" })
  for (const other of [{ country: "UK" }, {}, { country: "UAE", page: "2" }, { country: "UAE", q: "x" }, { country: "UAE", category: "Aviation" }, { country: "UAE", status: "LIVE_JOB" }]) {
    assert.equal(sameAbroadView(base, abroadViewFromSearchParams(other)), false, JSON.stringify(other))
  }
  assert.equal(sameAbroadView(base, undefined), false, "no server view (SSR failed) → the client fetches")
})

test("VIEW: page is always a finite integer >= 1 on both sides ('abc', 0, -2, 2.7, '' never yield NaN)", () => {
  for (const [raw, want] of [["abc", 1], ["0", 1], ["-2", 1], ["2.7", 2], ["", 1], [undefined, 1], ["5", 5], [null, 1]] as [unknown, number][]) {
    assert.equal(normalisePage(raw), want, String(raw))
    assert.equal(abroadViewFromSearchParams({ page: raw as string | undefined }).page, want)
  }
})

test("VIEW: ?country=UAE — the server-rendered initial data IS the filtered view (total / jobs / counts), not the unfiltered one", () => {
  const view = abroadViewFromSearchParams({ country: "UAE" })
  const rendered = getAbroadJobsPaginatedLocal({ ...abroadQueryFor(view), limit: 20 } as never, true)
  const unfiltered = getAbroadJobsPaginatedLocal({ page: 1, limit: 20 }, true)
  assert.ok(unfiltered.total > rendered.total, "the UAE total is smaller than the unfiltered one the page used to flash")
  assert.ok(rendered.total > 0)
  for (const j of rendered.items) assert.match(`${j.country} ${j.location}`, /UAE|United Arab Emirates|Dubai|Abu Dhabi|Sharjah/i)
  // …and it is exactly what the API would return for the same URL (the client's later fetch cannot disagree).
  const api = getAbroadJobsPaginatedLocal({ q: "", country: "UAE", category: "", status: undefined, page: 1, limit: 20 }, true)
  assert.equal(rendered.total, api.total)
  assert.deepEqual(rendered.items.map(j => j.id), api.items.map(j => j.id))
  assert.deepEqual(rendered.counts, api.counts)
})

test("VIEW: pagination view — page 2 of a country filter is rendered by the server as page 2 of that filter", () => {
  const p1 = getAbroadJobsPaginatedLocal({ ...abroadQueryFor(abroadViewFromSearchParams({ country: "Germany", page: "1" })), limit: 5 } as never, true)
  const p2 = getAbroadJobsPaginatedLocal({ ...abroadQueryFor(abroadViewFromSearchParams({ country: "Germany", page: "2" })), limit: 5 } as never, true)
  assert.equal(p2.page, 2)
  assert.equal(p1.total, p2.total)
  assert.equal(p1.items.some(a => p2.items.some(b => a.id === b.id)), false)
})

test("VIEW: wiring — the page renders the URL view and hands it over; the panel skips its fetch only on an equal view", () => {
  const page = code("src/app/jobs/abroad/page.tsx")
  assert.match(page, /abroadViewFromSearchParams\(\s*sp\s*\)/)
  assert.match(page, /getAbroadJobsPaginated\(\{\s*\.\.\.abroadQueryFor\(view\)/)
  assert.match(page, /initialData\s*=\s*\{[\s\S]*?\bview,?\s*[\s\S]*?\}/)
  assert.doesNotMatch(page, /getAbroadJobsPaginated\(\{\s*page,\s*limit:\s*20\s*\}\)/, "no longer fetches the unfiltered page regardless of the URL")
  const panel = code("src/components/abroad/AbroadJobsPanel.tsx")
  assert.match(panel, /isServerView\s*=\s*sameAbroadView\(\s*view\s*,\s*initialData\?\.view\s*\)/)
  assert.match(panel, /const\s+view\s*=\s*abroadViewFromParams\(\s*params\s*\)/)
  assert.doesNotMatch(panel, /Number\(params\.get\('page'\)/, "client page parsing is the shared normalisePage")
  assert.doesNotMatch(panel, /setLoading\(/, "loading is derived from view equality, not an effect-set flag that lags the URL change")
})

/* ───────── 6. Abroad filter change: the old total is never presented as the new selection's ───────── */

const UNFILTERED = { q: "", country: "", category: "", status: "all", page: 1 }
const view = (over: Record<string, unknown> = {}) => ({ ...UNFILTERED, ...over })

test("TRANSITION: unfiltered → UK / UAE / any filter is a pending TOTAL; page-only change keeps the total; same view is settled", () => {
  for (const country of ["UK", "UAE"]) {
    const t = abroadTransition(view({ country }), UNFILTERED)
    assert.deepEqual(t, { listPending: true, totalPending: true }, `${country}: old total must not be shown`)
  }
  assert.deepEqual(abroadTransition(view({ q: "nurse" }), UNFILTERED), { listPending: true, totalPending: true })
  assert.deepEqual(abroadTransition(view({ status: "LIVE_JOB" }), UNFILTERED), { listPending: true, totalPending: true })
  assert.deepEqual(abroadTransition(view({ page: 2 }), UNFILTERED), { listPending: true, totalPending: false }, "same filters → same total, only the list is pending")
  assert.deepEqual(abroadTransition(UNFILTERED, UNFILTERED), { listPending: false, totalPending: false })
  assert.deepEqual(abroadTransition(view({ country: "UK" }), view({ country: "UK" })), { listPending: false, totalPending: false })
  // No data yet (no server view) → everything pending, never a zero / stale number.
  assert.deepEqual(abroadTransition(UNFILTERED, undefined), { listPending: true, totalPending: true })
  assert.equal(sameAbroadFilters(view({ page: 5 }), view({ page: 1 })), true)
  assert.equal(sameAbroadFilters(view({ country: "UK" }), view({ country: "UAE" })), false)
})

test("TRANSITION: from the CLICK (URL not yet changed — Next is still rendering the server page) the target is shown, so the old total is already withdrawn", () => {
  for (const country of ["UK", "UAE"]) {
    const target = view({ country })
    const shown = shownAbroadView(UNFILTERED, target, true) // URL still unfiltered, navigation in flight
    assert.equal(shown.country, country)
    assert.deepEqual(abroadTransition(shown, UNFILTERED), { listPending: true, totalPending: true }, `${country}: no "190" from the instant of the click`)
  }
  // Navigation finished / abandoned (isNavigating false) → the URL view rules again, so a settled page is never stuck "loading".
  assert.deepEqual(shownAbroadView(UNFILTERED, view({ country: "UK" }), false), UNFILTERED)
  assert.deepEqual(abroadTransition(shownAbroadView(UNFILTERED, view({ country: "UK" }), false), UNFILTERED), { listPending: false, totalPending: false })
  assert.deepEqual(shownAbroadView(UNFILTERED, undefined, true), UNFILTERED)
})

// Render the REAL panel on the server (effects do not run) with a mocked router / URL — i.e. the exact frame the
// browser paints between the click's URL change and the data arriving.
/* eslint-disable @typescript-eslint/no-require-imports */
const ReactLib = require("react")
const { renderToString } = require("react-dom/server")
const NodeModule = require("node:module")
let mockSearch = ""
const origLoad = NodeModule._load
NodeModule._load = function (req: string, ...rest: unknown[]) {
  if (req === "next/navigation") {
    return { useRouter: () => ({ push() {} }), usePathname: () => "/jobs/abroad", useSearchParams: () => new URLSearchParams(mockSearch) }
  }
  return origLoad.call(this, req, ...rest)
}
;(globalThis as unknown as { React: unknown }).React = ReactLib
const { AbroadJobsPanel } = require("../../components/abroad/AbroadJobsPanel")
NodeModule._load = origLoad

const counts = { all: 190, live: 100, verified: 50, archived: 40 }
function renderPanel(search: string, loaded: { total: number; totalPages: number; view: ReturnType<typeof view> }) {
  mockSearch = search
  NodeModule._load = function (req: string, ...rest: unknown[]) {
    if (req === "next/navigation") return { useRouter: () => ({ push() {} }), usePathname: () => "/jobs/abroad", useSearchParams: () => new URLSearchParams(mockSearch) }
    return origLoad.call(this, req, ...rest)
  }
  try {
    const initialData = { jobs: [], counts, page: loaded.view.page, ...loaded }
    return (renderToString(ReactLib.createElement(AbroadJobsPanel, { countries: [], initialData })) as string).replace(/<!-- -->/g, "")
  } finally {
    NodeModule._load = origLoad
  }
}
const unfilteredLoaded = { total: 190, totalPages: 10, view: UNFILTERED }

for (const country of ["UK", "UAE"]) {
  test(`TRANSITION: clicking ${country} from the unfiltered page — the first frame shows NO "190" / "Showing 190" / "Page 1 of 10", only a loading state`, () => {
    const html = renderPanel(`country=${country}`, unfilteredLoaded)
    assert.match(html, /data-total-state="loading"/)
    assert.match(html, /Updating results/)
    assert.match(html, /Loading abroad jobs/)
    assert.doesNotMatch(html, /190/, "the unfiltered total must not appear anywhere in the transition frame")
    assert.doesNotMatch(html, /Showing/)
    assert.doesNotMatch(html, /Page 1 of 10/)
    assert.doesNotMatch(html, /No abroad jobs match/, "a pending view is not an empty result")
  })
}

test("TRANSITION: the settled server-rendered views are unchanged — unfiltered shows 190; a ?country=UK deep link shows its own 11 immediately", () => {
  const plain = renderPanel("", unfilteredLoaded)
  assert.match(plain, /data-total-state="ready"/)
  assert.match(plain, /Showing <strong[^>]*>190<\/strong> international jobs/)
  assert.match(plain, /Page 1 of 10/)
  const ukView = view({ country: "UK" })
  const deep = renderPanel("country=UK", { total: 11, totalPages: 1, view: ukView })
  assert.match(deep, /data-total-state="ready"/)
  assert.match(deep, /Showing <strong[^>]*>11<\/strong> international jobs/)
  assert.doesNotMatch(deep, /Updating results/)
  assert.doesNotMatch(deep, /Loading abroad jobs/)
})

test("TRANSITION: a page-only change keeps the (still valid) total and the pager while the list loads", () => {
  const html = renderPanel("page=2", unfilteredLoaded)
  assert.match(html, /data-total-state="ready"/)
  assert.match(html, /Showing <strong[^>]*>190<\/strong>/)
  assert.match(html, /Page 2 of 10/)
  assert.match(html, /Loading abroad jobs/)
})

test("TRANSITION: wiring — loading derives from the loaded view; a stale response cannot overwrite a newer selection", () => {
  const panel = code("src/components/abroad/AbroadJobsPanel.tsx")
  assert.match(panel, /abroadTransition\(\s*shownView\s*,\s*loadedView\s*\)/)
  assert.match(panel, /useState<AbroadView \| undefined>\(initialData\?\.view\)/)
  assert.match(panel, /let cancelled = false/)
  assert.match(panel, /return \(\) => \{ cancelled = true \}/)
  assert.equal((panel.match(/if \(cancelled\) return/g) ?? []).length >= 1, true)
  assert.match(panel, /setLoadedView\(requested\)/)
  assert.match(panel, /useTransition\(\)/)
  assert.match(panel, /startNavigation\(\(\) => router\.push\(/, "the click's navigation is a tracked transition")
  assert.match(panel, /setNavTarget\(abroadViewFromParams\(p\)\)/)
  assert.match(panel, /shownAbroadView\(\s*view\s*,\s*navTarget\s*,\s*isNavigating\s*\)/)
  assert.match(panel, /abroadTransition\(\s*shownView\s*,\s*loadedView\s*\)/)
  assert.match(panel, /if \(isServerView && initialData\) \{[\s\S]*?setLoadedView\(initialData\.view\)[\s\S]*?return/, "a committed navigation adopts its server-rendered data instead of refetching")
  assert.match(panel, /totalPending \? '…'/, "status tab counts are placeholders while the filter is pending")
})

console.log(`\npreview QA fix tests: ${passed} passed, ${failed} failed`)
process.exitCode = failed ? 1 : 0
