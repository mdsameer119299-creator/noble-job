/**
 * statePsc.ts — state-level recruitment ingestion (Phase 2).
 *
 * Extends the existing PDF-feed adapter rather than introducing a second
 * pipeline: makeStatePscAdapter wraps makePdfFeedAdapter and stamps the source
 * state + canonical state_slug onto every emitted notification, so state
 * recruitments land under the correct state (the per-state cards and the
 * /admin/govt-jobs coverage report then update automatically). The state_slug
 * is supplied explicitly (authoritative), never guessed from free text.
 *
 * Verification convention (mirrors esic/du/iit-delhi in ./index.ts): every PSC
 * ships `enabled: false` until its list URL is confirmed to serve recruitment
 * PDFs over a plain GET from the DEPLOY HOST. Many PSC portals are JS-rendered
 * or bot-gated and cannot be confirmed clean from CI; flip `enabled: true`
 * one source at a time after a host-side check. Enabling is the only change
 * needed — state tagging and normalisation already work end-to-end.
 */
import type { SourceAdapter, RawNotification } from "../types"
import { makePdfFeedAdapter } from "./pdfFeed"

export interface StatePscConfig {
  /** Stable adapter id, also written as govt_jobs.source_id. */
  id: string
  label: string
  /** Commission display name used in job titles. */
  org: string
  /** Canonical INDIAN_STATES slug — authoritative state tag. */
  stateSlug: string
  /** Canonical INDIAN_STATES label — written to govt_jobs.state. */
  stateName: string
  /** GET-accessible page that lists recruitment PDFs. */
  listUrl: string
  maxPdfs?: number
  /** Default false: registered but unpolled until host-verified. */
  enabled?: boolean
}

/** Build a state-PSC adapter: PDF-feed extraction + authoritative state tagging. */
export function makeStatePscAdapter(cfg: StatePscConfig): SourceAdapter {
  const inner = makePdfFeedAdapter({
    id: cfg.id,
    label: cfg.label,
    org: cfg.org,
    listUrl: cfg.listUrl,
    maxPdfs: cfg.maxPdfs,
    enabled: cfg.enabled ?? false,
  })
  return {
    ...inner,
    async fetch(): Promise<RawNotification[]> {
      const raws = await inner.fetch()
      // Stamp the source state on every notification so it is scoped correctly.
      return raws.map(r => ({
        ...r,
        state: cfg.stateName,
        stateSlug: cfg.stateSlug,
        location: cfg.stateName,
      }))
    },
  }
}

/**
 * State Public Service Commissions. URLs are the official commission portals;
 * all ship disabled pending per-source host verification (see header).
 */
