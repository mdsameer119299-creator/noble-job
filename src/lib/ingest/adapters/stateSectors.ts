/**
 * stateSectors.ts — state-level recruiters beyond the PSCs: Police Recruitment
 * Boards, State Universities, and State Health/Medical Services boards.
 *
 * Each reuses makeStatePscAdapter (PDF-feed extraction + authoritative state
 * tagging) so every notification lands under the correct state_slug and feeds
 * the per-state cards + coverage report automatically.
 *
 * SHIP DISABLED. Verification reality (see scripts/verify-state-adapters.ts):
 * many state portals are JS-rendered SPAs whose recruitment lists are NOT in the
 * server HTML, so the plain GET + PDF-anchor strategy yields nothing from ANY
 * host. Before flipping `enabled:true`, confirm from the DEPLOY HOST that the
 * list URL serves real <a href="*.pdf"> recruitment links over a plain GET;
 * portals that don't will need a per-source HTML/JSON parser instead. Enable one
 * at a time and watch /admin/govt-jobs coverage + ingest health.
 */
import type { SourceAdapter } from "../types"
import { makeStatePscAdapter } from "./statePsc"

/** State Police / Uniformed-services recruitment boards. */
export const STATE_POLICE_ADAPTERS: SourceAdapter[] = [
  // UP Police now has a working title-trusting list adapter in ./stateListSources.ts
  // (enabled). Not duplicated here to avoid an id collision in the registry.
  makeStatePscAdapter({ id: "raj-police",  label: "Rajasthan Police",            org: "Rajasthan Police",                              stateSlug: "rajasthan",     stateName: "Rajasthan",     listUrl: "https://police.rajasthan.gov.in/" }),
  makeStatePscAdapter({ id: "mh-police",   label: "Maharashtra Police",          org: "Maharashtra Police",                            stateSlug: "maharashtra",   stateName: "Maharashtra",   listUrl: "https://mahapolice.gov.in/" }),
  makeStatePscAdapter({ id: "bihar-csbc",  label: "Bihar Police (CSBC)",         org: "Central Selection Board of Constable, Bihar",   stateSlug: "bihar",         stateName: "Bihar",         listUrl: "https://csbc.bih.nic.in/" }),
  makeStatePscAdapter({ id: "tnusrb",      label: "TN Police (TNUSRB)",          org: "Tamil Nadu Uniformed Services Recruitment Board", stateSlug: "tamil-nadu",  stateName: "Tamil Nadu",    listUrl: "https://www.tnusrbonline.org/" }),
  makeStatePscAdapter({ id: "hr-police",   label: "Haryana Police",              org: "Haryana Police",                                stateSlug: "haryana",       stateName: "Haryana",       listUrl: "https://www.haryanapoliceonline.gov.in/" }),
]

/** State Universities (teaching + non-teaching recruitment PDFs). */
export const STATE_UNIVERSITY_ADAPTERS: SourceAdapter[] = [
  makeStatePscAdapter({ id: "uni-lucknow",  label: "University of Lucknow",  org: "University of Lucknow",  stateSlug: "uttar-pradesh", stateName: "Uttar Pradesh", listUrl: "https://www.lkouniv.ac.in/en/page/recruitment" }),
  makeStatePscAdapter({ id: "uni-mumbai",   label: "University of Mumbai",   org: "University of Mumbai",   stateSlug: "maharashtra",   stateName: "Maharashtra",   listUrl: "https://mu.ac.in/recruitment" }),
  makeStatePscAdapter({ id: "uni-calcutta", label: "University of Calcutta", org: "University of Calcutta", stateSlug: "west-bengal",   stateName: "West Bengal",   listUrl: "https://www.caluniv.ac.in/" }),
  makeStatePscAdapter({ id: "uni-rajasthan",label: "University of Rajasthan",org: "University of Rajasthan",stateSlug: "rajasthan",     stateName: "Rajasthan",     listUrl: "https://www.uniraj.ac.in/" }),
  makeStatePscAdapter({ id: "uni-madras",   label: "University of Madras",   org: "University of Madras",   stateSlug: "tamil-nadu",    stateName: "Tamil Nadu",    listUrl: "https://www.unom.ac.in/" }),
]

/** State Health / Medical-services recruitment boards. */
export const STATE_HEALTH_ADAPTERS: SourceAdapter[] = [
  makeStatePscAdapter({ id: "wbhrb",     label: "WB Health (WBHRB)",     org: "West Bengal Health Recruitment Board", stateSlug: "west-bengal", stateName: "West Bengal", listUrl: "https://www.wbhrb.in/" }),
  makeStatePscAdapter({ id: "tn-mrb",    label: "TN Health (MRB)",       org: "TN Medical Services Recruitment Board", stateSlug: "tamil-nadu",  stateName: "Tamil Nadu",  listUrl: "https://www.mrb.tn.gov.in/" }),
  makeStatePscAdapter({ id: "nhm-up",    label: "NHM Uttar Pradesh",     org: "National Health Mission, Uttar Pradesh", stateSlug: "uttar-pradesh", stateName: "Uttar Pradesh", listUrl: "https://www.upnrhm.gov.in/" }),
  makeStatePscAdapter({ id: "nhm-mh",    label: "NHM Maharashtra",       org: "National Health Mission, Maharashtra",   stateSlug: "maharashtra",   stateName: "Maharashtra",   listUrl: "https://arogya.maharashtra.gov.in/" }),
  makeStatePscAdapter({ id: "raj-health",label: "Rajasthan Health (DMHS)",org: "Directorate of Medical & Health Services, Rajasthan", stateSlug: "rajasthan", stateName: "Rajasthan", listUrl: "https://rajswasthya.nic.in/" }),
]

/** All non-PSC state-sector adapters (police + university + health). */
export const STATE_SECTOR_ADAPTERS: SourceAdapter[] = [
  ...STATE_POLICE_ADAPTERS,
  ...STATE_UNIVERSITY_ADAPTERS,
  ...STATE_HEALTH_ADAPTERS,
]
