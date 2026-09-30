/**
 * himalayasWfhIngest.ts — genuine Himalayas remote jobs → the `wfh_jobs` table.
 *
 * Phase 1C / Phase 2 (strategy/internal-applications-admin-gate).
 *
 * This is a NEW, separate ingestion path from `himalayasService.ts` /
 * `himalayasCache.ts` (which remain untouched — they back the existing
 * client-side Private-board "live jobs" overlay). It writes real Himalayas
 * remote roles directly into `wfh_jobs` as database rows, so SSR, the
 * sitemap, board counts, and (where eligible) JobPosting JSON-LD all see
 * them the same way they see any other row in that table — no separate
 * client-side overlay for WFH.
 *
 * IMPORTANT — identifier bug found while building this (flagged, not fixed,
 * in `himalayasService.ts`, which is out of this phase's scope): the raw
 * Himalayas API response never carries an `id` field, and its `slug` field is
 * the COMPANY's slug, not a per-job slug — verified by requesting multiple
 * jobs from the same company and observing an identical `slug` value across
 * distinct job titles. `himalayasService.ts`'s `fetchHimalayasJobs()` derives
 * its dedup key as `j.slug || j.id`, which is therefore unsound: it can
 * collapse a company's distinct postings onto one id. That existing function
 * is NOT reused here. This module instead derives every id from `guid`
 * (Himalayas' own full permalink URL for that specific job posting), which
 * IS unique per job — verified the same way.
 *
 * Business-rule invariants enforced here (see the Phase 1+2 brief):
 *  - provenance is always "AGGREGATED", employer_id is always null — never
 *    given a Noble Job employer identity it doesn't have.
 *  - India-eligibility filtering (`isIndiaEligible`) is PRESERVED unchanged
 *    from the existing Himalayas pipeline, deciding which jobs are even
 *    fetched into the WFH board.
 *  - `applicant_country` is set to "IN" only when the source record itself
 *    explicitly names India in its location restrictions — a much stricter
 *    test than `isIndiaEligible` (which also accepts "Worldwide" / "Global" /
 *    unrestricted roles as India-eligible for board INCLUSION). This keeps
 *    the JobPosting eligibility claim honest: worldwide-remote is not the
 *    same statement as "open to India", and only the latter earns a
 *    JobPosting `applicantLocationRequirements` (see
 *    `resolveApplicantCountry` in jobPostingRules.ts, unchanged).
 *  - duplicates are prevented via a stable id (`himalayas:<sha1(guid)>`)
 *    upserted with `onConflict: "id"`.
 *  - a row's `posted_at` (Noble Job's own "added" timestamp) is preserved
 *    across refreshes — only set fresh on first insert — so re-fetching an
 *    already-known job never makes it look newly posted.
 *  - `source_posted_at` / `application_deadline` come only from the source's
 *    own `pubDate` / `expiryDate` — never inferred.
 *  - a job no longer returned by the source is marked `status: "closed"`
 *    (never deleted; `wfh_jobs` has no `expired` status value), so it
 *    disappears from `.eq("status","active")` listings automatically.
 */
import { createHash } from "crypto"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { isSupabaseAdminConfigured } from "@/lib/supabase/config"
import { isMissingColumnError } from "@/lib/supabase/columnErrors"
import { isScam } from "@/lib/utils/scamFilter"
import { isIndiaEligible } from "@/lib/utils/geoFilter"
import { mapCategory, mapSeniority, colorForCompany } from "@/lib/utils/jobMapper"

const BASE = "https://himalayas.app/jobs/api"

// Same breadth as the existing himalayasService.ts pipeline (7 endpoints), so
// the "still present in the latest fetch" signal used for closing stale rows
// has decent coverage rather than fluctuating on a single narrow query.
const ENDPOINTS = [
  `${BASE}?limit=20`,
  `${BASE}/search?q=software+engineer&limit=20`,
  `${BASE}/search?q=product+manager&limit=10`,
  `${BASE}/search?q=data+analyst&limit=10`,
  `${BASE}/search?q=customer+support&limit=10`,
  `${BASE}/search?q=marketing&limit=10`,
  `${BASE}/search?q=finance&limit=10`,
] as const

const ID_PREFIX = "himalayas:"