export const STATE_PSC_ADAPTERS: SourceAdapter[] = [
  // ENABLED (batch 2026-06-22): UPPSC, RPSC, MPPSC, BPSC, KPSC, HPSC flipped on
  // per request and confirmed reachable over a plain GET from the run host (see
  // scripts/verify-state-adapters.ts). Re-confirm from the DEPLOY host after
  // ship; if a portal hardens against server fetch, set enabled:false again.
  makeStatePscAdapter({ id: "kpsc",  label: "KPSC (Karnataka)",        org: "Karnataka Public Service Commission",        stateSlug: "karnataka",       stateName: "Karnataka",       listUrl: "https://www.kpsc.kar.nic.in/", enabled: true }),
  // UPPSC is AngularJS (no .pdf anchors) — handled by the dedicated HTML adapter
  // in ./uppsc.ts that parses the Open_PDF.aspx notification list. Keep this
  // PDF-feed entry disabled so the two don't double-run under the same id.
  makeStatePscAdapter({ id: "uppsc-pdf", label: "UPPSC (PDF feed, unused)", org: "Uttar Pradesh Public Service Commission", stateSlug: "uttar-pradesh", stateName: "Uttar Pradesh", listUrl: "https://uppsc.up.nic.in/", enabled: false }),
  makeStatePscAdapter({ id: "bpsc",  label: "BPSC (Bihar)",            org: "Bihar Public Service Commission",            stateSlug: "bihar",           stateName: "Bihar",           listUrl: "https://www.bpsc.bih.nic.in/", enabled: true }),
  makeStatePscAdapter({ id: "mpsc",  label: "MPSC (Maharashtra)",      org: "Maharashtra Public Service Commission",      stateSlug: "maharashtra",     stateName: "Maharashtra",     listUrl: "https://mpsc.gov.in/" }),
  makeStatePscAdapter({ id: "rpsc",  label: "RPSC (Rajasthan)",        org: "Rajasthan Public Service Commission",        stateSlug: "rajasthan",       stateName: "Rajasthan",       listUrl: "https://rpsc.rajasthan.gov.in/", enabled: true }),
  makeStatePscAdapter({ id: "hpsc",  label: "HPSC (Haryana)",          org: "Haryana Public Service Commission",          stateSlug: "haryana",         stateName: "Haryana",         listUrl: "https://hpsc.gov.in/", enabled: true }),
  makeStatePscAdapter({ id: "tspsc", label: "TGPSC/TSPSC (Telangana)", org: "Telangana Public Service Commission",        stateSlug: "telangana",       stateName: "Telangana",       listUrl: "https://www.tspsc.gov.in/" }),
  makeStatePscAdapter({ id: "appsc", label: "APPSC (Andhra Pradesh)",  org: "Andhra Pradesh Public Service Commission",   stateSlug: "andhra-pradesh",  stateName: "Andhra Pradesh",  listUrl: "https://psc.ap.gov.in/" }),
  makeStatePscAdapter({ id: "ukpsc", label: "UKPSC (Uttarakhand)",     org: "Uttarakhand Public Service Commission",      stateSlug: "uttarakhand",     stateName: "Uttarakhand",     listUrl: "https://ukpsc.gov.in/" }),
  makeStatePscAdapter({ id: "hppsc", label: "HPPSC (Himachal Pradesh)",org: "Himachal Pradesh Public Service Commission", stateSlug: "himachal-pradesh",stateName: "Himachal Pradesh",listUrl: "https://www.hppsc.hp.gov.in/hppsc/" }),
  makeStatePscAdapter({ id: "gpsc",  label: "GPSC (Gujarat)",          org: "Gujarat Public Service Commission",          stateSlug: "gujarat",         stateName: "Gujarat",         listUrl: "https://gpsc.gujarat.gov.in/" }),
  makeStatePscAdapter({ id: "mppsc", label: "MPPSC (Madhya Pradesh)",  org: "Madhya Pradesh Public Service Commission",   stateSlug: "madhya-pradesh",  stateName: "Madhya Pradesh",  listUrl: "https://mppsc.mp.gov.in/", enabled: true }),
  makeStatePscAdapter({ id: "wbpsc", label: "WBPSC (West Bengal)",     org: "West Bengal Public Service Commission",      stateSlug: "west-bengal",     stateName: "West Bengal",     listUrl: "https://wbpsc.gov.in/" }),
  // ENABLED: live audit (2026-06-18) confirmed tnpsc.gov.in serves recruitment
  // PDFs over a plain GET and the adapter extracted a genuine notification.
  makeStatePscAdapter({ id: "tnpsc", label: "TNPSC (Tamil Nadu)",      org: "Tamil Nadu Public Service Commission",       stateSlug: "tamil-nadu",      stateName: "Tamil Nadu",      listUrl: "https://www.tnpsc.gov.in/", enabled: true }),
  makeStatePscAdapter({ id: "kerala-psc", label: "Kerala PSC",         org: "Kerala Public Service Commission",           stateSlug: "kerala",          stateName: "Kerala",          listUrl: "https://www.keralapsc.gov.in/" }),
  makeStatePscAdapter({ id: "opsc",  label: "OPSC (Odisha)",           org: "Odisha Public Service Commission",           stateSlug: "odisha",          stateName: "Odisha",          listUrl: "https://www.opsc.gov.in/" }),
]
