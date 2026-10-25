/**
 * employmentNews.test.ts — regression coverage for the Employment News
 * ("Job Highlights" table) adapter's publishedAt extraction (issue #46).
 *
 * ISSUED DATE is this source's OWN stated publication date (not a deadline, a
 * registration date, or an exam date) — see the header comment in
 * employmentNews.ts. This pins that it is correctly used as `publishedAt`,
 * validated by the shared conservative date rules, and that a malformed or
 * out-of-range issued date never becomes a fabricated publish date.
 *
 *   npm run test:employment-news-dates
 */
import assert from "node:assert/strict"
import { parseEmploymentNewsHtml } from "./employmentNews"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
    try { fn(); passed++; console.log(`  PASS  ${name}`) }
    catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}

const NOW = new Date("2026-10-24T00:00:00.000Z")

/** Minimal fixture mirroring the real AllJobs.aspx table: a header row + data rows. */
function tableHtml(rows: string[][]): string {
    const row = (cells: string[]) => `<tr>${cells.map(c => `<td>${c}</td>`).join("")}</tr>`
    return `<table>${row(["ISSUED DATE", "ORGANISATION", "POST", "METHOD OF APPOINTMENT", "LAST DATE"])}${rows.map(row).join("")}</table>`
}

test("a well-formed ISSUED DATE becomes publishedAt (UTC-midnight ISO)", () => {
    const html = tableHtml([["12/09/2026", "DRDO", "Scientist B", "Direct Recruitment", "30/10/2026"]])
    const [n] = parseEmploymentNewsHtml(html, NOW)
    assert.ok(n, "row parsed")
    assert.equal(n.publishedAt, "2026-09-12T00:00:00.000Z")
    // The issued date still also populates startDate as before — unrelated, unchanged behaviour.
       assert.equal(n.startDate, "12 Sep 2026")
})

test("the header row (ISSUED DATE is not a real date) is skipped, not treated as a row", () => {
    const html = tableHtml([])
    const rows = parseEmploymentNewsHtml(html, NOW)
    assert.equal(rows.length, 0)
})

test("the LAST DATE column is never used as publishedAt, even when ISSUED DATE is missing/malformed", () => {
    const row = (cells: string[]) => `<tr>${cells.map(c => `<td>${c}</td>`).join("")}</tr>`
    // ISSUED cell deliberately malformed (single-digit day) so it fails the strict
       // DD/MM/YYYY gate the real adapter already applies before this ever runs.
       const html = `<table>${row(["9/09/2026", "DRDO", "Scientist B", "Direct Recruitment", "30/10/2026"])}</table>`
    const rows = parseEmploymentNewsHtml(html, NOW)
    assert.equal(rows.length, 0, "malformed ISSUED DATE rows are dropped entirely (existing behaviour, unchanged)")
})

test("a calendar-invalid ISSUED DATE (e.g. 31/04) never becomes publishedAt", () => {
    const html = tableHtml([["31/04/2026", "DRDO", "Scientist B", "Direct Recruitment", "30/10/2026"]])
    const [n] = parseEmploymentNewsHtml(html, NOW)
    assert.ok(n)
    assert.equal(n.publishedAt, undefined)
})

test("a pre-2015 / garbage-year ISSUED DATE never becomes publishedAt", () => {
    const html = tableHtml([["12/09/1999", "DRDO", "Scientist B", "Direct Recruitment", "30/10/2026"]])
    const [n] = parseEmploymentNewsHtml(html, NOW)
    assert.ok(n)
    assert.equal(n.publishedAt, undefined)
})

test("a future ISSUED DATE beyond clock skew never becomes publishedAt", () => {
    const html = tableHtml([["01/01/2027", "DRDO", "Scientist B", "Direct Recruitment", "30/10/2026"]])
    const [n] = parseEmploymentNewsHtml(html, NOW)
    assert.ok(n)
    assert.equal(n.publishedAt, undefined)
})

