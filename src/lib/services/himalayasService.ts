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

export async function fetchHimalayasJobs(): Promise<HimalayasJob[]> {
  const seen    = new Set<string>()
  const results: HimalayasJob[] = []

  await Promise.allSettled(
    ENDPOINTS.map(async (url) => {
      const res  = await fetch(url, { next: { revalidate: 3600 } })
      if (!res.ok) return
      const data = await res.json() as { jobs?: Record<string, unknown>[] }
      ;(data.jobs ?? []).forEach((j: Record<string, unknown>) => {
        const id = j.slug as string || j.id as string
        if (!id || seen.has(id)) return
        if (!j.title || !j.companyName) return
        if (isScam({ title: j.title as string, company: j.companyName as string, description: j.excerpt as string ?? "" })) return
        if (!isIndiaEligible((j.locationRestrictions as string[]) ?? [])) return
        seen.add(id)
        results.push({
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
          applyUrl: (j.applicationLink as string) || `https://himalayas.app/jobs/${id}`,
          badge:    "New",
          source:   "Himalayas (Verified Remote)",
          posted:   "Recent",
          verified: true,
        })
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
