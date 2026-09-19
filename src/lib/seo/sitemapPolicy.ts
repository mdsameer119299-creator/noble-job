/**
 * sitemapPolicy.ts — pure rules for what may appear in sitemap.xml and with what
 * `<lastmod>`. Dependency-free (no Next / Supabase) so it is unit-testable.
 *
 * Principles
 *  • `lastmod` is a REAL content date or it is omitted. It is never the request /
 *    generation time, and never one value stamped on every URL: Google learns to
 *    ignore `lastmod` from sites that lie, which wastes the crawl signal.
 *  • Only canonical, indexable, genuine URLs are listed: no query strings, no
 *    auth / API / dashboard paths, no redirect sources, no synthetic / unclassified
 *    / closed / expired job pages.
 */
import { isGenuine, isOpen, type Classifiable } from "../jobs/provenance"
import { isRenderableJob } from "../jobs/renderable"
import { parseRealDate } from "./jobPostingRules"

export type SitemapChangeFreq = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never"

export interface SitemapEntry {
  url: string
  /** Real content date, or absent. */
  lastModified?: Date
  changeFrequency?: SitemapChangeFreq
  priority?: number
}

/* ------------------------------------------------------------------ */
/* lastmod                                                             */
/* ------------------------------------------------------------------ */

/** Anything later than `now + 1 day` is treated as bad data, not a real date. */
const FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000

/**
 * The first candidate that is a REAL, non-future date. Candidates may be ISO
 * strings, display dates ("30 Jun 2026"), or Date objects. Returns `undefined`
 * when none qualifies — the caller then omits `lastmod` rather than inventing one.
 */
export function toLastModified(
  candidates: Array<string | Date | null | undefined>,
  now: Date = new Date(),
): Date | undefined {
  for (const c of candidates) {
    if (c == null || c === "") continue
    const iso = c instanceof Date ? (Number.isNaN(c.getTime()) ? undefined : c.toISOString()) : parseRealDate(c)
    if (!iso) continue
    const d = new Date(iso)
    if (d.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) continue
    return d
  }
  return undefined
}

/** The latest of several dates, ignoring undefined. */
export function latestDate(dates: Array<Date | undefined>): Date | undefined {
  let best: Date | undefined
  for (const d of dates) if (d && (!best || d.getTime() > best.getTime())) best = d
  return best
}

/* ------------------------------------------------------------------ */
/* Exclusions                                                          */
/* ------------------------------------------------------------------ */

/** Path prefixes that are never sitemap material (auth, API, dashboards, internals). */
const EXCLUDED_PREFIXES = [
  "/auth",
  "/api",
  "/admin",
  "/employer",
  "/candidate",
  "/404",
  "/_next",
  "/login",
  "/register",
  "/reset-password",
]

