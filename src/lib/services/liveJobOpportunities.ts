import type { Job } from "@/types/job"
import type { WfhJob } from "@/types/wfhJob"
import type { AbroadJob } from "@/types/abroadJob"

/**
 * Live external inventory from Job Opportunities API's keyless public surface.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DISABLED (Phase 1A, strategy/internal-applications-admin-gate):
 *
 * `api.jobopportunitiesapi.org/public/jobs` returns HTTP 401 on every request
 * we have made to it, and no API key/credential for it exists anywhere in this
 * repository or its environment config. There is also no evidence this is a
 * real, documented public API — nothing keyless was ever confirmed working.
 * The previous implementation silently swallowed the failure (try/catch →
 * `[]`) and presented itself as a live source while returning nothing, which
 * is a dead integration pretending to work.
 *
 * We do NOT invent a credential and we do NOT delete this file: every function
 * below keeps its exact exported signature so `jobService.ts`, `wfhJobService.ts`,
 * `abroadJobService.ts` and `featuredJobs.ts` need no changes. `fetchRows()` and
 * `fetchOne()` now short-circuit to an empty result WITHOUT making any network
 * call, so this module can never contact an unverified host, and every caller
 * behaves exactly as it already does when the source has nothing to offer.
 *
 * To re-enable this source: obtain a verified, working credential (or confirm
 * a genuinely keyless working endpoint), remove the short-circuit below, and
 * re-verify `hasUsableFields()` still matches the provider's real response
 * shape before trusting it again.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Public API reference (unverified / currently returns 401): https://api.jobopportunitiesapi.org/public/jobs
 */
const API_BASE = "https://api.jobopportunitiesapi.org/public/jobs"
const LIST_LIMIT = 20
const SOURCE_DISABLED = true

interface LiveApiRow {
  id: string
  slug: string
  title: string
  company: string
  company_logo?: string
  country?: string
  city?: string
  location?: string
  remote?: "remote" | "hybrid" | "on_site"
  employment_type?: string
  seniority?: string
  category?: string
  description?: string
  apply_url?: string
  posted_at?: string
  last_verified_at?: string
  status: "live" | "closed"
  source?: string
  salary_min?: number
  salary_max?: number
  salary_currency?: string
  salary_period?: string
}

interface LiveApiResponse {
  data?: LiveApiRow[]
}

export type LiveBoard = "private" | "wfh" | "abroad"

