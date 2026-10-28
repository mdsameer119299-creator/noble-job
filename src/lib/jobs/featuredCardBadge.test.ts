/**
 * featuredCardBadge.test.ts — the homepage trust/source badge is decided by PROVENANCE + VERIFICATION
 * EVIDENCE, independently of where the card links.
 *
 *   npm run test:featured-badge
 *
 * Rows are built the way the application builds them (mapPrivateJobRow, toLiveExternalJobs, raw WFH/Abroad
 * rows), run through the same two functions the page uses — featuredCardTrust() (the service stamps this on
 * every card) and featuredCardBadge() / featuredCardLink() (the section renders these) — and judged against
 * the application's own predicates (classifyProvenance / isGenuine / hasVerifiedTrust / isEmployerVerified).
 * Hermetic: no network, no database.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { featuredCardBadge, featuredCardTrust, type FeaturedCardBadge } from "./featuredCardBadge"
import { featuredCardLink, type FeaturedCardLinkInput } from "./featuredCardLink"
import { classifyProvenance, hasVerifiedTrust, isEmployerVerified, isGenuine, type Classifiable } from "./provenance"
import { mapPrivateJobRow } from "../services/jobMapper"
import { toLiveExternalJobs } from "./clientRecords"

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

const UUID = "9b2f6c1e-0000-4000-8000-0000000000aa"
const REAL_URL = "https://jobs.example-employer.in/apply/123".replace("example-employer", "acme-hiring") // not a placeholder host
const OFFICIAL_URL = "https://upsc.gov.in/recruitment/notification-2026.pdf"
const HIMALAYAS_ID = `himalayas:${"a".repeat(40)}`

/** What the service does: job row → card carrying the resolved trust fields; then what the page does. */
function render(job: Classifiable, board: "private" | "wfh" | "abroad" = "private") {
  const card: FeaturedCardLinkInput & { employerVerified?: boolean } = {
    board, id: String(job.id), apply_url: job.applyUrl || job.apply_url || undefined, ...featuredCardTrust(job),
  }
  const link = featuredCardLink(card)
  const badge: FeaturedCardBadge | null = featuredCardBadge(card)
  return { card, link, badge }
}

const privateRow = (over: Record<string, unknown> = {}) => mapPrivateJobRow({
  id: UUID, title: "Accounts Executive", company: "Acme Pvt Ltd", location: "Pune", status: "active",
  description: "Maintain ledgers and reconcile accounts for the Pune office.", apply_url: "", posted_at: "2026-10-20T00:00:00Z", ...over,
})

// ── EMPLOYER ───────────────────────────────────────────────────────────────────────────────────────
test("EMPLOYER + verification evidence (employer_id, is_verified) → 'Verified', internal link", () => {
  const r = render(privateRow({ provenance: "EMPLOYER", employer_id: "emp-1", is_verified: true }))
  assert.equal(r.card.provenance, "EMPLOYER")
  assert.equal(r.card.employerVerified, true)
  assert.equal(r.badge?.kind, "verified")
  assert.equal(r.badge?.label, "Verified")
  assert.deepEqual(r.link, { href: `/jobs/private/${UUID}`, external: false })
})

test("EMPLOYER inferred from evidence alone (no stored provenance): employer_id + is_verified → 'Verified'", () => {
  const r = render(privateRow({ employer_id: "emp-1", is_verified: true }))
  assert.equal(r.card.provenance, "EMPLOYER")
  assert.equal(r.badge?.kind, "verified")
})

test("EMPLOYER without verification evidence → 'Employer listing' — internal link and a UUID id prove nothing", () => {
  const r = render(privateRow({ provenance: "EMPLOYER", employer_id: "emp-1", is_verified: false }))
  assert.equal(r.link?.external, false, "same internal link as a verified employer card")
  assert.equal(r.card.employerVerified, false)
  assert.equal(r.badge?.kind, "employer")
  assert.equal(r.badge?.label, "Employer listing")
  assert.notEqual(r.badge?.label, "Verified")
})

