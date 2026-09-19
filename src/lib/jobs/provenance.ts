/**
 * provenance.ts — the single source of truth for job *provenance* and the
 * central publication quality gate.
 *
 * Provenance is ORTHOGONAL to openness (`jobStatus` LIVE/VERIFIED/ARCHIVED).
 * Openness answers "is this role currently open?"; provenance answers "is this a
 * real, sourced opportunity, or something we cannot vouch for?".
 *
 *   GENUINE  → EMPLOYER   (posted by an owning employer via the portal)
 *              AGGREGATED (pulled from a recognized trusted API + real apply URL)
 *              CURATED    (admin-entered with explicit editorial/source evidence
 *                          + real apply URL)
 *              OFFICIAL   (government ingestion WITH a real official/notification
 *                          URL — never just because board === "govt")
 *   NON-GENUINE →
 *              SYNTHETIC     (generated demo/showcase inventory)
 *              UNCLASSIFIED  (unknown / legacy / insufficient evidence)
 *
 * FAIL CLOSED: anything we cannot positively justify as genuine is
 * `UNCLASSIFIED`, which is treated exactly like synthetic — non-genuine,
 * non-indexable, non-schema-eligible, non-distributable, non-verified, and
 * non-countable. Genuineness must be *earned* with evidence, never assumed from
 * the absence of a marker.
 *
 * Every trust surface (sitemap, JobPosting JSON-LD, "verified" badges, public
 * counters, and outbound distribution) routes its decision through the
 * predicates below.
 */

import { isPast, parseRealDate } from "../seo/jobPostingRules"

export type Provenance =
  | "EMPLOYER"
  | "AGGREGATED"
  | "CURATED"
  | "OFFICIAL"
  | "SYNTHETIC"
  | "UNCLASSIFIED"

/** Every provenance that represents a real, vouched-for opportunity. */
export const GENUINE_PROVENANCE: ReadonlySet<Provenance> = new Set<Provenance>([
  "EMPLOYER",
  "AGGREGATED",
  "CURATED",
  "OFFICIAL",
])

/** All values the column/type may legally hold (genuine + non-genuine). */
export const KNOWN_PROVENANCE: ReadonlySet<string> = new Set<string>([
  ...GENUINE_PROVENANCE,
  "SYNTHETIC",
  "UNCLASSIFIED",
])

/**
 * Recognized trusted aggregator source identifiers (lowercased substrings). A
 * row is only AGGREGATED when its `source` matches one of these AND it has a
 * real apply URL. Add new aggregators here as they are vetted.
 */
const TRUSTED_AGGREGATOR_SOURCES: readonly string[] = ["himalayas"]

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
  /**
   * Lifecycle status from the row (`active`, `pending`, `paused`, `closed`,
   * `rejected`, `archived`, `expired`, …). Anything other than `active` is not an
   * open opportunity. Absent on generated/local rows, which carry no lifecycle.
   */
  status?: string | null
  /**
   * The EMPLOYER's real application deadline (ISO or display date), when the
   * record has one. A deadline in the past means the job is closed. This is never
   * NobleJob's internal review date.
   */
  application_deadline?: string | null
  applicationDeadline?: string | null
  applyUrl?: string | null
  apply_url?: string | null
  employer_id?: string | null
  /** Verification evidence for employer ownership. */
  is_verified?: boolean | null
  employer_verified?: boolean | null
  verified?: boolean | null
  /** Government official / notification URLs (any casing / board). */
  officialUrl?: string | null
  official_url?: string | null
  notificationUrl?: string | null
  notification_url?: string | null
  notificationPdf?: string | null
  notification_pdf?: string | null
}

// Generated demo inventory ids look like `live-priv-1`, `ver-wfh-7`,
// `arch-abroad-uae-3` (see src/lib/data/jobInventory.ts).
const SYNTHETIC_ID_PREFIX = /^(live|ver|arch)-(priv|wfh|abroad)\b/i
// Free-text `source` values only the generated inventory uses.
const SYNTHETIC_SOURCES = new Set(["archived inventory", "live feed"])

function applyUrlOf(j: Classifiable): string {
  return (j.applyUrl ?? j.apply_url ?? "").toString().trim()
}

function officialUrlOf(j: Classifiable): string {
  return (
    j.officialUrl ??
    j.official_url ??
    j.notificationUrl ??
    j.notification_url ??
    j.notificationPdf ??
    j.notification_pdf ??
    ""
  )
    .toString()
    .trim()
}

function sourceOf(j: Classifiable): string {
  return (j.source ?? "").toString().trim().toLowerCase()
}

/**
 * True when a URL points to a real external destination. A missing URL, a bare
 * "#", or any example.* placeholder is not real.
 */
export function hasRealApplyUrl(url?: string | null): boolean {
  const u = (url ?? "").trim()
  if (!u || u === "#") return false
  if (/(^|\/\/|\.)example\.(com|org|net)\b/i.test(u)) return false
  return /^https?:\/\//i.test(u)
}

/** Real official/notification URL evidence (government). */
function hasRealOfficialUrl(j: Classifiable): boolean {
  return hasRealApplyUrl(officialUrlOf(j))
}

/** Trusted employer ownership + verification evidence. */
function hasEmployerEvidence(j: Classifiable): boolean {
  return Boolean(j.employer_id) && (j.is_verified === true || j.employer_verified === true || j.verified === true)
}

