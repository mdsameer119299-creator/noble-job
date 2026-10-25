/**
 * extractPublishedDate.test.ts — regression coverage for the "Dated"/"दिनांक"
 * source-publish-date extractor (see extractPublishedDate.ts for why this
 * exists: it is what makes `source_published_at` ever non-null in practice).
 *
 * Covers real failure cases, not just the happy path: text that must NOT
 * match (no marker, invalid calendar date, pre-2015/garbage year, future
 * date beyond clock skew), not just text that should.
 *
 *   npm run test:extract-published-date
 */
import assert from "node:assert/strict"
import { extractStatedPublishDate } from "./extractPublishedDate"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
    try { fn(); passed++; console.log(`  PASS  ${name}`) }
    catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}

const NOW = new Date("2026-10-24T00:00:00.000Z")

test("English 'Dated DD/MM/YYYY' marker is extracted as UTC midnight ISO", () => {
    const got = extractStatedPublishDate(
          "Recruitment Advertisement for Assistant Registrar 2025 (Advt. No. 34/2025), Dated 31/12/2025",
          NOW,
        )
    assert.equal(got, "2025-12-31T00:00:00.000Z")
})

test("Hindi 'दिनांक DD/MM/YYYY' marker is extracted", () => {
    const got = extractStatedPublishDate(
          "सहायक कुलसचिव परीक्षा - 2025 के पद हेतु साक्षात्‍कार आयोजन संबंधी सूचना, दिनांक 30/07/2026",
          NOW,
        )
    assert.equal(got, "2026-07-30T00:00:00.000Z")
})

test("dot and dash separators are accepted, not just slash", () => {
    assert.equal(extractStatedPublishDate("Announcement dated 08.06.2026 regarding Final Rejection", NOW), "2026-06-08T00:00:00.000Z")
    assert.equal(extractStatedPublishDate("Notice Dated 08-06-2026", NOW), "2026-06-08T00:00:00.000Z")
})

test("a date found anywhere in a long untruncated title is matched (truncation safety)", () => {
    const longTitle =
          "Madhya Pradesh Public Service Commission वैज्ञानिक अधिकारी रसायन के पद हेतु विलम्‍ब शुल्‍क से " +
          "अभिलेख प्रस्‍तुत किए जाने संबंधी सूचना, दिनांक 07/07/2026 — supplementary notice regarding late fee"
    assert.equal(extractStatedPublishDate(longTitle, NOW), "2026-07-07T00:00:00.000Z")
})

test("REAL production titles: a representative sample all extract correctly", () => {
    const cases: [string, string][] = [
          ["Recruitment Advertisement for Internal Accounts Examiner Officer Exam 2026 (Advt. No./10/2026), Dated 10/04/2026", "2026-04-10T00:00:00.000Z"],
          ["Recruitment Advertisement for Scientific Officer Biology 2026 (Adv No./07/2026), Dated 16/03/2026", "2026-03-16T00:00:00.000Z"],
          ["Recruitment Advertisement for State Forest Service Examination 2026 (Advt. 30/2025), Dated 31/12/2025", "2025-12-31T00:00:00.000Z"],
          ["Recruitment Advertisement for Assistant Research Officer Exam 2024 (Advt. No./12/2024) Dated 28/12/2024", "2024-12-28T00:00:00.000Z"],
        ]
    for (const [title, expected] of cases) assert.equal(extractStatedPublishDate(title, NOW), expected, title)
})

test("no 'Dated'/'दिनांक' marker at all → undefined, never guessed from a bare year", () => {
    assert.equal(extractStatedPublishDate("Madhya Pradesh Public Service Commission Advertisements", NOW), undefined)
    assert.equal(extractStatedPublishDate("Recruitment Advertisement for Assistant Director 2026, Department of Higher Education", NOW), undefined)
    assert.equal(extractStatedPublishDate("Gujarat Public Service Commission ATTACHMENT", NOW), undefined)
})

test("an advertisement number or vacancy figure next to a bare number is never mistaken for a date", () => {
    assert.equal(extractStatedPublishDate("Advt. No./29/2025 State Service Exam 2026 — 1247 vacancies", NOW), undefined)
})

test("a calendar-invalid date under a real marker is rejected (31/04, month 13, day 32)", () => {
    assert.equal(extractStatedPublishDate("Notice Dated 31/04/2026", NOW), undefined)
    assert.equal(extractStatedPublishDate("Notice Dated 05/13/2026", NOW), undefined)
    assert.equal(extractStatedPublishDate("Notice Dated 32/01/2026", NOW), undefined)
})

test("a pre-2015 or obviously-garbage year under a real marker is rejected", () => {
    assert.equal(extractStatedPublishDate("Notice Dated 01/01/1999", NOW), undefined)
    assert.equal(extractStatedPublishDate("Notice Dated 01/01/0026", NOW), undefined)
})

test("a date further in the future than the current run (beyond clock skew) is rejected, not treated as 'current'", () => {
    assert.equal(extractStatedPublishDate("Notice Dated 01/01/2027", NOW), undefined)
})

test("a date exactly 'today' (within 24h skew allowance) is accepted", () => {
    assert.equal(extractStatedPublishDate("Notice Dated 24/10/2026", NOW), "2026-10-24T00:00:00.000Z")
})

test("when multiple dated markers are present, the first valid one wins", () => {
    const got = extractStatedPublishDate("Corrigendum Dated 31/04/2026 — see original Notice Dated 10/03/2026", NOW)
    assert.equal(got, "2026-03-10T00:00:00.000Z")
})

test("empty/undefined/null input never throws and returns undefined", () => {
    assert.equal(extractStatedPublishDate(""), undefined)
    assert.equal(extractStatedPublishDate(undefined), undefined)
    assert.equal(extractStatedPublishDate(null), undefined)
})

console.log(`\nextractPublishedDate tests: ${passed} passed, ${failed} failed`)
process.exitCode = failed ? 1 : 0
