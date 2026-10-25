/**
 * himalayasAbroadIngest.ts — genuine Himalayas international jobs → the `abroad_jobs` table.
 *
 * Mirrors the structure and safety invariants of `himalayasWfhIngest.ts` (which
 * feeds the WFH board), adapted for the Abroad Jobs board:
 *
 *  - GEO FILTER IS INVERTED: WFH ingests India-eligible remote jobs
 *    (Worldwide / India / Asia / no restriction). Abroad ingests jobs whose
 *    locationRestrictions name specific non-India countries or regions
 *    (UAE, UK, Canada, USA, Europe, etc.) — roles an Indian jobseeker would
 *    need to relocate or obtain a visa for. "Worldwide" / "Global" / no
 *    restriction roles already go to WFH and are excluded here to avoid
 *    duplicating them across boards.
 *
 *  - SEARCH QUERIES are broadened with country-specific keywords to catch
 *    international postings the generic endpoints would miss.
 *
 *  - COUNTRY EXTRACTION: the first recognised country name from
 *    locationRestrictions becomes the `country` field on abroad_jobs.
 *
 * Business-rule invariants (same as WFH ingest):
 *  - provenance is always "AGGREGATED", employer_id is always null
 *  - scam filter applied identically
 *  - duplicates prevented via stable id (`himalayas:<sha1(guid)>`)
 *  - posted_at preserved across refreshes (only set on first insert)
 *  - stale rows marked `status: "closed"` (never deleted)
 *  - source_posted_at / application_deadline from source only (never inferred)
 */
import { createHash } from "crypto"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { isSupabaseAdminConfigured } from "@/lib/supabase/config"
import { isMissingColumnError } from "@/lib/supabase/columnErrors"
import { isScam } from "@/lib/utils/scamFilter"
import { mapCategory, mapSeniority, colorForCompany } from "@/lib/utils/jobMapper"

const BASE = "https://himalayas.app/jobs/api"

// Broader endpoint set than WFH: includes country-specific queries to surface
// international postings that the generic "latest" endpoint rarely returns.
const ENDPOINTS = [
  `${BASE}?limit=20`,
  `${BASE}/search?q=software+engineer&limit=20`,
  `${BASE}/search?q=product+manager&limit=10`,
  `${BASE}/search?q=data+analyst&limit=10`,
  `${BASE}/search?q=customer+support&limit=10`,
  `${BASE}/search?q=marketing&limit=10`,
  `${BASE}/search?q=finance&limit=10`,
  // Country-targeted queries to catch abroad-specific listings
  `${BASE}/search?q=dubai&limit=10`,
  `${BASE}/search?q=london+uk&limit=10`,
  `${BASE}/search?q=canada&limit=10`,
  `${BASE}/search?q=australia&limit=10`,
  `${BASE}/search?q=singapore&limit=10`,
  `${BASE}/search?q=germany&limit=10`,
  `${BASE}/search?q=usa+united+states&limit=10`,
] as const

const ID_PREFIX = "himalayas:"

// ── Geo-filter: the opposite of isIndiaEligible ────────────────────────

/**
 * Country names / regions we look for in locationRestrictions. The first match
 * becomes the `country` field on the abroad_jobs row.
 *
 * Deliberately excludes "India" — if the ONLY restriction is India, the job is
 * domestic, not abroad. If India appears alongside other countries, the job is
 * still international and we pick the first non-India country.
 */