export interface RawHimalayasJob {
  title?: string
  excerpt?: string
  companyName?: string
  companySlug?: string
  companyLogo?: string
  employmentType?: string
  minSalary?: number
  maxSalary?: number
  salaryPeriod?: string
  seniority?: string[]
  currency?: string
  locationRestrictions?: string[]
  timezoneRestrictions?: string[]
  categories?: string[]
  parentCategories?: string[]
  description?: string
  pubDate?: number
  expiryDate?: number
  applicationLink?: string
  guid?: string
}

export interface WfhIngestRow {
  id: string
  title: string
  company: string
  logo: string
  color: string
  type: string
  experience: string
  salary: string
  cat: string
  qualification: string
  skills: string[]
  badge: string
  badge_type: string
  applicants: number
  description: string
  apply_url: string
  status: "active"
  provenance: "AGGREGATED"
  employer_id: null
  is_featured: boolean
  source: string
  applicant_country: string | null
  source_posted_at: string | null
  application_deadline: string | null
  last_confirmed_open_at: string
}

/** Strip HTML tags/entities down to plain text (mirrors the general shape of plainTextOf). */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

/** Stable, ID_RE-safe (alnum/:_.-, ≤128 chars) identifier derived from Himalayas' unique guid URL. */
export function idFromGuid(guid: string): string {
  const hash = createHash("sha1").update(guid).digest("hex").slice(0, 32)
  return `${ID_PREFIX}${hash}`
}

export function unixToIso(seconds?: number): string | null {
  if (!seconds || !Number.isFinite(seconds)) return null
  const ms = seconds * 1000
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return null
  // Sanity window: reject obviously-corrupt timestamps (e.g. far past/future)
  // rather than storing a nonsense source date.
  const year = d.getUTCFullYear()
  if (year < 2000 || year > 2100) return null
  return d.toISOString()
}

function formatSalary(j: RawHimalayasJob): string {
  const min = j.minSalary
  const max = j.maxSalary
  const cur = j.currency || "USD"
  if (!min && !max) return ""
  const fmt = (n: number) => (cur === "USD" ? `$${Math.round(n / 1000)}K` : `₹${Math.round(n / 100000)}L`)
  if (min && max) return `${fmt(min)}-${fmt(max)}/yr`
  return `${fmt(min || max!)}/yr`
}

/**
 * Only claim India specifically when the source record itself names India (or an
 * unambiguous India-only signal). Deliberately NOT the same test as
 * `isIndiaEligible` — that one also passes "Worldwide" / "Global" / unrestricted
 * roles, which is a fine basis for showing the job on an India-facing WFH board,
 * but is not the same as the source stating "open to India" for a JobPosting
 * applicant-location claim.
 */
export function explicitIndiaCountry(locationRestrictions?: string[]): string | null {
  if (!locationRestrictions?.length) return null
  const combined = locationRestrictions.join(" ").toLowerCase()
  return /\bindia\b/.test(combined) ? "IN" : null
}

async function fetchRawJobs(): Promise<RawHimalayasJob[]> {
  const seen = new Set<string>()
  const results: RawHimalayasJob[] = []
  await Promise.allSettled(
    ENDPOINTS.map(async url => {
      const res = await fetch(url, { next: { revalidate: 3600 } })
      if (!res.ok) return
      const data = (await res.json()) as { jobs?: RawHimalayasJob[] }
      for (const j of data.jobs ?? []) {
        if (!j.guid || seen.has(j.guid)) continue
        seen.add(j.guid)
        results.push(j)
      }
    }),
  )
  return results
}

export function toRow(j: RawHimalayasJob): WfhIngestRow {
  const id = idFromGuid(j.guid!)
  const description = stripHtml(j.description || j.excerpt || "")
  return {
    id,
    title: (j.title || "").trim(),
    company: (j.companyName || "").trim(),
    logo: j.companyLogo || "",
    color: colorForCompany(j.companyName || ""),
    type: j.employmentType || "Remote",
    experience: mapSeniority(j.seniority),
    salary: formatSalary(j),
    cat: mapCategory(j.categories),
    qualification: "",
    skills: [],
    badge: "Sourced",
    badge_type: "sourced",
    applicants: 0,
    description,
    apply_url: (j.applicationLink || "").trim(),
    status: "active",
    provenance: "AGGREGATED",
    employer_id: null,
    is_featured: false,
    source: "Himalayas",
    applicant_country: explicitIndiaCountry(j.locationRestrictions),
    source_posted_at: unixToIso(j.pubDate),
    application_deadline: unixToIso(j.expiryDate),
    last_confirmed_open_at: new Date().toISOString(),
    // posted_at is intentionally NOT part of WfhIngestRow — see upsertRows(),
    // which preserves it across refreshes instead of resetting it every run.
  }
}

