/**
 * stateListSources.test.ts — REGRESSION for UKSSSC's custom `drop` override
 * missing the Hindi mid-process terms added to htmlList.ts's DEFAULT_DROP.
 *
 * `makeHtmlListAdapter`'s `drop: cfg.drop ?? DEFAULT_DROP` means a source with
 * its OWN `drop` regex (uksssc, gpsc) never inherits DEFAULT_DROP's terms —
 * the two never merge. So when DEFAULT_DROP gained Hindi interview/rejection/
 * revised/postponement/exam-conduct terms (2026-10-25 audit), UKSSSC's
 * hand-rolled `drop` silently kept the old, narrower list.
 *
 * Confirmed LIVE (2026-10-25, via WebFetch against https://sssc.uk.gov.in/,
 * not a synthetic fixture): a real exam-postponement notice
 * ("...लिखित परीक्षा के स्थगन से सम्बन्ध में विज्ञप्ति") and a real
 * interview-schedule notice ("...पद के साक्षात्कार(Interview)की तिथि...")
 * both passed the OLD uksssc drop regex uncaught (`parseHtmlList` kept them).
 * Neither produced a date under current extraction (no "दिनांक" marker in
 * either title), so this was not yet causing a visible freshness-gate leak —
 * but it is a real, confirmed gap, closed here for defense-in-depth before
 * UKSSSC's date-extraction path is ever fixed.
 *
 * Also loosens "उत्तर कुंजी" (spaced) to "उत्तर\s*कुंजी" — live titles render
 * it unspaced ("उत्तरकुंजी"); one live sample was only caught by its English
 * "(Answer Keys)" parenthetical, which will not always be present.
 *
 *   npx tsx src/lib/ingest/adapters/stateListSources.test.ts
 */
import assert from "node:assert/strict"
import { parseHtmlList, type HtmlListConfig } from "./htmlList"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}

// Mirrors the real uksssc entry in stateListSources.ts exactly (post-fix).
const UKSSSC_CFG: HtmlListConfig = {
  id: "uksssc", label: "UKSSSC (Uttarakhand)", org: "Uttarakhand Subordinate Service Selection Commission",
  stateSlug: "uttarakhand", stateName: "Uttarakhand",
  listUrl: "https://sssc.uk.gov.in/",
  keep: /(भर्ती|विज्ञापन|पद|पदनाम|recruit|advert|vacan|post)/i,
  drop: /(परिणाम|उत्तर\s*कुंजी|answer key|result|marks|merit|admit|प्रवेश पत्र|syllabus|पाठ्यक्रम|साक्षात्कार|निरस्त|आपत्ति|संशोधित|स्थगन|आयोजन संबंधी सूचना|प्रेस विज्ञप्ति)/i,
  enabled: true, maxItems: 25,
}

const anchor = (href: string, inner: string) => `<a href="${href}">${inner}</a>`

test("REGRESSION (live-confirmed) — a real UKSSSC exam-postponement notice is dropped", () => {
  const html = anchor(
    "https://cdnbbsr.s3waas.gov.in/uksssc/202610182051341189.pdf",
    "पदनाम-कनिष्ठ सहायक/आशुलिपिक(वैयत्तिक सहायक-Advt-78) व सहायक लेखाकार(Advt-79) की लिखित परीक्षा के स्थगन से सम्बन्ध में विज्ञप्ति",
  )
  const out = parseHtmlList(html, UKSSSC_CFG)
  assert.equal(out.length, 0, `expected the exam-postponement notice to be dropped, got: ${JSON.stringify(out)}`)
})

test("REGRESSION (live-confirmed) — a real UKSSSC interview-schedule notice is dropped", () => {
  const html = anchor(
    "https://cdnbbsr.s3waas.gov.in/uksssc/202610071436773481.pdf",
    "उत्तराखण्ड अधीनस्थ सेवा चयन आयोग के अंतर्गत सेवा स्थानांतरण के माध्यम से उपसचिव पद के साक्षात्कार(Interview)की तिथि हेतु क्लिक करें",
  )
  const out = parseHtmlList(html, UKSSSC_CFG)
  assert.equal(out.length, 0, `expected the interview-schedule notice to be dropped, got: ${JSON.stringify(out)}`)
})

test("sanity (live-confirmed) — a real genuinely-new UKSSSC recruitment advertisement is still kept", () => {
  const html = anchor(
    "https://cdnbbsr.s3waas.gov.in/uksssc/202609151072597881.pdf",
    "पदनाम-स्केलर(वन विकास निगम) के पदों की सीधी भर्ती के विज्ञापन हेतु क्लिक करें New",
  )
  const out = parseHtmlList(html, UKSSSC_CFG)
  assert.equal(out.length, 1, `expected the genuine new recruitment ad to be kept, got: ${JSON.stringify(out)}`)
})

test("REGRESSION — unspaced 'उत्तरकुंजी' (no English parenthetical to save it) is now dropped", () => {
  const html = anchor(
    "https://cdnbbsr.s3waas.gov.in/uksssc/x.pdf",
    "पदनाम-चारा सहायक की भर्ती उत्तरकुंजी हेतु क्लिक करें",
  )
  const out = parseHtmlList(html, UKSSSC_CFG)
  assert.equal(out.length, 0, `expected the unspaced answer-key notice to be dropped, got: ${JSON.stringify(out)}`)
})

test("REGRESSION — admit-card notices still dropped (pre-existing behaviour unchanged)", () => {
  const html = anchor(
    "https://cdnbbsr.s3waas.gov.in/uksssc/x.pdf",
    "पदनाम-लाईनमैन व मनोवैज्ञानिक व प्रशिक्षक /अनुदेशक(ADV 74 ) पदों के प्रवेश पत्र(ADMIT CARD) की विज्ञप्ति हेतु क्लिक करें",
  )
  const out = parseHtmlList(html, UKSSSC_CFG)
  assert.equal(out.length, 0, `expected the admit-card notice to be dropped, got: ${JSON.stringify(out)}`)
})

console.log(`\nstateListSources (UKSSSC drop-filter) tests: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
