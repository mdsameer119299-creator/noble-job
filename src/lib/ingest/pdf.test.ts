/**
 * pdf.test.ts — regression coverage for the PDF-pipeline helpers in pdf.ts,
 * in particular extractAdvertisementDate (issue #46: the shared PDF-feed
 * adapter — used by DRDO, AAI, JNU, Delhi HC and every enabled state-PSC
 * source via makeStatePscAdapter — never populated RawNotification.publishedAt
 * at all; this is what makes it do so, ONLY from a genuine source-stated
 * "Dated"/"दिनांक" marker in the document's own header).
 *
 *   npm run test:pdf-dates
 */
import assert from "node:assert/strict"
import { extractAdvertisementDate, isRecruitmentPdf, parseRecruitmentFields } from "./pdf"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
    try { fn(); passed++; console.log(`  PASS  ${name}`) }
    catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}

const NOW = new Date("2026-10-24T00:00:00.000Z")

/** A representative Indian-government recruitment-advertisement letterhead + body. */
function sampleAdvertisement(opts: { issueDated?: string; lastDate?: string; preambleFiller?: string } = {}): string {
    const header =
          `DEFENCE RESEARCH AND DEVELOPMENT ORGANISATION\n` +
          `Recruitment & Assessment Centre, Delhi\n` +
          `No. RAC/2026/07${opts.issueDated ? ` Dated: ${opts.issueDated}` : ""}\n\n` +
          `ADVERTISEMENT NO. 07/2026\n\n`
    const filler = opts.preambleFiller ?? ""
    const body =
          `Applications are invited from eligible Indian citizens for the following posts of Scientist 'B' ` +
          `in various disciplines. Candidates must possess a first-class degree in the relevant discipline. ` +
          `The number of vacancies is 42 (forty-two), subject to change. Age limit: 21 to 28 years as on the ` +
          `date of advertisement. Upper age relaxation is admissible as per Government of India rules for ` +
          `reserved categories. Qualification: B.E./B.Tech in the relevant engineering discipline from a ` +
          `recognised university, or equivalent. ` +
          (opts.lastDate ? `Last Date for receipt of online applications is ${opts.lastDate}. ` : "") +
          `No application will be entertained after the deadline under any circumstances whatsoever.`
    return header + filler + body
}

test("extracts the header-zone 'Dated' issue date from a real advertisement layout", () => {
    const text = sampleAdvertisement({ issueDated: "10/03/2026", lastDate: "30/04/2026" })
    assert.equal(extractAdvertisementDate(text, NOW), "2026-03-10T00:00:00.000Z")
})

test("the later 'Last Date' deadline is never returned, even though it appears in the same document", () => {
    const text = sampleAdvertisement({ issueDated: "10/03/2026", lastDate: "30/04/2026" })
    const got = extractAdvertisementDate(text, NOW)
    assert.notEqual(got, "2026-04-30T00:00:00.000Z")
})

test("no header 'Dated' marker at all → undefined, never falls back to the closing date", () => {
    const text = sampleAdvertisement({ lastDate: "30/04/2026" })
    assert.equal(extractAdvertisementDate(text, NOW), undefined)
})

test("a 'Dated' marker that only appears PAST the header window is not matched (window restriction)", () => {
    // Push the genuine marker past the 1000-char header zone with harmless filler,
       // simulating a long preamble/address block — it must not be found this far in.
       const filler = "X".repeat(1200) + " "
    const text = sampleAdvertisement({ preambleFiller: filler }) + " Dated: 10/03/2026"
    assert.equal(extractAdvertisementDate(text, NOW), undefined)
})

test("Hindi 'दिनांक' header marker is extracted from a PDF header the same way", () => {
    const text = `केंद्रीय कार्यालय\nसंख्या 45/2026 दिनांक 07/07/2026\n\nभर्ती विज्ञापन\n\nआवेदन आमंत्रित हैं। अंतिम दिनांक 30/08/2026.`
    assert.equal(extractAdvertisementDate(text, NOW), "2026-07-07T00:00:00.000Z")
})

test("empty/undefined text never throws", () => {
    assert.equal(extractAdvertisementDate("", NOW), undefined)
    // @ts-expect-error — defensive runtime check for a caller that skips the type system
       assert.equal(extractAdvertisementDate(undefined, NOW), undefined)
})

// ── existing pure helpers (unchanged by this issue, pinned for regression safety) ──
test("isRecruitmentPdf / parseRecruitmentFields still behave as before on the sample advertisement", () => {
    const text = sampleAdvertisement({ issueDated: "10/03/2026", lastDate: "30/04/2026" })
    assert.equal(isRecruitmentPdf(text), true)
    const fields = parseRecruitmentFields(text)
    assert.equal(fields.lastDate, "30 Apr 2026")
})

console.log(`\npdf.ts date-extraction tests: ${passed} passed, ${failed} failed`)
process.exitCode = failed ? 1 : 0
