/**
 * provenance.ts — the single source of truth for job *provenance* and the
 * central publication quality gate.
 *
 * Provenance is ORTHOGONAL to openness (`jobStatus` LIVE/VERIFIED/ARCHIVED).
 * Openness answers "is this role currently open?"; provenance answers "is this a
 * real, sourced opportunity, or demo/showcase content?".
 *
 *   GENUINE  → EMPLOYER  (posted by a verified employer via the DB)
 *              AGGREGATED (pulled from a real external API — e.g. Himalayas)
 *              CURATED    (a real opening entered by an admin with a real source)
 *              OFFICIAL   (a government notification from ingestion)
 *   SYNTHETIC → generated demo/showcase inventory. Populates the site so pages
 *              feel full, but must NEVER be represented as a genuine, verified,
 *              indexable, schema-bearing, countable, or distributable opportunity.
 *
 * Every trust surface (sitemap, JobPosting JSON-LD, "verified" badges, public
 * counters, and outbound distribution) routes its decision through the
 * predicates below so synthetic content can never leak through as genuine.
 */

export type Provenance = "EMPLOYER" | "AGGREGATED" | "CURATED" | "OFFICIAL" | "SYNTHETIC"

/** Every provenance that represents a real opportunity (i.e. not demo content). */
export const GENUINE_PROVENANCE: ReadonlySet<Provenance> = new Set<Provenance>([
  "EMPLOYER",
  "AGGREGATED",
  "CURATED",
  "OFFICIAL",
])

const ALL_PROVENANCE: ReadonlySet<string> = new Set<string>([...GENUINE_PROVENANCE, "SYNTHETIC"])

/**
 * Loose shape accepted from any board (Job / WfhJob / AbroadJob / GovtJob or a
 * raw Supabase row). Only the fields the classifier reads are declared.
 */
export interface Classifiable {
  id?: string | null
  provenance?: Provenance | string | null
  source?: string | null
  board?: string | null
  jobStatus?: string | null
  /** snake_case alias from raw Supabase rows. */
  job_status?: string | null
  applyUrl?: string | null
  apply_url?: string | null
  employer_id?: string | null
  officialUrl?: string | null
  official_url?: string | null
  verified?: boolean | null
}

// Generated demo inventory ids look like `live-priv-1`, `ver-wfh-7`,
// `arch-abroad-uae-3` (see src/lib/data/jobInventory.ts).
const SYNTHETIC_ID_PREFIX = /^(live|ver|arch)-(priv|wfh|abroad)\b/i
// Free-text `source` values only the generated inventory uses.
const SYNTHETIC_SOURCES = new Set(["archived inventory", "live feed"])

function applyUrlOf(j: Classifiable): string {
  return (j.applyUrl ?? j.apply_url ?? "").toString().trim()
}

/**
 * True when an apply URL points to a real external application destination.
 * A missing URL, a bare "#", or any example.* placeholder is not real.
 */
export function hasRealApplyUrl(url?: string | null): boolean {
  const u = (url ?? "").trim()
  if (!u || u === "#") return false
  if (/(^|\/\/|\.)example\.(com|org|net)\b/i.test(u)) return false
  return /^https?:\/\//i.test(u)
}

/**
 * Resolve provenance for any job-like object. An explicit, valid `provenance`
 * wins (so honestly-stamped rows are authoritative); otherwise infer defensively
 * so legacy / unstamped rows are still classified correctly.
 */
export function classifyProvenance(j: Classifiable): Provenance {
  const explicit = typeof j.provenance === "string" ? j.provenance.toUpperCase() : ""
  if (ALL_PROVENANCE.has(explicit)) return explicit as Provenance

  const id = (j.id ?? "").toString()
  const source = (j.source ?? "").toString().trim().toLowerCase()
  const url = applyUrlOf(j)

  // ── Clearly generated demo inventory ──────────────────────────────────
  if (SYNTHETIC_ID_PREFIX.test(id)) return "SYNTHETIC"
  if (SYNTHETIC_SOURCES.has(source)) return "SYNTHETIC"
  // A placeholder/example apply URL is never a genuine opening.
  if (url && !hasRealApplyUrl(url)) return "SYNTHETIC"

  // ── Genuine sources ───────────────────────────────────────────────────
  if (j.board === "govt" || j.officialUrl || j.official_url) return "OFFICIAL"
  if (source.includes("himalayas")) return "AGGREGATED"
  if (j.employer_id) return "EMPLOYER"
  return "CURATED"
}

/** True when the row represents a real, sourced opportunity (not demo content). */
export function isGenuine(j: Classifiable): boolean {
  const p = classifyProvenance(j)
  if (!GENUINE_PROVENANCE.has(p)) return false
  // Government notifications carry an official notification URL, not an apply URL.
  if (p === "OFFICIAL") return Boolean(j.officialUrl || j.official_url || j.board === "govt")
  // Verified employer postings use the on-site internal application flow, so an
  // external apply URL is optional for them.
  if (p === "EMPLOYER") return true
  // Aggregated (external API) and curated rows must lead to a real application.
  return hasRealApplyUrl(applyUrlOf(j))
}

/** Openness axis: an ARCHIVED role is not an open position. */
export function isOpen(j: Classifiable): boolean {
  return (j.jobStatus ?? j.job_status) !== "ARCHIVED_JOB"
}

/**
 * THE central publication gate. May this row be presented to the outside world
 * as a real, currently-open opportunity — indexed, schema'd, and distributed?
 */
export function isPublishableAsOpen(j: Classifiable): boolean {
  return isGenuine(j) && isOpen(j)
}

/** A row may appear in the sitemap only when it is a genuine open role. */
export const isIndexable = isPublishableAsOpen
/** A row may carry JobPosting JSON-LD only when it is a genuine open role. */
export const isSchemaEligible = isPublishableAsOpen
/** A row may be emitted to third parties / feeds only when genuine + open. */
export const isDistributable = isPublishableAsOpen

/** Countable as a genuine opportunity (open or filled, but real — never demo). */
export function isCountableAsGenuine(j: Classifiable): boolean {
  return isGenuine(j)
}

/**
 * May we present a "Verified" trust badge? Never for synthetic content, even
 * when its legacy `jobStatus` is VERIFIED_JOB or a stale `verified` flag is set.
 */
export function hasVerifiedTrust(j: Classifiable): boolean {
  if (!isGenuine(j)) return false
  return j.jobStatus === "VERIFIED_JOB" || j.verified === true
}
