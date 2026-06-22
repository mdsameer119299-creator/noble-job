/**
 * Source adapters — one per government source, added incrementally.
 *
 * Each adapter is a self-contained plug-in: implement `fetch()` to return
 * RawNotification[] and flip `enabled` to true. Until then it ships disabled
 * and contributes nothing to a run (so the framework is safe to schedule now).
 *
 * `kind` documents the integration strategy for that source:
 *   rss | html | pdf | json_api | spa_blocked | manual
 */
import type { SourceAdapter, RawNotification } from "../types"
import { employmentNewsAdapter } from "./employmentNews"
import { ibpsAdapter } from "./ibps"
import { makePdfFeedAdapter } from "./pdfFeed"
import { STATE_PSC_ADAPTERS } from "./statePsc"
import { STATE_SECTOR_ADAPTERS } from "./stateSectors"

// Official orgs that publish recruitment PDFs on a GET page (verified accessible).
export const drdoRacAdapter = makePdfFeedAdapter({ id: "drdo-rac", label: "DRDO RAC", org: "DRDO (Recruitment & Assessment Centre)", listUrl: "https://rac.gov.in/", maxPdfs: 10 })
export const aaiAdapter     = makePdfFeedAdapter({ id: "aai", label: "Airports Authority of India", org: "Airports Authority of India (AAI)", listUrl: "https://www.aai.aero/en/careers/recruitment", maxPdfs: 6 })
export const jnuAdapter     = makePdfFeedAdapter({ id: "jnu", label: "JNU", org: "Jawaharlal Nehru University (JNU)", listUrl: "https://www.jnu.ac.in/career", maxPdfs: 12 })
// Delhi High Court publishes current advertisements as PDFs on its homepage announcements
// block (verified: serves genuine recruitment ads via plain GET; non-ad "public notices" are
// rejected by the strict classifier in ../pdf.ts).
export const delhiHcAdapter = makePdfFeedAdapter({ id: "delhi-hc", label: "Delhi High Court", org: "Delhi High Court", listUrl: "https://delhihighcourt.nic.in/", maxPdfs: 10 })

// ── Priority sources pending runtime verification ──────────────────────────────
// Registered so they ingest by flipping `enabled` once verified from the deploy host;
// kept disabled because they cannot be confirmed clean from the build/CI environment.
// ESIC: endpoint rejects Node fetch (TLS handshake fails) from CI and this runtime.
export const esicAdapter    = makePdfFeedAdapter({ id: "esic", label: "ESIC", org: "ESIC", listUrl: "https://www.esic.gov.in/recruitments", maxPdfs: 10, enabled: false })
// Delhi University: "Work With DU" page is reachable but mixes results/old advts; needs a
// dedicated current-vacancy URL before enabling to avoid stale/low-quality rows.
export const duAdapter      = makePdfFeedAdapter({ id: "delhi-univ", label: "University of Delhi", org: "University of Delhi", listUrl: "https://www.du.ac.in/index.php?page=work-with-du", maxPdfs: 12, enabled: false })
// IIT Delhi: homepage exposes recruitment PDFs but fetches are intermittent (timeouts);
// the dedicated career page does not server-render tagged PDF links.
export const iitDelhiAdapter = makePdfFeedAdapter({ id: "iit-delhi", label: "IIT Delhi", org: "IIT Delhi", listUrl: "https://home.iitd.ac.in/", maxPdfs: 8, enabled: false })

/** Helper to declare a not-yet-implemented adapter without repetition. */
function stub(id: string, label: string, kind: SourceAdapter["kind"]): SourceAdapter {
  return {
    id,
    label,
    kind,
    enabled: false, // TODO: implement fetch() then enable
    async fetch(): Promise<RawNotification[]> {
      return []
    },
  }
}

// Priority order (per spec). LIVE: Employment News, IBPS. Others blocked/deferred (see notes).
export { employmentNewsAdapter, ibpsAdapter }
export const upscAdapter           = stub("upsc", "UPSC", "spa_blocked")                               // whats-new is an Angular SPA (no server-rendered list)
export const sbiAdapter            = stub("sbi", "SBI Careers", "spa_blocked")                         // current-openings list is JS-rendered (0 HTML rows)
export const rbiAdapter            = stub("rbi", "RBI", "html")                                        // Opportunities.aspx returns an error page; needs alt path
export const rrbAdapter            = stub("rrb", "Railway RRB (zonal)", "html")                        // no central list — ~21 zonal sites + PDF
export const sscAdapter            = stub("ssc", "SSC", "spa_blocked")                                 // JSON API gated to in-browser SPA (server fetch 500s)
// State PSCs are now real per-state adapters (./statePsc) instead of one manual
// stub: each tags its state authoritatively so coverage lands correctly. They
// ship disabled pending per-source host verification — see statePsc.ts header.

export const ALL_ADAPTERS: SourceAdapter[] = [
  employmentNewsAdapter,
  ibpsAdapter,
  drdoRacAdapter,
  aaiAdapter,
  jnuAdapter,
  delhiHcAdapter,
  esicAdapter,
  duAdapter,
  iitDelhiAdapter,
  upscAdapter,
  sbiAdapter,
  rbiAdapter,
  rrbAdapter,
  sscAdapter,
  ...STATE_PSC_ADAPTERS,
  // State Police / University / Health recruiters (ship disabled — see header
  // of ./stateSectors.ts; verify each from the deploy host before enabling).
  ...STATE_SECTOR_ADAPTERS,
]
