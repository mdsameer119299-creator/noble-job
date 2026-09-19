/**
 * renderable.ts — "NO EMPTY JOBS": the single fail-closed gate deciding whether a
 * record is complete enough to be shown to a candidate AS A JOB.
 *
 * Pure and dependency-light (provenance + text helpers only) so the very same
 * predicate runs on the server (services, API routes, pages, sitemap, JobPosting)
 * and in the browser (list mappers, cards).
 *
 * A record is RENDERABLE only when it has ALL of:
 *   • a valid id (no "undefined"/"null", no whitespace, sane characters);
 *   • a real title and a real employer/company (govt: organisation);
 *   • a real description (private / WFH / abroad; govt rows carry no narrative);
 *   • a real location (private) / country (abroad);
 *   • a KNOWN provenance (UNCLASSIFIED = missing/invalid/insufficient evidence);
 *   • an APPLICATION ROUTE when it claims a genuine provenance (private / WFH / abroad):
 *     an employer-owned job that reaches its employer, or a real external application
 *     URL. A genuine-class record with neither (an "employer" job with no employer, an
 *     "aggregated" job with no apply URL) would be a dead end whose Apply could only
 *     mislead the candidate, so it is not shown as a job (sample rows are unaffected:
 *     they are labelled samples with a disabled control);
 *   • no accidental placeholder output ("undefined", "null", "NaN", "N/A", "#", …)
 *     in any of the identifying fields.
 *
 * Incomplete records are NOT deleted and NOT edited — they are simply not exposed:
 * not listed, not counted, not related, not in the sitemap, no JobPosting, and a
 * direct URL to one is a 404. The stored data stays available for correction.
 *
 * ACTIONABLE is a stricter, separate question ("may a candidate apply?"): the
 * record must be renderable, genuine, currently open, and carry an application
 * route (employer-owned → the on-site flow; otherwise a real external URL).
 */
import {
  classifyProvenance,
  GENUINE_PROVENANCE,
  hasRealApplyUrl,
  isGenuine,
  isOpen,
  type Classifiable,
  type Provenance,
} from "./provenance"
import { applyRouteFor } from "./applyRoute"
import { plainTextOf } from "../seo/jobPostingDescription"

export type RenderableBoard = "private" | "wfh" | "abroad" | "govt"

/** Loose record shape: a mapped board type, a raw Supabase row, or a client payload. */
export type JobLike = Classifiable & {
  title?: unknown
  company?: unknown
  org?: unknown
  description?: unknown
  desc?: unknown
  location?: unknown
  country?: unknown
  slug?: unknown
}

/* ------------------------------------------------------------------ */
/* Placeholder detection                                               */
/* ------------------------------------------------------------------ */

/** Whole-value placeholders (compared trimmed + lowercased). */
const PLACEHOLDER_VALUES = new Set([
  "undefined", "null", "nan", "n/a", "na", "n.a.", "n.a", "none", "nil", "-", "--", "—", "–", "?", "#",
  "tbd", "tba", "tbc", "unknown", "untitled", "untitled notification", "untitled job", "no title",
  "title", "job title", "company", "company name", "your company", "employer", "employer name",
  "lorem ipsum", "placeholder", "not specified", "not available", "not provided", "[object object]",
  "test", "todo", "xxx",
])

/** Accidental stringified-undefined tokens embedded anywhere ("undefined at null"). */
const ACCIDENTAL_TOKEN_RE = /(^|[\s(,·|/])(undefined|null|NaN|\[object Object\])($|[\s),·|/])/

