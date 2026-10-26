/**
 * countryIdentity.test.ts — country IDENTITY (not just count/list parity).
 *
 *   npm run test:country-identity
 *
 * The shared rule in countryIdentity.ts must make a country card mean its own country:
 * UK ↔ United Kingdom, UAE ↔ United Arab Emirates, and never "Oman" ↔ "Romania" or "UK" ↔ "Ukraine".
 * Pure and hermetic.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { canonicalCountry, countryMatches, filterByCountry, normalizeCountryText } from "./countryIdentity"
import { ABROAD_COUNTRY_TARGETS } from "../data/jobInventory"

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

test("UK ↔ United Kingdom (what Himalayas rows store), and not Ukraine", () => {
  for (const stored of ["United Kingdom", "united kingdom", "UK", "uk", "U.K.", "Great Britain", "GB", "London, United Kingdom", "UK (London)"]) {
    assert.equal(countryMatches(stored, "UK"), true, `stored "${stored}" for the UK card`)
    assert.equal(countryMatches(stored, "United Kingdom"), true, `stored "${stored}" for "United Kingdom"`)
  }
  for (const stored of ["Ukraine", "UKRAINE", "Ukraine (remote)", "Kyiv, Ukraine"]) {
    assert.equal(countryMatches(stored, "UK"), false, `"${stored}" must not be the UK`)
    assert.equal(countryMatches(stored, "United Kingdom"), false)
  }
})

test("UAE ↔ United Arab Emirates, in every spelling and as one part of a free-text value", () => {
  for (const stored of ["UAE", "uae", "U.A.E.", "United Arab Emirates", "UNITED ARAB EMIRATES", "Emirates", "AE", "Dubai, UAE", "UAE (Dubai)", "Abu Dhabi / United Arab Emirates"]) {
    assert.equal(countryMatches(stored, "UAE"), true, `stored "${stored}" for the UAE card`)
    assert.equal(countryMatches(stored, "United Arab Emirates"), true)
  }
  assert.equal(countryMatches("Dubai", "UAE"), false, "a city is not a country alias")
})

test("Oman never matches Romania — nor any other name that merely contains another country's letters", () => {
  assert.equal(countryMatches("Romania", "Oman"), false)
  assert.equal(countryMatches("ROMANIA", "oman"), false)
  assert.equal(countryMatches("Oman", "Oman"), true)
  assert.equal(countryMatches("oman", "OMAN"), true)
  assert.equal(countryMatches("Sultanate of Oman", "Oman"), true)
  assert.equal(countryMatches("Muscat, Oman", "Oman"), true)
  for (const [stored, requested] of [["Nigeria", "Niger"], ["Germany", "Man"], ["Mali", "Malaysia"], ["Malaysia", "Mali"], ["Guinea-Bissau", "Guinea"], ["Dominican Republic", "Dominica"], ["Saudi Arabia", "Arabia"], ["Ireland", "Iceland"]]) {
    assert.equal(countryMatches(stored, requested), false, `"${stored}" ≠ "${requested}"`)
  }
})

test("case-insensitive, accent-insensitive, punctuation-insensitive", () => {
  assert.equal(countryMatches("CANADA", "canada"), true)
  assert.equal(countryMatches("  Canada  ", "Canada"), true)
  assert.equal(countryMatches("Cañada", "Canada"), true)
  assert.equal(normalizeCountryText("U.A.E."), "uae")
  assert.equal(normalizeCountryText(null), "")
  assert.equal(canonicalCountry("The Netherlands"), canonicalCountry("Holland"))
  assert.equal(canonicalCountry("U.S.A."), canonicalCountry("United States of America"))
})

test("a blank requested country means 'no filter'; a blank / non-string stored value matches no real country", () => {
  for (const blank of ["", "   ", undefined, null]) {
    assert.equal(countryMatches("Canada", blank), true)
    assert.equal(countryMatches(undefined, blank), true)
  }
  for (const stored of ["", "   ", undefined, null, 42, {}]) assert.equal(countryMatches(stored, "Canada"), false)
})

test("matching is on whole country tokens — never a substring of one", () => {
  assert.equal(countryMatches("Kingdom of Nowhere", "United Kingdom"), false)
  assert.equal(countryMatches("Arab Republic", "UAE"), false)
  assert.equal(countryMatches("kingdom", "UK"), false)
  assert.equal(countryMatches("UK", "kingdom"), false)
  assert.equal(countryMatches("Emirat", "UAE"), false)
  // A value naming two countries matches each of them.
  assert.equal(countryMatches("UK / Ireland", "UK"), true)
  assert.equal(countryMatches("UK / Ireland", "Ireland"), true)
  assert.equal(countryMatches("UK / Ireland", "Germany"), false)
})

test("an unlisted country still matches itself (equality), so new countries need no code change", () => {
  assert.equal(countryMatches("Japan", "japan"), true)
  assert.equal(countryMatches("Japan", "Jap"), false)
  assert.equal(countryMatches("South Korea", "Korea"), false)
})

test("filterByCountry: same rule, same order; blank → every row", () => {
  const rows = [{ country: "Ukraine", id: 1 }, { country: "United Kingdom", id: 2 }, { country: "UK", id: 3 }, { country: "Romania", id: 4 }, { country: "Oman", id: 5 }]
  assert.deepEqual(filterByCountry(rows, "UK").map(r => r.id), [2, 3])
  assert.deepEqual(filterByCountry(rows, "Oman").map(r => r.id), [5])
  assert.deepEqual(filterByCountry(rows, "").map(r => r.id), [1, 2, 3, 4, 5])
  assert.notEqual(filterByCountry(rows, ""), rows, "returns a copy")
})

test("distinct countries never match one another: every card × every stored name, only the same country matches", () => {
  const stored = [
    ...ABROAD_COUNTRY_TARGETS.map(c => c.country), // what the local inventory stores
    "United Kingdom", "United Arab Emirates", "United States", "Romania", "Ukraine", "Japan", "Switzerland", "Sweden", "Denmark", "Norway", "South Korea", "Poland", "Spain", "Italy", "Portugal",
    "Europe", "Middle East", "North America", "Latin America", "Africa",
  ]
  for (const card of ABROAD_COUNTRY_TARGETS.map(c => c.country)) {
    for (const s of stored) {
      const same = canonicalCountry(s) === canonicalCountry(card)
      assert.equal(countryMatches(s, card), same, `card "${card}" vs stored "${s}"`)
    }
  }
})

test("every country card matches the canonical value the Himalayas Abroad ingest STORES for it", () => {
  const src = readFileSync(join(process.cwd(), "src/lib/services/himalayasAbroadIngest.ts"), "utf8")
  const stored = [...src.matchAll(/country:\s*"([^"]+)"\s*\}/g)].map(m => m[1])
  assert.ok(stored.length >= 25, `parsed the ingest's country map (${stored.length} entries)`)
  // The card name → the value the ingest writes for jobs in that country.
  const ingestValue: Record<string, string> = { UAE: "UAE", UK: "United Kingdom" }
  for (const card of ABROAD_COUNTRY_TARGETS.map(c => c.country)) {
    const value = ingestValue[card] ?? card
    if (!stored.includes(value)) continue // a card the ingest has no entry for (e.g. none today) is covered by the matrix above
    assert.equal(countryMatches(value, card), true, `ingest stores "${value}" → card "${card}"`)
  }
  assert.ok(stored.includes("United Kingdom") && stored.includes("UAE"), "the two names that used to mismatch are real stored values")
  // …and no stored value is claimed by a card it is not.
  for (const card of ABROAD_COUNTRY_TARGETS.map(c => c.country)) {
    for (const s of stored) {
      if (canonicalCountry(s) !== canonicalCountry(card)) assert.equal(countryMatches(s, card), false, `stored "${s}" must not count for card "${card}"`)
    }
  }
})

test("live-provider rows (ISO code in `country`, place in `location`) resolve by the same rule", () => {
  const liveMatches = (row: { country?: string; location?: string }, c: string) => countryMatches(row.country, c) || countryMatches(row.location, c)
  assert.equal(liveMatches({ country: "GB", location: "Manchester" }, "UK"), true)
  assert.equal(liveMatches({ country: "AE", location: "Dubai" }, "UAE"), true)
  assert.equal(liveMatches({ country: "", location: "London, UK" }, "United Kingdom"), true)
  assert.equal(liveMatches({ country: "UA", location: "Kyiv, Ukraine" }, "UK"), false)
  assert.equal(liveMatches({ country: "RO", location: "Bucharest, Romania" }, "Oman"), false)
})

test("no source-specific raw substring / equality country rule is left in the code", () => {
  const strip = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")
  assert.doesNotMatch(strip("src/lib/services/abroadJobService.ts"), /\.ilike\(\s*["']country["']/, "no SQL ILIKE country pushdown")
  assert.doesNotMatch(strip("src/lib/services/abroadJobLocal.ts"), /country\s*\|\|\s*""\)\.toLowerCase\(\)\s*===/, "no raw local equality")
  assert.doesNotMatch(strip("src/lib/services/liveJobOpportunities.ts"), /needle|toLowerCase\(\)\.includes/, "no raw live substring")
  for (const p of ["src/lib/services/abroadJobService.ts", "src/lib/services/abroadJobLocal.ts", "src/lib/services/liveJobOpportunities.ts", "src/lib/data/jobInventory.ts"]) {
    assert.match(strip(p), /countryIdentity/, `${p} uses the shared rule`)
  }
})

console.log(`\ncountry identity tests: ${passed} passed, ${failed} failed`)
process.exitCode = failed ? 1 : 0
