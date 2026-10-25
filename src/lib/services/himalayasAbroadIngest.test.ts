/**
 * himalayasAbroadIngest.test.ts — unit tests for the abroad jobs Himalayas
 * ingestion module.
 *
 *   npx tsx src/lib/services/himalayasAbroadIngest.test.ts
 *
 * Exercises the pure, exported helpers (extractAbroadCountry, idFromGuid,
 * stripHtml, unixToIso, toRow) with no network or database I/O — matching
 * the repo's other dependency-free unit tests. Also exercises the
 * "Supabase not configured" short-circuit of ingestHimalayasAbroadJobs()
 * to confirm no real DB call is made when credentials are absent.
 */
import assert from "node:assert/strict"
import {
  extractAbroadCountry,
  idFromGuid,
  stripHtml,
  unixToIso,
  toRow,
  ingestHimalayasAbroadJobs,
  type RawHimalayasJob,
} from "./himalayasAbroadIngest"

let passed = 0

// ── extractAbroadCountry ───────────────────────────────────────────────

// Returns null for no restrictions (worldwide → WFH, not abroad)
assert.strictEqual(extractAbroadCountry(undefined), null)
assert.strictEqual(extractAbroadCountry([]), null)
passed += 2

// Returns null for single Worldwide/Global/Remote/Anywhere (→ WFH)
assert.strictEqual(extractAbroadCountry(["Worldwide"]), null)
assert.strictEqual(extractAbroadCountry(["Global"]), null)
assert.strictEqual(extractAbroadCountry(["Remote"]), null)
assert.strictEqual(extractAbroadCountry(["Anywhere"]), null)
passed += 4

// Detects UAE from various spellings
assert.strictEqual(extractAbroadCountry(["United Arab Emirates"]), "UAE")
assert.strictEqual(extractAbroadCountry(["UAE"]), "UAE")
assert.strictEqual(extractAbroadCountry(["Dubai"]), "UAE")
assert.strictEqual(extractAbroadCountry(["Abu Dhabi"]), "UAE")
passed += 4

// Detects UK from various spellings
assert.strictEqual(extractAbroadCountry(["United Kingdom"]), "United Kingdom")
assert.strictEqual(extractAbroadCountry(["UK"]), "United Kingdom")
assert.strictEqual(extractAbroadCountry(["England"]), "United Kingdom")
assert.strictEqual(extractAbroadCountry(["London"]), "United Kingdom")
passed += 4

// Detects common destination countries
assert.strictEqual(extractAbroadCountry(["Canada"]), "Canada")
assert.strictEqual(extractAbroadCountry(["Australia"]), "Australia")
assert.strictEqual(extractAbroadCountry(["Singapore"]), "Singapore")
assert.strictEqual(extractAbroadCountry(["Germany"]), "Germany")
assert.strictEqual(extractAbroadCountry(["United States"]), "United States")
assert.strictEqual(extractAbroadCountry(["USA"]), "United States")
passed += 6

// Detects Gulf countries
assert.strictEqual(extractAbroadCountry(["Saudi Arabia"]), "Saudi Arabia")
assert.strictEqual(extractAbroadCountry(["Qatar"]), "Qatar")
assert.strictEqual(extractAbroadCountry(["Kuwait"]), "Kuwait")
assert.strictEqual(extractAbroadCountry(["Bahrain"]), "Bahrain")
assert.strictEqual(extractAbroadCountry(["Oman"]), "Oman")
passed += 5

// Detects regions as fallback
assert.strictEqual(extractAbroadCountry(["Europe"]), "Europe")
assert.strictEqual(extractAbroadCountry(["EMEA"]), "Europe")
assert.strictEqual(extractAbroadCountry(["Middle East"]), "Middle East")
assert.strictEqual(extractAbroadCountry(["LATAM"]), "Latin America")
passed += 4

// Picks first non-India country from multi-country restrictions
assert.strictEqual(extractAbroadCountry(["India", "United Kingdom"]), "United Kingdom")
passed += 1

// Returns null when only India is listed (domestic, not abroad)
assert.strictEqual(extractAbroadCountry(["India"]), null)
passed += 1

// Asia alone doesn't match (too broad, handled by WFH's isIndiaEligible)
assert.strictEqual(extractAbroadCountry(["Asia"]), null)
passed += 1

// Worldwide + specific country (multi-entry) → matches the country
assert.strictEqual(extractAbroadCountry(["Worldwide", "Canada"]), "Canada")
passed += 1

// Unrecognised restriction → null
assert.strictEqual(extractAbroadCountry(["SomeUnknownPlace"]), null)
passed += 1

// ── idFromGuid ─────────────────────────────────────────────────────────