test("multiple genuine rows each get their own correct publishedAt", () => {
    const html = tableHtml([
          ["01/10/2026", "IBPS", "Clerk", "Direct Recruitment", "15/11/2026"],
          ["15/10/2026", "SBI", "PO", "Direct Recruitment", "20/11/2026"],
        ])
    const rows = parseEmploymentNewsHtml(html, NOW)
    assert.equal(rows.length, 2)
    assert.equal(rows[0].publishedAt, "2026-10-01T00:00:00.000Z")
    assert.equal(rows[1].publishedAt, "2026-10-15T00:00:00.000Z")
})

test("rows missing org/post are still rejected (existing quality-control behaviour, unchanged)", () => {
    const html = tableHtml([["12/09/2026", "", "Scientist B", "Direct Recruitment", "30/10/2026"]])
    const rows = parseEmploymentNewsHtml(html, NOW)
    assert.equal(rows.length, 0)
})

/* ── 2026-10-25: markup-drift compatibility (parser robustness, NOT a claim
 * about what actually broke on the live site — no error text was available
 * to confirm that; this only checks tolerance for small HTML shape changes a
 * real redesign could plausibly introduce, and separately pins a REAL,
 * confirmed limitation of the current positional-column parsing). ── */

test("COMPATIBILITY: extra row/cell attributes (class, style) and nested <span>/<b> tags inside cells do not break extraction", () => {
    const html =
          `<table>` +
          `<tr class="hdr"><td>ISSUED DATE</td><td>ORGANISATION</td><td>POST</td><td>METHOD OF APPOINTMENT</td><td>LAST DATE</td></tr>` +
          `<tr class="row odd" style="background:#fff"><td>12/09/2026</td><td><b>DRDO</b></td><td><span>Scientist</span> B</td><td>Direct Recruitment</td><td>30/10/2026</td></tr>` +
          `</table>`
    const [n] = parseEmploymentNewsHtml(html, NOW)
    assert.ok(n, "row still parsed despite extra attributes and nested tags")
    assert.equal(n.org, "DRDO")
    assert.equal(n.post, "Scientist B")
    assert.equal(n.publishedAt, "2026-09-12T00:00:00.000Z")
})

test("COMPATIBILITY: extra whitespace/newlines between cells and tags do not break extraction", () => {
    const html = `<table>\n  <tr>\n    <td> 12/09/2026 </td>\n    <td> DRDO </td>\n    <td> Scientist B </td>\n    <td> Direct Recruitment </td>\n    <td> 30/10/2026 </td>\n  </tr>\n</table>`
    const [n] = parseEmploymentNewsHtml(html, NOW)
    assert.ok(n, "row still parsed despite surrounding whitespace")
    assert.equal(n.org, "DRDO")
})

test("LIMITATION (confirmed, not a claim about the real failures): an inserted leading serial-number column shifts every column and silently drops the row rather than misreading it", () => {
    // Pins TODAY's actual, positional (c[0]/c[1]/c[2]/c[3]) parsing: if the live
    // site ever inserts a leading "S.No." column, c[0] stops being a date, the
    // existing `/^\d{2}\/\d{2}\/\d{4}$/` guard on c[0] correctly rejects it, and
    // the row is dropped entirely (safe — never a wrong-column-mapped entry)
    // but SILENTLY (no error raised) — a real redesign of this shape would
    // show up as "0 rows parsed", not a thrown error, which is worth knowing
    // when diagnosing a future "adapter returns nothing" report.
    const html =
          `<table><tr><td>1</td><td>12/09/2026</td><td>DRDO</td><td>Scientist B</td><td>Direct Recruitment</td><td>30/10/2026</td></tr></table>`
    const rows = parseEmploymentNewsHtml(html, NOW)
    assert.equal(rows.length, 0, "a shifted leading column must be dropped, not silently mis-mapped onto the wrong fields")
})

console.log(`\nemploymentNews date tests: ${passed} passed, ${failed} failed`)
process.exitCode = failed ? 1 : 0