/** Extract the path of an absolute URL (or return the input if it is already a path). */
function pathOf(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url.split(/[?#]/)[0]
  }
}

/** True for a path that must never be listed (auth/API/dashboard/internal). */
export function isExcludedPath(path: string): boolean {
  const p = path.toLowerCase()
  return EXCLUDED_PREFIXES.some(x => p === x || p.startsWith(`${x}/`))
}

/** A URL carrying a query string or fragment is a filtered/paginated/tracking variant. */
export function hasQueryOrHash(url: string): boolean {
  return /[?#]/.test(url)
}

export interface FinalizeOptions {
  /** Site origin, e.g. https://www.noblejob.in */
  base: string
  /** Paths that 301 elsewhere — their SOURCE must not be listed. */
  redirectSources?: ReadonlySet<string>
}

/**
 * Apply the listing rules and de-duplicate by URL (first occurrence wins).
 * Silent by design — `validateSitemapEntries` is the loud counterpart used in
 * tests and the validation script.
 */
export function finalizeSitemap(entries: SitemapEntry[], opts: FinalizeOptions): SitemapEntry[] {
  const base = opts.base.replace(/\/$/, "")
  const seen = new Set<string>()
  const out: SitemapEntry[] = []
  for (const e of entries) {
    if (!e.url.startsWith(base)) continue
    if (hasQueryOrHash(e.url)) continue
    const path = pathOf(e.url) || "/"
    if (isExcludedPath(path)) continue
    if (opts.redirectSources?.has(path)) continue
    if (seen.has(e.url)) continue
    seen.add(e.url)
    out.push(e)
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Job rows → entries                                                  */
/* ------------------------------------------------------------------ */

/** A raw `jobs` / `wfh_jobs` / `abroad_jobs` row as read for the sitemap. */
export interface SitemapJobRow {
  id: string
  // NOTE: `posted_at` is deliberately NOT part of this shape. On jobs / wfh_jobs /
  // abroad_jobs it is `TIMESTAMPTZ NOT NULL DEFAULT NOW()` — the moment the row was
  // INSERTED (an employer's submission, or an ingestion / import run) — not the
  // original publication date and not a content-modification date. It is never
  // bumped when the content is edited, and a bulk import stamps every row alike.
  // None of the job tables has a content-change column (only `govt_jobs` does:
  // `content_changed_at`), so a job URL has no trustworthy lastmod.
  provenance?: string | null
  apply_url?: string | null
  employer_id?: string | null
  is_verified?: boolean | null
  job_status?: string | null
  status?: string | null
  source?: string | null
  application_deadline?: string | null
  /**
   * Completeness columns — a row without a real title / company / description
   * (and location / country where required) is an EMPTY job and is never listed.
   */
  title?: string | null
  company?: string | null
  description?: string | null
  location?: string | null
  country?: string | null
}

export type SitemapJobBoard = "private" | "wfh" | "abroad"

/**
 * Genuine, currently-open job rows → sitemap entries.
 *
 * `isIndexable` is the same predicate the detail page's robots + JobPosting use,
 * so a URL is listed if and only if the page is indexable. It already rejects
 * synthetic / unclassified rows, non-`active` lifecycle status, archived jobs and a
 * real past `application_deadline`.
 *
 * `lastmod` is ALWAYS omitted for private / WFH / abroad jobs: no stored column
 * records when their content last changed (see SitemapJobRow — `posted_at` is the row's
 * insertion time, so it would turn every ingestion or import run into a fresh
 * "modified" signal). Never derive one from `posted_at`, `created_at`, `updated_at`,
 * `source_posted_at` (the ORIGINAL publication date, not a modification date),
 * `last_confirmed_open_at` or the clock. Govt records carry a real
 * `content_changed_at` and keep theirs.
 */
export function jobRowsToSitemapEntries(
  board: SitemapJobBoard,
  rows: SitemapJobRow[],
  base: string,
  opts: { now?: Date; limit?: number } = {},
): SitemapEntry[] {
  const now = opts.now ?? new Date()
  const root = base.replace(/\/$/, "")
  const out: SitemapEntry[] = []
  for (const r of rows) {
    const c: Classifiable = {
      id: String(r.id),
      board,
      provenance: r.provenance,
      apply_url: r.apply_url,
      employer_id: r.employer_id,
      is_verified: r.is_verified === true,
      // Only `jobs` carries job_status; the other boards default to LIVE.
      jobStatus: r.job_status ?? "LIVE_JOB",
      status: r.status,
      application_deadline: r.application_deadline,
      source: r.source,
    }
    // Same predicate as `isIndexable`, with an injectable clock for tests.
    if (!(isGenuine(c) && isOpen(c, now))) continue
    // NO EMPTY JOBS: a URL is listed only when the page would render a real job
    // (the same gate the detail route uses to 404 an incomplete record).
    if (!isRenderableJob({ ...r, ...c }, board)) continue
    out.push({
      url: `${root}/jobs/${board}/${r.id}`,
      changeFrequency: "weekly",
      priority: board === "private" ? 0.8 : 0.7,
    })
    if (opts.limit && out.length >= opts.limit) break
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export interface SitemapValidation {
  errors: string[]
  warnings: string[]
}

export interface ValidateOptions {
  base: string
  now?: Date
  redirectSources?: ReadonlySet<string>
  /** Sitemap protocol limit. */
  maxUrls?: number
}

/**
 * Structural checks for a generated sitemap. `errors` should fail a build/test;
 * `warnings` are advisory.
 *
 * The lastmod check exists to catch the regression this phase fixes: stamping
 * every URL with the generation time. It flags a sitemap where more than a handful
 * of entries carry a lastmod within a minute of `now`, or where every lastmod is
 * identical.
 */
export function validateSitemapEntries(entries: SitemapEntry[], opts: ValidateOptions): SitemapValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const now = opts.now ?? new Date()
  const base = opts.base.replace(/\/$/, "")
  const seen = new Set<string>()

  if (entries.length > (opts.maxUrls ?? 50000)) errors.push(`more than ${opts.maxUrls ?? 50000} URLs in one sitemap`)

  for (const e of entries) {
    if (!/^https?:\/\//.test(e.url)) errors.push(`not an absolute URL: ${e.url}`)
    if (!e.url.startsWith(base)) errors.push(`URL is off-origin: ${e.url}`)
    if (hasQueryOrHash(e.url)) errors.push(`query/fragment URL listed: ${e.url}`)
    const path = pathOf(e.url) || "/"
    if (isExcludedPath(path)) errors.push(`excluded (auth/api/internal) path listed: ${e.url}`)
    if (opts.redirectSources?.has(path)) errors.push(`redirect source listed: ${e.url}`)
    if (seen.has(e.url)) errors.push(`duplicate URL: ${e.url}`)
    seen.add(e.url)
    if (e.lastModified) {
      if (Number.isNaN(e.lastModified.getTime())) errors.push(`invalid lastmod: ${e.url}`)
      else if (e.lastModified.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) errors.push(`future lastmod: ${e.url}`)
    }
  }

  const dated = entries.filter(e => e.lastModified && !Number.isNaN(e.lastModified.getTime()))
  if (dated.length >= 5) {
    const nearNow = dated.filter(e => Math.abs(now.getTime() - e.lastModified!.getTime()) < 60_000)
    if (nearNow.length > 3) {
      errors.push(`${nearNow.length} URLs have a lastmod equal to the generation time`)
    }
    if (new Set(dated.map(e => e.lastModified!.getTime())).size === 1) {
      // A handful of pages legitimately share one authored date; a large sitemap
      // where EVERY dated URL matches is the "one timestamp stamped on all" pattern.
      const msg = `every one of ${dated.length} dated URLs carries the identical lastmod`
      if (dated.length >= 20) errors.push(msg)
      else warnings.push(msg)
    }
  }
  if (dated.length < entries.length / 4) {
    warnings.push(`only ${dated.length}/${entries.length} URLs carry a real lastmod (others omit it by design)`)
  }
  return { errors, warnings }
}