const ABROAD_COUNTRY_MAP: Array<{ pattern: RegExp; country: string }> = [
  { pattern: /\bunited arab emirates\b|\buae\b|\bdubai\b|\babu dhabi\b/i, country: "UAE" },
  { pattern: /\bunited kingdom\b|\b(?<!\bunited )uk\b|\bengland\b|\blondon\b|\bscotland\b/i, country: "United Kingdom" },
  { pattern: /\bcanada\b/i, country: "Canada" },
  { pattern: /\baustralia\b/i, country: "Australia" },
  { pattern: /\bunited states\b|\busa\b|\bu\.s\.a\b/i, country: "United States" },
  { pattern: /\bsingapore\b/i, country: "Singapore" },
  { pattern: /\bgermany\b/i, country: "Germany" },
  { pattern: /\bnetherlands\b|\bholland\b/i, country: "Netherlands" },
  { pattern: /\bfrance\b/i, country: "France" },
  { pattern: /\bjapan\b/i, country: "Japan" },
  { pattern: /\bnew zealand\b/i, country: "New Zealand" },
  { pattern: /\bswitzerland\b/i, country: "Switzerland" },
  { pattern: /\bireland\b/i, country: "Ireland" },
  { pattern: /\bsweden\b/i, country: "Sweden" },
  { pattern: /\bdenmark\b/i, country: "Denmark" },
  { pattern: /\bnorway\b/i, country: "Norway" },
  { pattern: /\bsaudi arabia\b|\bksa\b/i, country: "Saudi Arabia" },
  { pattern: /\bqatar\b/i, country: "Qatar" },
  { pattern: /\bkuwait\b/i, country: "Kuwait" },
  { pattern: /\bbahrain\b/i, country: "Bahrain" },
  { pattern: /\boman\b/i, country: "Oman" },
  { pattern: /\bmalaysia\b/i, country: "Malaysia" },
  { pattern: /\bsouth korea\b|\bkorea\b/i, country: "South Korea" },
  { pattern: /\bpoland\b/i, country: "Poland" },
  { pattern: /\bspain\b/i, country: "Spain" },
  { pattern: /\bitaly\b/i, country: "Italy" },
  { pattern: /\bportugal\b/i, country: "Portugal" },
  // Region-level fallbacks (when no specific country is named)
  { pattern: /\beurope\b|\beu\b|\bemea\b/i, country: "Europe" },
  { pattern: /\bmiddle east\b|\bmena\b|\bgcc\b/i, country: "Middle East" },
  { pattern: /\bnorth america\b|\bamericas\b/i, country: "North America" },
  { pattern: /\blatin america\b|\blatam\b/i, country: "Latin America" },
  { pattern: /\bafrica\b/i, country: "Africa" },
]

/**
 * Determine if a job is an "abroad" (international / non-India) opportunity.
 * Returns the detected country name, or null if the job is India-only,
 * worldwide/unrestricted (those go to WFH), or has no recognisable abroad country.
 */
export function extractAbroadCountry(locationRestrictions?: string[]): string | null {
  if (!locationRestrictions || locationRestrictions.length === 0) return null // unrestricted → WFH
  const combined = locationRestrictions.join(" ")

  // If the restrictions say "Worldwide" / "Global" / "Remote" / "Anywhere" with
  // no country specifics, it's a WFH job, not abroad.
  const lower = combined.toLowerCase()
  if (/\b(worldwide|global|remote|anywhere)\b/.test(lower) && locationRestrictions.length <= 1) {
    return null
  }

  // Find the first non-India country match
  for (const { pattern, country } of ABROAD_COUNTRY_MAP) {
    if (pattern.test(combined)) return country
  }

  return null // no recognised abroad country
}

// ── Raw types (same as WFH ingest) ─────────────────────────────────────

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

export interface AbroadIngestRow {
  id: string
  title: string
  company: string
  logo: string
  country: string
  location: string
  type: string
  salary: string
  experience: string
  category: string
  description: string
  skills: string[]
  badge: string
  apply_url: string
  status: "active"
  provenance: "AGGREGATED"
  employer_id: null
  is_featured: boolean
  source_posted_at: string | null
  application_deadline: string | null
  last_confirmed_open_at: string
}

/** Strip HTML tags/entities down to plain text. */
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

/** Stable, ID_RE-safe identifier derived from Himalayas' unique guid URL. */
export function idFromGuid(guid: string): string {
  const hash = createHash("sha1").update(guid).digest("hex").slice(0, 32)
  return `${ID_PREFIX}${hash}`
}

export function unixToIso(seconds?: number): string | null {
  if (!seconds || !Number.isFinite(seconds)) return null
  const ms = seconds * 1000
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return null
  const year = d.getUTCFullYear()
  if (year < 2000 || year > 2100) return null
  return d.toISOString()
}

function formatSalary(j: RawHimalayasJob): string {
  const min = j.minSalary
  const max = j.maxSalary
  const cur = j.currency || "USD"
  if (!min && !max) return ""
  const fmt = (n: number) => (cur === "USD" ? `$${Math.round(n / 1000)}K` : `${cur} ${Math.round(n / 1000)}K`)
  if (min && max) return `${fmt(min)}-${fmt(max)}/yr`
  return `${fmt(min || max!)}/yr`
}