{
  const id = idFromGuid("https://himalayas.app/jobs/senior-engineer-at-acme")
  assert.match(id, /^himalayas:[a-f0-9]{32}$/)
  passed += 1

  // Deterministic
  const a = idFromGuid("https://himalayas.app/jobs/test-job")
  const b = idFromGuid("https://himalayas.app/jobs/test-job")
  assert.strictEqual(a, b)
  passed += 1

  // Different guids → different ids
  const c = idFromGuid("https://himalayas.app/jobs/job-a")
  const d = idFromGuid("https://himalayas.app/jobs/job-b")
  assert.notStrictEqual(c, d)
  passed += 1
}

// ── stripHtml ──────────────────────────────────────────────────────────

assert.strictEqual(stripHtml("<p>Hello <b>world</b></p>"), "Hello world")
assert.strictEqual(stripHtml("AT&amp;T &lt;is&gt; great"), "AT&T <is> great")
assert.strictEqual(stripHtml(""), "")
passed += 3

// ── unixToIso ──────────────────────────────────────────────────────────

assert.strictEqual(unixToIso(1700000000), "2023-11-14T22:13:20.000Z")
assert.strictEqual(unixToIso(undefined), null)
assert.strictEqual(unixToIso(0), null)
assert.strictEqual(unixToIso(946684799), null) // 1999 → rejected
assert.strictEqual(unixToIso(4133980801), null) // 2101-01-01 → rejected
passed += 5

// ── toRow ───────────────────────────────────────────────────────────────

{
  const baseJob: RawHimalayasJob = {
    title: "Senior Engineer",
    companyName: "Acme Corp",
    companyLogo: "https://example.com/logo.png",
    employmentType: "Full-time",
    minSalary: 80000,
    maxSalary: 120000,
    currency: "USD",
    seniority: ["Senior"],
    categories: ["Software Engineering"],
    description: "<p>Build cool stuff</p>",
    locationRestrictions: ["United Kingdom"],
    applicationLink: "https://acme.com/apply",
    guid: "https://himalayas.app/jobs/senior-engineer-at-acme",
    pubDate: 1700000000,
    expiryDate: 1705000000,
  }

  const row = toRow(baseJob, "United Kingdom")
  assert.match(row.id, /^himalayas:/)
  assert.strictEqual(row.title, "Senior Engineer")
  assert.strictEqual(row.company, "Acme Corp")
  assert.strictEqual(row.country, "United Kingdom")
  assert.strictEqual(row.location, "Remote — United Kingdom")
  assert.strictEqual(row.type, "Full-time")
  assert.strictEqual(row.salary, "$80K-$120K/yr")
  assert.strictEqual(row.experience, "5+ Yrs")
  assert.strictEqual(row.category, "IT / Software")
  assert.strictEqual(row.description, "Build cool stuff")
  assert.strictEqual(row.apply_url, "https://acme.com/apply")
  assert.strictEqual(row.status, "active")
  assert.strictEqual(row.provenance, "AGGREGATED")
  assert.strictEqual(row.employer_id, null)
  assert.strictEqual(row.is_featured, false)
  assert.strictEqual(row.badge, "Sourced")
  assert.ok(row.source_posted_at, "source_posted_at should be set")
  assert.ok(row.application_deadline, "application_deadline should be set")
  passed += 18

  // Minimal job with missing optional fields
  const minimal: RawHimalayasJob = {
    title: "Test Job",
    companyName: "TestCo",
    guid: "https://himalayas.app/jobs/test",
    applicationLink: "https://test.com/apply",
  }
  const minRow = toRow(minimal, "Canada")
  assert.strictEqual(minRow.title, "Test Job")
  assert.strictEqual(minRow.company, "TestCo")
  assert.strictEqual(minRow.country, "Canada")
  assert.strictEqual(minRow.location, "Remote")
  assert.strictEqual(minRow.type, "Remote")
  assert.strictEqual(minRow.salary, "")
  assert.strictEqual(minRow.experience, "Any Experience")
  assert.strictEqual(minRow.source_posted_at, null)
  assert.strictEqual(minRow.application_deadline, null)
  passed += 9

  // Non-USD salary formatting
  const gbpJob: RawHimalayasJob = {
    ...baseJob,
    currency: "GBP",
    minSalary: 50000,
    maxSalary: 70000,
  }
  const gbpRow = toRow(gbpJob, "United Kingdom")
  assert.strictEqual(gbpRow.salary, "GBP 50K-GBP 70K/yr")
  passed += 1
}

// ── ingestHimalayasAbroadJobs short-circuit ─────────────────────────────

;(async () => {
  // With no Supabase configured (test environment), should short-circuit
  const result = await ingestHimalayasAbroadJobs()
  assert.strictEqual(result.ok, false)
  assert.strictEqual(result.reason, "supabase-admin-not-configured")
  assert.strictEqual(result.fetched, 0)
  assert.strictEqual(result.upserted, 0)
  assert.strictEqual(result.closed, 0)
  passed += 5

  console.log(`\n✅ himalayasAbroadIngest: all ${passed} assertions passed\n`)
})()
