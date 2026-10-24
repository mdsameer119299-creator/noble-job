/**
 * uppsc.test.ts — regression coverage for the UPPSC adapter (issue #46 audit).
 *
 * UPPSC's homepage list shows only a "Visible upto : DD/MM/YYYY" field next to
 * each item (confirmed live 2026-10-24) — a listing-visibility/expiry date,
 * not a source-stated publication date. This pins that `publishedAt` is NEVER
 * derived from it (or from anything else on this page), so a future change
 * can't accidentally wire a forbidden substitute in. See the limitation note
 * in uppsc.ts.
 *
 *   npm run test:uppsc-dates
 */
import assert from "node:assert/strict"
import { parseUppscHtml } from "./uppsc"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
    try { fn(); passed++; console.log(`  PASS  ${name}`) }
    catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}

/** Mirrors the real homepage list-item structure (as seen live 2026-10-24). */
function listItemHtml(label: string, visibleUpto: string, token = "token123"): string {
    return (
          `<li><a href=Open_PDF.aspx?${token} target=_Blank>` +
          `<span class='lbl_css'>${label}</span>` +
          `</a> Visible upto : ${visibleUpto}</li>`
        )
}

test("a genuine recruitment notice never gets a publishedAt, even though a date is shown next to it", () => {
    const html = listItemHtml("NOTICE REGARDING ADVT. NO. A-8/E-1/2025, ASSISTANT PROSECUTION OFFICER (MAINS) EXAM-2025", "06/11/2026")
    const [n] = parseUppscHtml(html)
    assert.ok(n, "item parsed")
    assert.equal(n.publishedAt, undefined)
    assert.equal(n.org, "Uttar Pradesh Public Service Commission")
})

test("the 'Visible upto' date is never read into publishedAt even for several items", () => {
    const html =
          listItemHtml("ADVERTISEMENT NO. A-9/E-1/2026 DIRECT RECRUITMENT NOTIFICATION", "10/12/2026", "tokA") +
          listItemHtml("NOTICE REGARDING ADVT. NO. A-10/E-1/2026 RECRUITMENT VACANCY", "20/12/2026", "tokB")
    const rows = parseUppscHtml(html)
    assert.ok(rows.length >= 1)
    for (const r of rows) assert.equal(r.publishedAt, undefined)
})

test("results/admit-card items are still dropped (existing KEEP/DROP behaviour, unchanged)", () => {
    const html = listItemHtml("RESULT OF WRITTEN EXAMINATION FOR ADVT. NO. A-5/E-1/2025", "06/11/2026")
    const rows = parseUppscHtml(html)
    assert.equal(rows.length, 0)
})

console.log(`\nuppsc date tests: ${passed} passed, ${failed} failed`)
process.exitCode = failed ? 1 : 0
