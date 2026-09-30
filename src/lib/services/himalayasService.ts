/**
 * himalayasService.ts — Himalayas.app API proxy (server-side)
 *
 * Fetches real live remote jobs from Himalayas free API (no key required).
 * Ported from fetchLiveJobs() in the original js-live-jobs script.
 *
 * 7 endpoints (same as original):
 *   1. /api?limit=20          — general browse
 *   2. /api/search?q=software+engineer&limit=20
 *   3. /api/search?q=product+manager&limit=10
 *   4. /api/search?q=data+analyst&limit=10
 *   5. /api/search?q=customer+support&limit=10
 *   6. /api/search?q=marketing&limit=10
 *   7. /api/search?q=finance&limit=10
 *
 * Pipeline per job:
 *   fetch → isScam() filter → isIndiaEligible() filter →
 *   mapCategory() → mapSeniority() → colorForCompany() → cache
 *
 * Caching: results stored in himalayas_jobs_cache table (TTL = 1 hour).
 * ISR revalidation: Next.js revalidate: 3600 on /api/jobs/live route.
 */

import { createHash } from "crypto"
import { isScam }          from "@/lib/utils/scamFilter"
import { isIndiaEligible } from "@/lib/utils/geoFilter"
import { mapCategory, mapSeniority, colorForCompany } from "@/lib/utils/jobMapper"

const BASE = "https://himalayas.app/jobs/api"

const ENDPOINTS = [
  `${BASE}?limit=20`,
  `${BASE}/search?q=software+engineer&limit=20`,
  `${BASE}/search?q=product+manager&limit=10`,
  `${BASE}/search?q=data+analyst&limit=10`,
  `${BASE}/search?q=customer+support&limit=10`,
  `${BASE}/search?q=marketing&limit=10`,
  `${BASE}/search?q=finance&limit=10`,
] as const

export interface HimalayasJob {
  id:          string
  title:       string
  company:     string
  logoUrl:     string | null
  location:    string
  type:        string
  exp:         string
  salary:      string
  cat:         string
  color:       string
  applyUrl:    string
  badge:       "Verified" | "New" | "Hot"
  source:      string
  posted:      string
  verified:    boolean
}

/**
 * Stable, URL-path-safe identifier for ONE Himalayas job posting.
 *
 * FIX (strategy/internal-applications-admin-gate follow-up): the raw Himalayas
 * API response has no `id` field, and its `slug` is the COMPANY's slug — the
 * SAME value across every distinct posting from that company (verified live:
 * 5 different job titles from company "micro1" all returned `slug: "micro1"`).
 * The previous `j.slug || j.id` derivation therefore collided distinct jobs
 * from the same company onto one id — dropped in the in-request dedup `Set`
 * below and overwritten in `himalayas_jobs_cache` (upsert `onConflict:
 * "external_id"`, which was fed this same id).
 *
 * `guid` (Himalayas' own full permalink URL for that specific posting, e.g.
 * `https://himalayas.app/companies/micro1/jobs/backend-engineer`) IS unique
 * per job — verified the same way. This hashes it into a short, stable,
 * `[A-Za-z0-9:_.-]`-only id (matches the WFH ingestion's identical fix in
 * `himalayasWfhIngest.ts`, which already derives its id from `guid` this way;
 * duplicated in full here rather than imported, so this fix and the WFH
 * ingestion stay independent and neither can break the other).
 */
export function idFromGuid(guid: string): string {
  const hash = createHash("sha1").update(guid).digest("hex").slice(0, 32)
  return `himalayas:${hash}`
}

/**
 * Map ONE raw Himalayas API job object to this module's `HimalayasJob` shape,
 * applying the exact same filters/derivations `fetchHimalayasJobs()` always
 * has (scam keywords, India-eligibility, category/seniority/salary mapping) —
 * extracted to a pure function purely so the id fix is unit-testable without
 * a network call; no filter/field behavior changed. `seen` is the same
 * cross-endpoint dedup Set `fetchHimalayasJobs()` already used, now keyed by
 * the fixed per-job id instead of the collision-prone company slug.
 */
export function mapRawHimalayasJob(j: Record<string, unknown>, seen: Set<string>): HimalayasJob | null {
  const guid = j.guid as string | undefined
  if (!guid) return null
  const id = idFromGuid(guid)
  if (seen.has(id)) return null
  if (!j.title || !j.companyName) return null
  if (isScam({ title: j.title as string, company: j.companyName as string, description: j.excerpt as string ?? "" })) return null
  if (!isIndiaEligible((j.locationRestrictions as string[]) ?? [])) return null
  seen.add(id)
  return {
    id,
    title:    j.title as string,
    company:  j.companyName as string,
    logoUrl:  (j.companyLogo as string) ?? null,
    location: ((j.locationRestrictions as string[])?.join(" / ")) || "Remote — Worldwide",
    type:     (j.employmentType as string) || "Full Time",
    exp:      mapSeniority((j.seniority as string[]) ?? []),
    salary:   formatApiSalary(j),
    cat:      mapCategory((j.categories as string[]) ?? []),
    color:    colorForCompany(j.companyName as string),
    // The real per-job apply link when Himalayas gives one; otherwise guid —
    // Himalayas' own permalink for THIS posting — is the only honest fallback
    // (the previous fallback built a URL from the id, which is now an opaque
    // hash and was never a real per-job Himalayas URL even before this fix).
    applyUrl: (j.applicationLink as string) || guid,
    badge:    "New",
    source:   "Himalayas (Verified Remote)",
    posted:   "Recent",
    verified: true,
  }
}

export async function fetchHimalayasJobs(): Promise<HimalayasJob[]> {
  const seen    = new Set<string>()
  const results: HimalayasJob[] = []

  await Promise.allSettled(
    ENDPOINTS.map(async (url) => {
      const res  = await fetch(url, { next: { revalidate: 3600 } })
      if (!res.ok) return
      const data = await res.json() as { jobs?: Record<string, unknown>[] }
      ;(data.jobs ?? []).forEach((j: Record<string, unknown>) => {
        const mapped = mapRawHimalayasJob(j, seen)
        if (mapped) results.push(mapped)
      })
    })
  )

  return results
}

function formatApiSalary(j: Record<string, unknown>): string {
  const min = j.minSalary as number | undefined
  const max = j.maxSalary as number | undefined
  const cur = (j.currency as string) || "USD"
  if (!min && !max) return "Competitive"
  const fmt = (n: number) => cur === "USD" ? `$${Math.round(n / 1000)}K` : `₹${Math.round(n / 100000)}L`
  if (min && max) return `${fmt(min)}-${fmt(max)}/yr`
  return `${fmt(min || max!)}/yr`
}