export interface HimalayasWfhIngestSummary {
  ok: boolean
  fetched: number
  eligible: number
  upserted: number
  closed: number
  reason?: string
}

/**
 * Fetch genuine remote Himalayas jobs, filter with the SAME India-eligibility +
 * scam checks the existing Himalayas pipeline uses, and upsert them into
 * `wfh_jobs` as AGGREGATED rows. Jobs previously ingested from Himalayas that no
 * longer appear in this fetch are marked `status: "closed"` (never deleted).
 */
export async function ingestHimalayasWfhJobs(): Promise<HimalayasWfhIngestSummary> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, fetched: 0, eligible: 0, upserted: 0, closed: 0, reason: "supabase-admin-not-configured" }
  }

  const raw = await fetchRawJobs()

  const eligible = raw.filter(j => {
    if (!j.guid || !j.title?.trim() || !j.companyName?.trim()) return false
    if (!(j.applicationLink || "").trim().match(/^https?:\/\//i)) return false
    if (isScam({ title: j.title, company: j.companyName, description: j.excerpt ?? "", minSalary: j.minSalary, maxSalary: j.maxSalary, currency: j.currency })) return false
    if (!isIndiaEligible(j.locationRestrictions)) return false
    return true
  })

  if (eligible.length === 0) {
    return { ok: true, fetched: raw.length, eligible: 0, upserted: 0, closed: 0 }
  }

  const ids = eligible.map(j => idFromGuid(j.guid!))

  // Preserve each row's existing posted_at (Noble Job's own "added" date) across
  // refreshes — only a brand-new row gets NOW().
  const { data: existingRows } = await supabaseAdmin
    .from("wfh_jobs")
    .select("id, posted_at")
    .in("id", ids)
  const postedAtById = new Map<string, string>((existingRows ?? []).map(r => [r.id as string, r.posted_at as string]))

  const rows = eligible.map(j => {
    const row = toRow(j)
    return { ...row, posted_at: postedAtById.get(row.id) || new Date().toISOString() }
  })

  const upserted = await upsertRows(rows)

  // Close rows previously ingested from Himalayas that are no longer returned by
  // the source. Never deleted; `wfh_jobs` has no 'expired' status, so 'closed'
  // is the honest terminal state — the existing status='active' list filter then
  // makes them disappear on its own. Computed in JS (rather than a NOT IN
  // filter) so an empty current batch never accidentally matches "no filter".
  let closed = 0
  const currentIds = new Set(ids)
  const { data: activeHimalayasRows } = await supabaseAdmin
    .from("wfh_jobs")
    .select("id")
    .eq("source", "Himalayas")
    .eq("status", "active")
  const staleIds = (activeHimalayasRows ?? []).map(r => r.id as string).filter(id => !currentIds.has(id))
  if (staleIds.length) {
    const { error } = await supabaseAdmin
      .from("wfh_jobs")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .in("id", staleIds)
    if (!error) closed = staleIds.length
  }

  return { ok: true, fetched: raw.length, eligible: eligible.length, upserted, closed }
}

async function upsertRows(rows: Array<WfhIngestRow & { posted_at: string }>): Promise<number> {
  const { error } = await supabaseAdmin.from("wfh_jobs").upsert(rows, { onConflict: "id" })
  if (!error) return rows.length

  // The new source/applicant_country columns (migration 20260930000001) or the
  // lifecycle columns (20260727000002) may not be applied to this database yet —
  // degrade to the smaller column set rather than failing the whole refresh.
  if (isMissingColumnError(error)) {
    const stripped = rows.map(({ source: _s, applicant_country: _ac, last_confirmed_open_at: _lco, ...rest }) => rest)
    const retry = await supabaseAdmin.from("wfh_jobs").upsert(stripped, { onConflict: "id" })
    if (!retry.error) return rows.length
    // Try once more with only the guaranteed base-schema columns.
    const minimal = stripped.map(({ application_deadline: _ad, ...rest }) => rest)
    const retry2 = await supabaseAdmin.from("wfh_jobs").upsert(minimal, { onConflict: "id" })
    return retry2.error ? 0 : rows.length
  }
  return 0
}