test("EMPLOYER on the WFH / Abroad boards: VERIFIED_JOB evidence → 'Verified'; a raw is_verified column alone does not (no unmapped inference)", () => {
  for (const board of ["wfh", "abroad"] as const) {
    const verified = render({ id: UUID, provenance: "EMPLOYER", employer_id: "emp-2", jobStatus: "VERIFIED_JOB", status: "active" }, board)
    assert.equal(verified.badge?.kind, "verified", `${board} VERIFIED_JOB`)
    const live = render({ id: UUID, provenance: "EMPLOYER", employer_id: "emp-2", jobStatus: "LIVE_JOB", status: "active" }, board)
    assert.equal(live.badge?.kind, "employer", `${board} LIVE_JOB`)
    const rawFlag = render({ id: UUID, provenance: "EMPLOYER", employer_id: "emp-2", is_verified: true, status: "active" } as Classifiable, board)
    assert.equal(rawFlag.badge?.kind, "employer", `${board}: only the application's own predicate (jobStatus / verified) counts`)
  }
})

test("EMPLOYER stamped but missing the owning employer_id is not genuine → never 'Verified'", () => {
  const job: Classifiable = { id: UUID, provenance: "EMPLOYER", employer_id: null, jobStatus: "VERIFIED_JOB", verified: true }
  assert.equal(isGenuine(job), false)
  assert.equal(featuredCardTrust(job).employerVerified, false)
  assert.notEqual(featuredCardBadge({ id: UUID, ...featuredCardTrust(job) })?.kind, "verified")
})

// ── AGGREGATED ─────────────────────────────────────────────────────────────────────────────────────
test("AGGREGATED (Himalayas) → 'Source ↗' and an external link — even if a stale verified flag / VERIFIED_JOB is set", () => {
  const [agg] = toLiveExternalJobs([{ id: HIMALAYAS_ID, title: "Platform Engineer", company: "Globex", location: "Remote", description: "Build things.", applyUrl: REAL_URL, source: "Himalayas", verified: true, jobStatus: "VERIFIED_JOB" }])
  assert.ok(agg, "the live mapper produced a card")
  const r = render(agg)
  assert.equal(r.card.provenance, "AGGREGATED")
  assert.equal(hasVerifiedTrust(agg), true, "the generic predicate WOULD say verified for this row…")
  assert.equal(r.card.employerVerified, false, "…but an aggregated row is never an employer we verified")
  assert.equal(r.badge?.kind, "source")
  assert.equal(r.badge?.label, "Source ↗")
  assert.deepEqual(r.link, { href: REAL_URL, external: true })
})

test("AGGREGATED by provenance with a UUID id is still 'Source ↗' (an internal-looking id grants nothing)", () => {
  const r = render({ id: UUID, provenance: "AGGREGATED", source: "himalayas", apply_url: REAL_URL, verified: true, jobStatus: "VERIFIED_JOB" }, "wfh")
  assert.equal(r.badge?.kind, "source")
  assert.equal(r.link?.external, true)
  assert.equal(r.card.employerVerified, false)
})

test("a Himalayas id is 'Source ↗' even when its provenance field claims EMPLOYER", () => {
  const r = render({ id: HIMALAYAS_ID, provenance: "EMPLOYER", employer_id: "emp-9", jobStatus: "VERIFIED_JOB", apply_url: REAL_URL }, "abroad")
  assert.equal(r.badge?.kind, "source")
})

test("AGGREGATED inferred from a trusted source + a real apply URL; with no real URL it is not genuine (and has no link)", () => {
  const ok = render({ id: "row-1", source: "Himalayas", apply_url: REAL_URL }, "wfh")
  assert.equal(ok.card.provenance, "AGGREGATED")
  assert.equal(ok.badge?.kind, "source")
  const bad = render({ id: "row-2", source: "Himalayas", apply_url: "#" }, "wfh")
  assert.notEqual(bad.card.provenance, "AGGREGATED")
  assert.equal(bad.link, null)
})

