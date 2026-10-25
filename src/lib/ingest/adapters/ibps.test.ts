/**
 * ibps.test.ts — regression coverage for the IBPS adapter (issue #46 audit).
 *
 * Real recruitment-drive cards on ibps.in show only "Registration From
 * DD-Mon-YYYY" (an application-window start date, forbidden as a publish-date
 * substitute) — "Posted on DD Mon, YYYY" exists on the same homepage but only
 * on non-recruitment announcement cards (confirmed live 2026-10-24). This pins
 * that `publishedAt` is NEVER derived from "Registration From", so a future
 * change can't accidentally wire a forbidden substitute in. See the
 * limitation note in ibps.ts.
 *
 *   npm run test:ibps-dates
 */
import assert from "node:assert/strict"
import { parseIbpsHtml } from "./ibps"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
    try { fn(); passed++; console.log(`  PASS  ${name}`) }
    catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}

test("a real recruitment-drive card never gets a publishedAt, even though 'Registration From' is a real date", () => {
    const html = `<a href="https://ibpsreg.ibps.in/nabard2026/">NABARD Recruitment of Specialists On Contract 2026-27 Registration From 09-Oct-2026</a>`
    const [n] = parseIbpsHtml(html)
    assert.ok(n, "item parsed")
    assert.equal(n.publishedAt, undefined)
    // startDate still carries the registration-start date as before — unrelated, unchanged behaviour.
       assert.equal(n.startDate, "09 Oct 2026")
})

test("multiple drives are all left without publishedAt", () => {
    const html =
          `<a href="https://ibpsreg.ibps.in/niicl2026/">NIICL Recruitment of 321 Administrative Officers Registration From 08-Oct-2026</a>` +
          `<a href="https://ibpsreg.ibps.in/kucbl2026/">KUCBL Recruitment of Managers and Assistant Managers Registration From 02-Oct-2026</a>`
    const rows = parseIbpsHtml(html)
    assert.equal(rows.length, 2)
    for (const r of rows) assert.equal(r.publishedAt, undefined)
})

test("a non-recruitment card (e.g. a result-status update, even with a genuine 'Posted on' date) is filtered out entirely", () => {
    // Real-world example: links to ibpsreg.ibps.in but the title has no "recruit"
       // word, so the existing KEEP filter already drops it — this just pins that a
       // 'Posted on' date never slips a non-recruitment card past that filter.
       const html = `<a href="https://ibpsreg.ibps.in/crpsplxvi/">CRP-SPL-XVI Posted on 15 Oct, 2026 Result Status of Online Preliminary Examination for CRP-SPL-XVI</a>`
    const rows = parseIbpsHtml(html)
    assert.equal(rows.length, 0)
})

console.log(`\nibps date tests: ${passed} passed, ${failed} failed`)
process.exitCode = failed ? 1 : 0