/** Build a location string from the restrictions (e.g. "Remote — UAE, UK"). */
function buildLocation(restrictions?: string[]): string {
  if (!restrictions?.length) return "Remote"
  // Filter out generic terms, keep country/region names
  const specific = restrictions.filter(
    r => !/^(worldwide|global|remote|anywhere)$/i.test(r.trim()),
  )
  if (specific.length === 0) return "Remote"
  return `Remote — ${specific.slice(0, 3).join(", ")}`
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

export function toRow(j: RawHimalayasJob, country: string): AbroadIngestRow {
  const id = idFromGuid(j.guid!)
  const description = stripHtml(j.description || j.excerpt || "")
  return {
    id,
    title: (j.title || "").trim(),
    company: (j.companyName || "").trim(),
    logo: j.companyLogo || "",
    country,
    location: buildLocation(j.locationRestrictions),
    type: j.employmentType || "Remote",
    salary: formatSalary(j),
    experience: mapSeniority(j.seniority),
    category: mapCategory(j.categories),
    description,
    skills: [],
    badge: "Sourced",
    apply_url: (j.applicationLink || "").trim(),
    status: "active",
    provenance: "AGGREGATED",
    employer_id: null,
    is_featured: false,
    source_posted_at: unixToIso(j.pubDate),
    application_deadline: unixToIso(j.expiryDate),
    last_confirmed_open_at: new Date().toISOString(),
  }
}

export interface HimalayasAbroadIngestSummary {
  ok: boolean
  fetched: number
  eligible: number
  upserted: number
  closed: number
  reason?: string
}

/**
 * Fetch genuine international Himalayas jobs, filter for abroad (non-India)
 * destinations + scam checks, and upsert them into `abroad_jobs` as AGGREGATED
 * rows. Jobs previously ingested from Himalayas that no longer appear in this
 * fetch are marked `status: "closed"` (never deleted).
 */
export async function ingestHimalayasAbroadJobs(): Promise<HimalayasAbroadIngestSummary> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, fetched: 0, eligible: 0, upserted: 0, closed: 0, reason: "supabase-admin-not-configured" }
  }

  const raw = await fetchRawJobs()

  // Filter: must have required fields, not be a scam, and be an abroad (non-India) job
  const eligible: Array<{ job: RawHimalayasJob; country: string }> = []
  for (const j of raw) {
    if (!j.guid || !j.title?.trim() || !j.companyName?.trim()) continue
    if (!(j.applicationLink || "").trim().match(/^https?:\/\//i)) continue
    if (isScam({ title: j.title, company: j.companyName, description: j.excerpt ?? "", minSalary: j.minSalary, maxSalary: j.maxSalary, currency: j.currency })) continue
    const country = extractAbroadCountry(j.locationRestrictions)
    if (!country) continue
    eligible.push({ job: j, country })
  }

  if (eligible.length === 0) {
    return { ok: true, fetched: raw.length, eligible: 0, upserted: 0, closed: 0 }
  }

  const ids = eligible.map(({ job }) => idFromGuid(job.guid!))

  // Preserve each row's existing posted_at across refreshes
  const { data: existingRows } = await supabaseAdmin
    .from("abroad_jobs")
    .select("id, posted_at")
    .in("id", ids)
  const postedAtById = new Map<string, string>((existingRows ?? []).map(r => [r.id as string, r.posted_at as string]))

  const rows = eligible.map(({ job, country }) => {
    const row = toRow(job, country)
    return { ...row, posted_at: postedAtById.get(row.id) || new Date().toISOString() }
  })

  const upserted = await upsertRows(rows)

  // Close rows previously ingested from Himalayas that are no longer in the feed
  let closed = 0
  const currentIds = new Set(ids)
  const { data: activeHimalayasRows } = await supabaseAdmin
    .from("abroad_jobs")
    .select("id")
    .eq("provenance", "AGGREGATED")
    .eq("status", "active")
    .like("id", "himalayas:%")
  const staleIds = (activeHimalayasRows ?? []).map(r => r.id as string).filter(id => !currentIds.has(id))
  if (staleIds.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabaseAdmin
      .from("abroad_jobs")
      .update({ status: "closed" } as any)
      .in("id", staleIds)
    if (!error) closed = staleIds.length
  }

  return { ok: true, fetched: raw.length, eligible: eligible.length, upserted, closed }
}

async function upsertRows(rows: Array<AbroadIngestRow & { posted_at: string }>): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase generated types may not include all columns yet
  const { error } = await supabaseAdmin.from("abroad_jobs").upsert(rows as any, { onConflict: "id" })
  if (!error) return rows.length

  // Degrade gracefully if newer columns haven't been migrated yet
  if (isMissingColumnError(error)) {
    const stripped = rows.map(({ last_confirmed_open_at: _lco, ...rest }) => rest)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const retry = await supabaseAdmin.from("abroad_jobs").upsert(stripped as any, { onConflict: "id" })
    if (!retry.error) return rows.length
    // Try once more without lifecycle columns
    const minimal = stripped.map(({ application_deadline: _ad, source_posted_at: _sp, ...rest }) => rest)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const retry2 = await supabaseAdmin.from("abroad_jobs").upsert(minimal as any, { onConflict: "id" })
    return retry2.error ? 0 : rows.length
  }
  return 0
}