// ── CURATED / OFFICIAL ─────────────────────────────────────────────────────────────────────────────
test("CURATED → 'Curated' with an internal link — never 'Verified', even with a verified flag", () => {
  const job: Classifiable & { apply_url: string } = { id: UUID, provenance: "CURATED", source: "Curated by editorial team", apply_url: REAL_URL, jobStatus: "VERIFIED_JOB", verified: true }
  assert.equal(isGenuine(job), true)
  assert.equal(hasVerifiedTrust(job), true, "the generic trust predicate passes for a curated row with a flag…")
  const r = render(job)
  assert.equal(r.link?.external, false, "…and it has the same internal link as an employer card")
  assert.equal(r.card.employerVerified, false)
  assert.equal(r.badge?.kind, "curated")
  assert.equal(r.badge?.label, "Curated")
})

test("CURATED inferred from explicit editorial evidence in `source` + a real URL", () => {
  const r = render({ id: UUID, source: "Editorial pick", apply_url: REAL_URL })
  assert.equal(r.card.provenance, "CURATED")
  assert.equal(r.badge?.kind, "curated")
})

test("OFFICIAL → 'Official source' with an internal link — never 'Verified', even with a verified flag", () => {
  const job: Classifiable = { id: UUID, provenance: "OFFICIAL", official_url: OFFICIAL_URL, jobStatus: "VERIFIED_JOB", verified: true }
  assert.equal(isGenuine(job), true)
  const r = render(job)
  assert.equal(r.link?.external, false)
  assert.equal(r.card.employerVerified, false)
  assert.equal(r.badge?.kind, "official")
  assert.equal(r.badge?.label, "Official source")
})

test("OFFICIAL inferred only from a real official / notification URL (a generic portal homepage is not evidence)", () => {
  assert.equal(render({ id: UUID, official_url: OFFICIAL_URL }).badge?.kind, "official")
  const generic = render({ id: UUID, board: "govt", official_url: "https://india.gov.in/" })
  assert.equal(generic.card.provenance, "UNCLASSIFIED")
  assert.equal(generic.badge, null)
})

// ── SYNTHETIC / UNCLASSIFIED ───────────────────────────────────────────────────────────────────────
test("SYNTHETIC → no badge, no link, never verified — even when flagged VERIFIED_JOB / verified", () => {
  for (const job of [
    { id: "live-priv-1", provenance: "SYNTHETIC", jobStatus: "VERIFIED_JOB", verified: true, apply_url: REAL_URL },
    { id: UUID, provenance: "SYNTHETIC", employer_id: "emp-1", jobStatus: "VERIFIED_JOB", verified: true },
    { id: "ver-wfh-7", apply_url: REAL_URL },            // classified SYNTHETIC from its demo id
    { id: UUID, apply_url: "https://example.com/apply" }, // placeholder URL → SYNTHETIC
  ] as Classifiable[]) {
    const r = render(job)
    assert.equal(r.card.provenance, "SYNTHETIC", JSON.stringify(job))
    assert.equal(r.card.employerVerified, false)
    assert.equal(r.badge, null)
    assert.equal(r.link, null, "and it is not rendered")
  }
})

test("UNCLASSIFIED (legacy / insufficient evidence) → no badge, no link, never verified", () => {
  for (const job of [
    { id: UUID },
    { id: UUID, jobStatus: "VERIFIED_JOB", verified: true },        // a flag alone is not evidence
    { id: UUID, employer_id: "emp-1" },                             // ownership without verification evidence
    { id: UUID, source: "some-board", apply_url: REAL_URL },        // unknown source
  ] as Classifiable[]) {
    const r = render(job)
    assert.equal(r.card.provenance, "UNCLASSIFIED", JSON.stringify(job))
    assert.equal(r.card.employerVerified, false)
    assert.equal(r.badge, null)
    assert.equal(r.link, null)
  }
})