function initials(company: string): string {
  return company
    .replace(/[^A-Za-z0-9 ]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(s => s[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 3) || "NJ"
}

function colorFor(company: string): string {
  let hash = 0
  for (const ch of company) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const palette = ["#1847d4", "#0f766e", "#7c3aed", "#b45309", "#be123c", "#0369a1"]
  return palette[hash % palette.length]
}

function salaryText(row: LiveApiRow): string {
  if (row.salary_min == null && row.salary_max == null) return ""
  const currency = row.salary_currency || ""
  const period = row.salary_period ? `/${row.salary_period}` : ""
  const fmt = (n: number) => `${currency ? `${currency} ` : ""}${n.toLocaleString("en-IN")}`
  if (row.salary_min != null && row.salary_max != null) return `${fmt(row.salary_min)}–${fmt(row.salary_max)}${period}`
  return `${fmt(row.salary_min ?? row.salary_max!)}${period}`
}

function hasUsableFields(row: LiveApiRow): boolean {
  return Boolean(
    row.id &&
    row.title?.trim() &&
    row.company?.trim() &&
    row.description?.trim() &&
    row.location?.trim() &&
    row.apply_url?.match(/^https?:\/\//i) &&
    row.status === "live",
  )
}

function queryFor(board: LiveBoard, extra: { q?: string; location?: string; category?: string; type?: string } = {}) {
  const params = new URLSearchParams({ limit: String(LIST_LIMIT), include_description: "true" })

  if (board === "private") {
    params.set("country", "IN")
  } else if (board === "wfh") {
    params.set("country", "IN")
    params.set("remote", "remote")
  } else {
    // Broad, useful international coverage without pretending that a single
    // country is the whole abroad market. The provider accepts comma-separated
    // ISO country codes on the public endpoint.
    params.set("country", "US,GB,CA,AE,AU,DE,SG,SA,QA,NZ")
  }

  if (extra.q) params.set("q", extra.q)
  if (extra.location && board === "private") params.set("q", extra.location)
  if (extra.type) params.set("employment_type", extra.type)

  return params
}

async function fetchRows(board: LiveBoard, extra: { q?: string; location?: string; category?: string; type?: string } = {}): Promise<LiveApiRow[]> {
  // See the module-level DISABLED note: no network call is made while this
  // source has no verified credential / working endpoint.
  if (SOURCE_DISABLED) return []
  try {
    const res = await fetch(`${API_BASE}?${queryFor(board, extra).toString()}`, {
      next: { revalidate: 300 },
      headers: { Accept: "application/json" },
    })
    if (!res.ok) return []
    const json = (await res.json()) as LiveApiResponse
    return (json.data ?? []).filter(hasUsableFields)
  } catch {
    return []
  }
}

function toPrivate(row: LiveApiRow): Job {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    logo: initials(row.company),
    logoUrl: row.company_logo || null,
    color: colorFor(row.company),
    location: row.location || [row.city, row.country].filter(Boolean).join(", "),
    type: row.employment_type || "",
    exp: row.seniority || "",
    salary: salaryText(row),
    cat: row.category || "",
    skills: [],
    badge: "New",
    jobStatus: "LIVE_JOB",
    provenance: "AGGREGATED",
    applyUrl: row.apply_url!,
    desc: row.description!,
    posted: row.posted_at || row.last_verified_at || "",
    verified: false,
    source: `Job Opportunities API${row.source ? ` · ${row.source}` : ""}`,
    board: "private",
    source_posted_at: row.posted_at || null,
  }
}

function toWfh(row: LiveApiRow): WfhJob {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    logo: initials(row.company),
    color: colorFor(row.company),
    type: row.employment_type || "",
    experience: row.seniority || "",
    salary: salaryText(row),
    cat: row.category || "",
    qualification: "",
    skills: [],
    badge: "New",
    badge_type: "new",
    applicants: 0,
    description: row.description!,
    apply_url: row.apply_url!,
    posted_at: row.posted_at || row.last_verified_at || "",
    status: "active",
    jobStatus: "LIVE_JOB",
    provenance: "AGGREGATED",
    employer_id: null,
    is_featured: false,
    applicant_country: row.country || "IN",
    source_posted_at: row.posted_at || null,
  }
}

function toAbroad(row: LiveApiRow): AbroadJob {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    logo: initials(row.company),
    country: row.country || "International",
    location: row.location || [row.city, row.country].filter(Boolean).join(", "),
    type: row.employment_type || "",
    salary: salaryText(row),
    experience: row.seniority || "",
    category: row.category || "",
    description: row.description!,
    apply_url: row.apply_url!,
    skills: [],
    badge: "New",
    status: "active",
    posted_at: row.posted_at || row.last_verified_at || "",
    jobStatus: "LIVE_JOB",
    provenance: "AGGREGATED",
    employer_id: null,
    is_featured: false,
    source_posted_at: row.posted_at || null,
  }
}

export async function getLivePrivateJobs(filters: { q?: string; location?: string; type?: string } = {}): Promise<Job[]> {
  return (await fetchRows("private", filters)).map(toPrivate)
}

export async function getLiveWfhJobs(filters: { q?: string; type?: string } = {}): Promise<WfhJob[]> {
  return (await fetchRows("wfh", filters)).map(toWfh)
}

export async function getLiveAbroadJobs(filters: { q?: string; country?: string; category?: string } = {}): Promise<AbroadJob[]> {
  const rows = await fetchRows("abroad", { q: filters.q, category: filters.category })
  if (!filters.country) return rows.map(toAbroad)
  const needle = filters.country.toLowerCase()
  return rows.filter(r => `${r.country || ""} ${r.location || ""}`.toLowerCase().includes(needle)).map(toAbroad)
}

export async function getLivePrivateJobById(id: string): Promise<Job | null> {
  return fetchOne(id, "private").then(row => row ? toPrivate(row) : null)
}

export async function getLiveWfhJobById(id: string): Promise<WfhJob | null> {
  return fetchOne(id, "wfh").then(row => row ? toWfh(row) : null)
}

export async function getLiveAbroadJobById(id: string): Promise<AbroadJob | null> {
  return fetchOne(id, "abroad").then(row => row ? toAbroad(row) : null)
}

async function fetchOne(id: string, board: LiveBoard): Promise<LiveApiRow | null> {
  // See the module-level DISABLED note: no network call is made while this
  // source has no verified credential / working endpoint.
  if (SOURCE_DISABLED) return null
  try {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
      next: { revalidate: 600 },
      headers: { Accept: "application/json" },
    })
    if (!res.ok) return null
    const json = (await res.json()) as { data?: LiveApiRow }
    const row = json.data
    if (!row || row.status !== "live" || !hasUsableFields(row)) return null
    if (board === "wfh" && row.remote !== "remote") return null
    if (board === "private" && row.country !== "IN") return null
    return row
  } catch {
    return null
  }
}
