/**
 * govtSeed.ts — the curated, hand-audited government-job seed set (Phase 1A).
 *
 * GUARDRAILS (audited):
 *  - The ONLY source rows are FALLBACK_GOVT_JOBS + the single hand-detailed RRB
 *    NTPC notification re-declared below. GENERATED_GOVT_JOBS (and GOVT_JOBS,
 *    which composes it) are **never imported here**, so no generated/fabricated
 *    row can structurally reach the seed — independent of any future change to
 *    GOVT_JOBS composition.
 *  - SEED_IDS is a frozen allow-list of exactly 20 ids (union-bank excluded as
 *    expired). REAL_GOVT_SEED is built BY mapping over SEED_IDS, so the result
 *    can never contain an id outside the allow-list. Build-time invariants
 *    assert count + set-equality, and a generated-id tripwire guards selection.
 */
import { FALLBACK_GOVT_JOBS } from "./fallbackJobs"
import type { GovtJob } from "@/types/govtJob"

type GovtJobRow = GovtJob & { last_date?: string; age_range?: string }

/**
 * Frozen local copy of govtData's DETAILED_JOBS[0]. Kept here (rather than
 * imported) so the seed module never transitively pulls the generated
 * inventory. If the canonical detailed row changes, update this copy too.
 */
const RRB_NTPC_DETAILED: GovtJobRow = {
  id: "rrb-ntpc-graduate-2026",
  slug: "rrb-ntpc-graduate-level-2026",
  title: "RRB NTPC Graduate Level Recruitment 2026",
  org: "Railway Recruitment Board",
  short: "RRB",
  post: "Station Master, Goods Guard, Sr. Clerk",
  vacancies: "11558",
  qualification: "Graduation in any discipline",
  ageRange: "18-36 Years",
  age_range: "18-36 Years",
  fee: "500",
  lastDate: "30 Jun 2026",
  last_date: "30 Jun 2026",
  startDate: "01 Jun 2026",
  examDate: "Aug 2026",
  salary: "35,400 - 1,12,400/mo",
  location: "All India",
  state: "All India",
  tab: "latest",
  department: "Indian Railways",
  experience: "Fresher",
  color: "#0e7490",
  badge: "Hot",
  status: "active",
  notificationPdf: "https://www.rrbcdg.gov.in/",
  officialUrl: "https://www.rrbcdg.gov.in/",
  vacancyBreakup: [
    { post: "Station Master", total: "1850", eligibility: "Graduate" },
    { post: "Goods Guard", total: "5620", eligibility: "Graduate" },
    { post: "Senior Clerk cum Typist", total: "2200", eligibility: "Graduate + Typing" },
    { post: "Commercial Apprentice", total: "1888", eligibility: "Graduate" },
  ],
}

/** The ONLY ids permitted into production via the seed (20; union-bank excluded). */
export const SEED_IDS = Object.freeze([
  // latest (8)
  "sbi-apprentice-2026", "iaf-afcat-02-2026", "crpf-constable-2026", "bob-credit-officer-2026",
  "ossc-je-2026", "cnp-nashik-2026", "secr-apprentice-2026", "rrb-ntpc-graduate-2026",
  // upcoming (2)
  "upsc-cse-2026", "ssc-cgl-2026",
  // results (4)
  "ibps-po-xiv-result", "ssc-chsl-result-2025", "railway-ntpc-result", "niacl-ao-result",
  // admit (3)
  "ibps-clerk-admit-2025", "ssc-gd-admit-2026", "navy-mr-admit-2026",
  // answer (3)
  "ctet-answer-2025", "ibps-rrb-answer-2025", "ssc-mts-answer-2025",
] as const)

/** Curated source — fallback inventory + the one detailed row. NO generated data. */
const CURATED_SOURCE: GovtJobRow[] = [...FALLBACK_GOVT_JOBS, RRB_NTPC_DETAILED]

/** Tripwire: ids the generator produces. Must never appear in the seed. */
const GENERATED_ID_PATTERN = /^govt-(latest|upcoming|results|admit|answer|state|qual)-/

/** The audited seed rows, selected strictly from the allow-list. */
export const REAL_GOVT_SEED: GovtJobRow[] = SEED_IDS.map(id => {
  const row = CURATED_SOURCE.find(j => j.id === id)
  if (!row) throw new Error(`[govtSeed] allow-listed id missing from curated source: ${id}`)
  if (GENERATED_ID_PATTERN.test(row.id)) throw new Error(`[govtSeed] generated id leaked into seed: ${row.id}`)
  return row
})

// ── Build-time invariants (guardrail 3) ─────────────────────────────────────
if (REAL_GOVT_SEED.length !== SEED_IDS.length) {
  throw new Error(`[govtSeed] expected ${SEED_IDS.length} rows, resolved ${REAL_GOVT_SEED.length}`)
}
{
  const selected = new Set(REAL_GOVT_SEED.map(j => j.id))
  if (selected.size !== SEED_IDS.length) throw new Error("[govtSeed] duplicate ids in seed")
  for (const id of SEED_IDS) {
    if (!selected.has(id)) throw new Error(`[govtSeed] missing seed id: ${id}`)
  }
}
