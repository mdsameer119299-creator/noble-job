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
    drop: /(परिणाम|उत्तर कुंजी|answer key|result|marks|merit|admit|प्रवेश पत्र|syllabus|पाठ्यक्रम)/i,
    enabled: true, maxItems: 25,
  }),
]