test("a card with a missing / unknown provenance gets no badge (the badge never guesses)", () => {
  for (const provenance of [undefined, "", "GENUINE", "VERIFIED", "employer "]) {
    assert.equal(featuredCardBadge({ id: UUID, provenance, employerVerified: true }), null, String(provenance))
  }
})

// ── independence & invariants ──────────────────────────────────────────────────────────────────────
test("INDEPENDENCE: cards with the SAME internal destination carry DIFFERENT badges", () => {
  const cards = [
    render(privateRow({ provenance: "EMPLOYER", employer_id: "emp-1", is_verified: true })),
    render(privateRow({ provenance: "EMPLOYER", employer_id: "emp-1", is_verified: false })),
    render({ id: UUID, provenance: "CURATED", source: "Curated", apply_url: REAL_URL }),
    render({ id: UUID, provenance: "OFFICIAL", official_url: OFFICIAL_URL }),
  ]
  assert.ok(cards.every(c => c.link && !c.link.external && c.link.href === `/jobs/private/${UUID}`), "all four link internally to the same shape of destination")
  assert.deepEqual(cards.map(c => c.badge?.kind), ["verified", "employer", "curated", "official"])
})

test("INVARIANT (exhaustive): 'Verified' is shown iff provenance is EMPLOYER, the row is genuine, and the application's verification evidence holds", () => {
  const ids = [UUID, HIMALAYAS_ID, "live-priv-1", "plain-id"]
  const provs = [undefined, "EMPLOYER", "AGGREGATED", "CURATED", "OFFICIAL", "SYNTHETIC", "UNCLASSIFIED", "bogus"]
  const statuses = [undefined, "LIVE_JOB", "VERIFIED_JOB", "ARCHIVED_JOB"]
  const bools = [undefined, true, false]
  const employers = [null, "emp-1"]
  const sources = [undefined, "himalayas", "curated", "employer"]
  const urls = [undefined, "#", REAL_URL]
  let verifiedSeen = 0
  let total = 0
  for (const id of ids) for (const provenance of provs) for (const jobStatus of statuses) for (const verified of bools)
    for (const employer_id of employers) for (const source of sources) for (const apply_url of urls) {
      const job = { id, provenance, jobStatus, verified, employer_id, source, apply_url } as Classifiable
      const r = render(job)
      const shown = r.badge?.kind === "verified"
      const expected = classifyProvenance(job) === "EMPLOYER" && isGenuine(job) && hasVerifiedTrust(job) && !id.startsWith("himalayas:")
      assert.equal(shown, expected, `${JSON.stringify(job)} → badge ${r.badge?.kind}`)
      assert.equal(isEmployerVerified(job), classifyProvenance(job) === "EMPLOYER" && hasVerifiedTrust(job))
      if (shown) {
        verifiedSeen++
        assert.equal(r.card.provenance, "EMPLOYER")
        assert.equal(r.link?.external, false, "an employer-verified card is a native card")
      }
      const nonGenuine = r.card.provenance === "SYNTHETIC" || r.card.provenance === "UNCLASSIFIED"
      if (nonGenuine) { assert.equal(r.badge, null, JSON.stringify(job)); assert.equal(r.link, null, JSON.stringify(job)) }
      else if (r.card.provenance === "AGGREGATED" || id.startsWith("himalayas:")) assert.equal(r.badge?.kind, "source", JSON.stringify(job))
      total++
    }
  assert.ok(verifiedSeen > 0, "the matrix does contain verified cases")
  assert.ok(total > 3000, `exercised ${total} combinations`)
})

test("trust fields only ever come from provenance.ts predicates — no id-shape, link or uuid inference", () => {
  const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1") as string
  const badge = src("src/lib/jobs/featuredCardBadge.ts")
  assert.match(badge, /classifyProvenance\(job\)/)
  assert.match(badge, /isEmployerVerified\(job\)/)
  assert.doesNotMatch(badge, /uuid|isValidJobId|\.href|\.external|startsWith\((?!['"]himalayas)/i)
})

console.log(`\nfeatured badge tests: ${passed} passed, ${failed} failed`)
process.exitCode = failed ? 1 : 0