function isTrustedAggregatorSource(source: string): boolean {
  return TRUSTED_AGGREGATOR_SOURCES.some(t => source.includes(t))
}

/** Explicit editorial/curation evidence in the free-text source. */
function hasEditorialEvidence(source: string): boolean {
  return /\bcurated\b|\beditorial\b/.test(source)
}

/**
 * Resolve provenance for any job-like object. FAIL CLOSED:
 *  1. An explicit, KNOWN provenance value wins (incl. SYNTHETIC / UNCLASSIFIED).
 *  2. Clear demo-inventory / placeholder markers → SYNTHETIC.
 *  3. Genuine classes are only inferred when their specific EVIDENCE is present.
 *  4. Everything else (unknown / legacy / insufficient evidence) → UNCLASSIFIED.
 *     We NEVER default an unrecognized row to a genuine class.
 */
export function classifyProvenance(j: Classifiable): Provenance {
  const explicit = typeof j.provenance === "string" ? j.provenance.toUpperCase() : ""
  if (KNOWN_PROVENANCE.has(explicit)) return explicit as Provenance

  const id = (j.id ?? "").toString()
  const source = sourceOf(j)
  const url = applyUrlOf(j)

  // ── Clearly generated demo inventory / placeholder ────────────────────
  if (SYNTHETIC_ID_PREFIX.test(id)) return "SYNTHETIC"
  if (SYNTHETIC_SOURCES.has(source)) return "SYNTHETIC"
  // A present-but-placeholder apply URL is never a genuine opening.
  if (url && !hasRealApplyUrl(url)) return "SYNTHETIC"

  // ── Genuine classes — inferred ONLY with positive evidence ────────────
  // Government: never OFFICIAL from board alone; require a real official URL.
  if (j.board === "govt") {
    return hasRealOfficialUrl(j) ? "OFFICIAL" : "UNCLASSIFIED"
  }
  // A real official/notification URL on a non-govt row still signals government.
  if (hasRealOfficialUrl(j)) return "OFFICIAL"
  if (isTrustedAggregatorSource(source) && hasRealApplyUrl(url)) return "AGGREGATED"
  if (hasEmployerEvidence(j)) return "EMPLOYER"
  if (hasEditorialEvidence(source) && hasRealApplyUrl(url)) return "CURATED"

  // ── Fail closed ───────────────────────────────────────────────────────
  return "UNCLASSIFIED"
}

/**
 * True when the row represents a real, sourced opportunity. Re-validates the
 * minimal evidence for the classified provenance so that even an explicitly
 * stamped-but-malformed row cannot pass as genuine (defense in depth).
 */
export function isGenuine(j: Classifiable): boolean {
  const p = classifyProvenance(j)
  if (!GENUINE_PROVENANCE.has(p)) return false
  switch (p) {
    case "OFFICIAL":
      return hasRealOfficialUrl(j)
    case "EMPLOYER":
      // Employer postings use the on-site internal application flow, so an
      // external apply URL is optional — but ownership must be present.
      return Boolean(j.employer_id)
    case "AGGREGATED":
    case "CURATED":
      return hasRealApplyUrl(applyUrlOf(j))
    default:
      return false
  }
}

/**
 * Openness axis. NOT open when: archived; lifecycle status is anything other
 * than `active` (closed, paused, pending, rejected, expired…); or the employer's
 * real application deadline has passed. Rows that carry no lifecycle information
 * (generated / local inventory) fall back to the archived check only.
 */
export function isOpen(j: Classifiable, now: Date = new Date()): boolean {
  if ((j.jobStatus ?? j.job_status) === "ARCHIVED_JOB") return false
  const status = (j.status ?? "").toString().trim().toLowerCase()
  if (status && status !== "active") return false
  const deadline = parseRealDate(j.application_deadline ?? j.applicationDeadline)
  if (deadline && isPast(deadline, now)) return false
  return true
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
 * Is an application submitted through NobleJob actually DELIVERED to the
 * employer? Only for an employer-owned posting (EMPLOYER provenance with an
 * `employer_id`): the application is routed to that employer's dashboard/email.
 * Aggregated, curated and government postings send candidates to a third-party
 * site (or are stored ownerless), so they are NOT direct-apply. Used for
 * JobPosting `directApply` — it may never default to true.
 */
export function isDeliveredToEmployerViaPlatform(j: Classifiable): boolean {
  return classifyProvenance(j) === "EMPLOYER" && isGenuine(j)
}

/**
 * The on-site detail path for a private/WFH/abroad job, or `null` when the job
 * must NOT be linked from indexable pages. We only hand a crawlable internal
 * link to GENUINE jobs; synthetic / unclassified demo rows return null so their
 * (noindex) detail pages are never given dofollow discovery links. Government
 * jobs are always genuine and are linked via their own slug path elsewhere.
 */
export function jobDetailHref(
  board: "private" | "wfh" | "abroad",
  job: Classifiable & { id?: string | null },
): string | null {
  if (!job.id) return null
  return isGenuine(job) ? `/jobs/${board}/${job.id}` : null
}

/**
 * May we present a "Verified" trust badge? Never for synthetic / unclassified
 * content, even when a legacy `jobStatus` is VERIFIED_JOB or a stale `verified`
 * flag is set.
 */
export function hasVerifiedTrust(j: Classifiable): boolean {
  if (!isGenuine(j)) return false
  return j.jobStatus === "VERIFIED_JOB" || j.verified === true
}