/** Any text field: is it empty, a placeholder, or accidental stringified output? */
export function isPlaceholderText(v: unknown): boolean {
  if (v == null) return true
  const raw = typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : ""
  if (!raw) return true
  const t = plainTextOf(raw)
  if (!t) return true
  if (PLACEHOLDER_VALUES.has(t.toLowerCase())) return true
  if (/^[\s\-_.?#*·•0]+$/.test(t)) return true
  return ACCIDENTAL_TOKEN_RE.test(t)
}

/**
 * Values that are not accidental output but are filler rather than facts
 * ("Competitive" salary, "Any Experience", "Not disclosed"). Cards and facts omit
 * these instead of presenting them as data.
 */
const FILLER_VALUES = new Set([
  "competitive", "best in industry", "as per norms", "as per company norms", "as per industry standards",
  "negotiable", "not disclosed", "any", "any experience", "various", "recent", "invalid date",
])

/** A value worth DISPLAYING as a fact: not empty, not a placeholder, not filler. */
export function isRealDisplayValue(v: unknown): boolean {
  if (isPlaceholderText(v)) return false
  return !FILLER_VALUES.has(plainTextOf(String(v)).toLowerCase())
}

/** `v` trimmed when it is a real display value, else `undefined`. */
export function displayValue(v: unknown): string | undefined {
  return isRealDisplayValue(v) ? plainTextOf(String(v)) : undefined
}

/** "a · b · c" from the parts that are real display values (never "undefined", "Competitive", empty). */
export function joinReal(...parts: unknown[]): string {
  return parts.map(displayValue).filter(Boolean).join(" · ")
}

/* ------------------------------------------------------------------ */
/* Field access                                                        */
/* ------------------------------------------------------------------ */

function str(v: unknown): string {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : ""
}

function first(...vals: unknown[]): string {
  for (const v of vals) {
    const s = str(v).trim()
    if (s) return s
  }
  return ""
}

/** A job id we can safely link to: no whitespace, no path/query characters. */
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9:_.\-]{0,127}$/

export function isValidJobId(id: unknown): boolean {
  if (typeof id !== "string") return false
  const t = id.trim()
  if (t !== id) return false
  if (!ID_RE.test(t)) return false
  return !PLACEHOLDER_VALUES.has(t.toLowerCase())
}

/** Minimum description for a job to be shown at all (JobPosting needs far more — see jobPostingDescription). */
export const MIN_VISIBLE_DESCRIPTION_CHARS = 20
export const MIN_VISIBLE_DESCRIPTION_WORDS = 3

function hasRealDescription(v: unknown): boolean {
  const s = str(v)
  if (!s) return false
  if (isPlaceholderText(s)) return false
  const t = plainTextOf(s)
  return t.length >= MIN_VISIBLE_DESCRIPTION_CHARS && t.split(/\s+/).length >= MIN_VISIBLE_DESCRIPTION_WORDS
}

/* ------------------------------------------------------------------ */
/* The gate                                                            */
/* ------------------------------------------------------------------ */

export interface RenderVerdict {
  renderable: boolean
  /** Machine-readable exclusion reasons (empty when renderable). */
  reasons: string[]
}

/** The provenance the record resolves to (govt rows are classified as such). */
export function provenanceOf(rec: JobLike, board: RenderableBoard): Provenance {
  return classifyProvenance(board === "govt" ? { ...rec, board: "govt" } : rec)
}

/**
 * Is this record complete enough to be presented as a job? FAIL CLOSED: any
 * missing / placeholder identifying field, or unknown provenance, excludes it.
 */
export function checkJobRecord(rec: JobLike | null | undefined, board: RenderableBoard): RenderVerdict {
  const reasons: string[] = []
  if (!rec || typeof rec !== "object") return { renderable: false, reasons: ["no-record"] }

  if (!isValidJobId(rec.id)) reasons.push("invalid-id")

  if (isPlaceholderText(rec.title)) reasons.push("missing-title")

  if (board === "govt") {
    if (isPlaceholderText(first(rec.org, rec.company))) reasons.push("missing-organisation")
  } else {
    if (isPlaceholderText(rec.company)) reasons.push("missing-company")
    if (!hasRealDescription(first(rec.description, rec.desc))) reasons.push("missing-description")
    if (board === "private" && isPlaceholderText(rec.location)) reasons.push("missing-location")
    if (board === "abroad" && isPlaceholderText(rec.country)) reasons.push("missing-country")
    // Abroad / WFH `location` is optional, but when present it must not be junk.
    if ((board === "abroad" || board === "wfh") && str(rec.location).trim() && isPlaceholderText(rec.location)) {
      reasons.push("placeholder-location")
    }
  }

  // Missing / invalid / insufficient-evidence provenance is not a job we can vouch for.
  const provenance = provenanceOf(rec, board)
  if (provenance === "UNCLASSIFIED") reasons.push("missing-provenance")
  // A genuine-class record must lead somewhere: to its employer through NobleJob, or to a
  // real external application page. Neither → excluded, never a fake / misleading Apply.
  // (Government rows carry their own evidence-based classification and official links.)
  else if (board !== "govt" && GENUINE_PROVENANCE.has(provenance) && applyRouteFor(board, rec) === "none") {
    reasons.push("no-application-route")
  }

  return { renderable: reasons.length === 0, reasons }
}

export function isRenderableJob(rec: JobLike | null | undefined, board: RenderableBoard): boolean {
  return checkJobRecord(rec, board).renderable
}

/** The record when it is renderable, else `null` (→ a 404 on a detail route). */
export function renderableOrNull<T extends JobLike>(rec: T | null | undefined, board: RenderableBoard): T | null {
  return rec && isRenderableJob(rec, board) ? rec : null
}

/** Keep only renderable records (order preserved). */
export function filterRenderable<T extends JobLike>(list: readonly T[] | null | undefined, board: RenderableBoard): T[] {
  return (list ?? []).filter(j => isRenderableJob(j, board))
}

/**
 * Renderable AND a genuine, currently-open opportunity that a candidate can act
 * on. Employer-owned jobs apply through NobleJob (needs `employer_id`); every
 * other genuine class needs a real external application/official URL. Synthetic /
 * sample rows are never actionable.
 */
export function isActionableJob(rec: JobLike | null | undefined, board: RenderableBoard, now: Date = new Date()): boolean {
  if (!rec || !isRenderableJob(rec, board)) return false
  const c = board === "govt" ? { ...rec, board: "govt" } : rec
  return isGenuine(c) && isOpen(c, now)
}

/** Keep only actionable records (order preserved). */
export function filterActionable<T extends JobLike>(list: readonly T[] | null | undefined, board: RenderableBoard): T[] {
  return (list ?? []).filter(j => isActionableJob(j, board))
}

/* ------------------------------------------------------------------ */
/* Third-party live cards (Himalayas)                                  */
/* ------------------------------------------------------------------ */

/**
 * A live third-party card (no stored description) is usable only when it has a real
 * id, title, company and a real external application URL — the card's whole purpose
 * is to send the candidate to that URL. A junk location disqualifies it too.
 */
export function isUsableLiveJob(raw: Record<string, unknown> | null | undefined): boolean {
  if (!raw || typeof raw !== "object") return false
  const id = typeof raw.id === "string" ? raw.id : ""
  if (!id || id.trim() !== id || /\s/.test(id) || isPlaceholderText(id)) return false
  if (isPlaceholderText(raw.title) || isPlaceholderText(raw.company)) return false
  if (!hasRealApplyUrl(str(raw.applyUrl) || str(raw.apply_url))) return false
  if (str(raw.location).trim() && isPlaceholderText(raw.location)) return false
  return true
}

/* ------------------------------------------------------------------ */
/* Pagination that agrees with what is displayed                       */
/* ------------------------------------------------------------------ */

export interface RenderablePage<T> {
  jobs: T[]
  /** Number of renderable jobs — exactly the set that pages are cut from. */
  total: number
  page: number
  totalPages: number
}

/**
 * Filter first, THEN count and slice, so `total`, `totalPages` and the rows on a
 * page always describe the same set (no "120 jobs" over a list that shows 97).
 */
export function paginateRenderable<T extends JobLike>(
  list: readonly T[] | null | undefined,
  board: RenderableBoard,
  page: number,
  limit: number,
): RenderablePage<T> {
  const ok = filterRenderable(list, board)
  const size = Math.max(1, Math.floor(limit) || 1)
  const p = Math.max(1, Math.floor(page) || 1)
  return {
    jobs: ok.slice((p - 1) * size, p * size),
    total: ok.length,
    page: p,
    totalPages: Math.ceil(ok.length / size),
  }
}
