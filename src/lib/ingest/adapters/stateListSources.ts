/**
 * stateListSources.ts — state recruiters whose notice list is server-rendered
 * HTML (title-trusting parse via makeHtmlListAdapter, no PDF download).
 *
 * Verified server-rendered (2026-06-22, curl + grep):
 *   MPPSC   — /uploads/advertisement/*.pdf with English title attrs
 *   HPSC    — /Portals/0/*.pdf with descriptive anchor text
 *   KPSC    — *.pdf with descriptive (Kannada/English) names; needs curl path
 *             in fetchHtml (Node llhttp rejects KPSC headers — handled there)
 *   UP Police (uppbpb) — /FilesUploaded/Notice/*.pdf (titles from filename)
 *
 * SPA/blocked portals (RPSC, BPSC, Bihar CSBC, WBHRB) are NOT here — they need
 * the Playwright adapter / non-Vercel egress.
 */
import type { SourceAdapter } from "../types"
import { makeHtmlListAdapter } from "./htmlList"

export const STATE_LIST_ADAPTERS: SourceAdapter[] = [
  makeHtmlListAdapter({
    id: "mppsc", label: "MPPSC (Madhya Pradesh)", org: "Madhya Pradesh Public Service Commission",
    stateSlug: "madhya-pradesh", stateName: "Madhya Pradesh",
    listUrl: "https://mppsc.mp.gov.in/", hrefIncludes: "advertisement", enabled: true, maxItems: 30,
  }),
  makeHtmlListAdapter({
    id: "hpsc", label: "HPSC (Haryana)", org: "Haryana Public Service Commission",
    stateSlug: "haryana", stateName: "Haryana",
    listUrl: "https://hpsc.gov.in/", enabled: true, maxItems: 30,
  }),
  makeHtmlListAdapter({
    id: "kpsc", label: "KPSC (Karnataka)", org: "Karnataka Public Service Commission",
    stateSlug: "karnataka", stateName: "Karnataka",
    listUrl: "https://www.kpsc.kar.nic.in/", titleFromHref: true, enabled: true, maxItems: 30,
  }),
  makeHtmlListAdapter({
    id: "up-police", label: "UP Police (UPPRPB)", org: "UP Police Recruitment & Promotion Board",
    stateSlug: "uttar-pradesh", stateName: "Uttar Pradesh",
    listUrl: "https://uppbpb.gov.in/", titleFromHref: true, enabled: true, maxItems: 20,
  }),
  makeHtmlListAdapter({
    id: "gpsc", label: "GPSC (Gujarat)", org: "Gujarat Public Service Commission",
    stateSlug: "gujarat", stateName: "Gujarat",
    listUrl: "https://gpsc.gujarat.gov.in/",
    // Real ads live under /Documents/AdvertismentDocument/ (their spelling).
    hrefIncludes: "AdvertismentDocument",
    drop: /\b(result|answer key|marks|merit|interview|admit|cut[- ]?off|syllabus|form|format|faq|scribe|reservation|sample|instruction|notice)\b/i,
    enabled: true, maxItems: 30,
  }),
  makeHtmlListAdapter({
    id: "uksssc", label: "UKSSSC (Uttarakhand)", org: "Uttarakhand Subordinate Service Selection Commission",
    stateSlug: "uttarakhand", stateName: "Uttarakhand",
    listUrl: "https://sssc.uk.gov.in/",
    // Titles are Hindi — match Devanagari recruitment terms + English fallbacks.
    keep: /(भर्ती|विज्ञापन|पद|पदनाम|recruit|advert|vacan|post)/i,
    // This custom `drop` fully replaces htmlList.ts's DEFAULT_DROP (cfg.drop ??
    // DEFAULT_DROP never merges the two), so the Hindi mid-process terms added
    // to DEFAULT_DROP (2026-10-25, interview/rejection/revised/postponement/
    // exam-conduct notices) never applied here — confirmed live (2026-10-25):
    // a real UKSSSC exam-postponement notice ("...लिखित परीक्षा के स्थगन से
    // सम्बन्ध में विज्ञप्ति") and a real interview-schedule notice ("...पद के
    // साक्षात्कार(Interview)की तिथि...") both passed this filter uncaught.
    // Mirroring the same terms here for defense-in-depth. Also loosened
    // "उत्तर कुंजी" to "उत्तर\s*कुंजी" — live titles render it unspaced
    // ("उत्तरकुंजी"), which the literal spaced string would miss.
    // NOTE (verified live, 2026-10-25): none of UKSSSC's current anchor titles
    // carry a "दिनांक" stated-date marker at all, so today this change closes
    // a dormant gap rather than changing any currently-visible listing — see
    // htmlList.test.ts's UKSSSC-shaped case and the session's audit notes.
    drop: /(परिणाम|उत्तर\s*कुंजी|answer key|result|marks|merit|admit|प्रवेश पत्र|syllabus|पाठ्यक्रम|साक्षात्कार|निरस्त|आपत्ति|संशोधित|स्थगन|आयोजन संबंधी सूचना|प्रेस विज्ञप्ति)/i,
    enabled: true, maxItems: 25,
  }),
]
