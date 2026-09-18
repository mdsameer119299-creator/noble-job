import type { MetadataRoute } from "next"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { GOVT_TOP_CATEGORIES, INDIAN_STATES, GOVT_QUALIFICATIONS } from "@/lib/config/govtTaxonomy"
import { getActiveGovtRows } from "@/lib/services/govtStatsSource"
import { getGovtJobsFiltered, getGovtContent } from "@/lib/services/govtJobService"
import { WFH_INVENTORY, ABROAD_INVENTORY } from "@/lib/data/jobInventory"
import { CATEGORY_SLUGS, CITY_SLUGS } from "@/lib/seo/landing"
import { CITY_LANDINGS } from "@/lib/data/landingCities"
import { getQualifyingCategorySlugsForCity } from "@/lib/seo/cityCategoryLanding"
import {
  TAIL_CITIES,
  getQualifyingTailCitySlugs,
  getQualifyingCategorySlugsForTailCity,
} from "@/lib/seo/tailCityLanding"
import { ARTICLE_SLUGS } from "@/lib/seo/articles"
import { siteUrl } from "@/lib/seo/constants"
import { isIndexable } from "@/lib/jobs/provenance"
import { govtClassifiable } from "@/lib/jobs/govtProvenance"

// Cache the generated sitemap for 1 hour. Its contents change at most hourly
// (govt ingestion cron), so per-request regeneration — which re-ran the govt
// and jobs queries on every bot fetch — is pure waste. Emergency egress fix.
export const revalidate = 3600

/**
 * Sitemap policy: every emitted URL must resolve to HTTP 200 with real content
 * AND represent a genuine opportunity. We therefore:
 *   • only list job URLs that pass the publication gate `isIndexable`
 *     (`src/lib/jobs/provenance.ts`): genuine provenance + currently open. This
 *     excludes ALL synthetic/demo inventory (private/WFH/abroad showcase rows)
 *     and any ARCHIVED (filled) role — their detail pages still return 200 for
 *     on-site browsing but are unlisted and noindex;
 *   • gate every govt category/qualification URL on a real result count so we
 *     never submit an empty listing (soft 404). State pages are always safe
 *     because the route falls back to the national pool;
 *   • drop any path that is the SOURCE of a 301 redirect (avoids redirect rows).
 */

// Keep in sync with redirects() in next.config.ts. A redirect *source* in the
// sitemap creates a redirect chain, so it must never be emitted.
const REDIRECT_SOURCE_PATHS = new Set<string>([
  "/jobs",
  "/jobs/govt/rrb-ntpc-graduate-level-recruitment-2026",
])

// Safety cap per board so a single sitemap stays well within the 50k-URL limit.
const PER_BOARD_LIMIT = 2000

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/jobs/private`, lastModified: now, changeFrequency: "hourly", priority: 0.95 },
    { url: `${base}/jobs/govt`, lastModified: now, changeFrequency: "daily", priority: 0.95 },
    { url: `${base}/jobs/wfh`, lastModified: now, changeFrequency: "daily", priority: 0.95 },
    { url: `${base}/jobs/abroad`, lastModified: now, changeFrequency: "daily", priority: 0.95 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.65 },
    { url: `${base}/editorial-policy`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/job-verification-policy`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/privacy-policy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ]

  // SEO landing hubs — category head-terms + city pages. These always render
  // content (config + live job blocks), so they are always indexable.
  const landingRoutes: MetadataRoute.Sitemap = [
    ...CATEGORY_SLUGS.map(slug => ({
      url: `${base}/${slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),
    ...CITY_SLUGS.map(slug => ({
      url: `${base}/${slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.85,
    })),
  ]

  // City x category pages (e.g. /jobs-in-delhi/driver) — only combos that clear
  // CITY_CATEGORY_MIN_JOBS real jobs are listed, same gate the pages themselves
  // enforce (getQualifyingCategorySlugsForCity is the single source of truth
  // for both, so the sitemap and the pages can never disagree).
  const cityCategoryRoutes: MetadataRoute.Sitemap = (
    await Promise.all(
      CITY_LANDINGS.map(async city => {
        const slugs = await getQualifyingCategorySlugsForCity(city)
        return slugs.map(categorySlug => ({
          url: `${base}/${city.slug}/${categorySlug}`,
          lastModified: now,
          changeFrequency: "weekly" as const,
          priority: 0.6,
        }))
      }),
    )
  ).flat()

  // Tail-city hubs (/jobs-in/[city]) — the long tail beyond the 8 hand-authored
  // city pages, gated on TAIL_CITY_MIN_JOBS real jobs (getQualifyingTailCitySlugs
  // is the single source of truth shared with generateStaticParams).
  const qualifyingTailCitySlugs = await getQualifyingTailCitySlugs()
  const tailCityRoutes: MetadataRoute.Sitemap = qualifyingTailCitySlugs.map(slug => ({
    url: `${base}/jobs-in/${slug}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.75,
  }))

  // Tail-city x category pages (/jobs-in/[city]/[category]) — same gate as
  // the hand-authored cities' city x category pages.
  const tailCityCategoryRoutes: MetadataRoute.Sitemap = (
    await Promise.all(
      TAIL_CITIES.map(async city => {
        const slugs = await getQualifyingCategorySlugsForTailCity(city)
        return slugs.map(categorySlug => ({
          url: `${base}/jobs-in/${city.slug}/${categorySlug}`,
          lastModified: now,
          changeFrequency: "weekly" as const,
          priority: 0.55,
        }))
      }),
    )
  ).flat()

  // Topical-authority guides — index + 10 article pages.
  const guideRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/guides`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/upload-resume`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    ...ARTICLE_SLUGS.map(slug => ({
      url: `${base}/guides/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ]

  // ── Govt taxonomy — only URLs that actually have content (no soft 404) ──
  const categoryCounts = await Promise.all(
    GOVT_TOP_CATEGORIES.map(async c => {
      const total =
        c.contentType === "jobs"
          ? (await getGovtJobsFiltered({ category: c.slug, page: 1 })).total
          : (await getGovtContent(c.contentType as Parameters<typeof getGovtContent>[0], { page: 1 })).total
      return { slug: c.slug, total }
    }),
  )
  const govtCategoryRoutes: MetadataRoute.Sitemap = categoryCounts
    .filter(c => c.total > 0)
    .map(c => ({
      url: `${base}/jobs/govt/category/${c.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.85,
    }))

  // State pages always resolve to content (national fallback when state-empty).
  const govtStateRoutes: MetadataRoute.Sitemap = INDIAN_STATES.map(s => ({
    url: `${base}/jobs/govt/state/${s.slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.8,
  }))

  const qualCounts = await Promise.all(
    GOVT_QUALIFICATIONS.map(async q => ({
      slug: q.slug,
      total: (await getGovtJobsFiltered({ qualification: q.slug, page: 1 })).total,
    })),
  )
  const govtQualRoutes: MetadataRoute.Sitemap = qualCounts
    .filter(q => q.total > 0)
    .map(q => ({
      url: `${base}/jobs/govt/qualification/${q.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.75,
    }))

  // ── Govt job detail pages — active rows that pass the fail-closed OFFICIAL
  //    gate (real official/notification URL), redirect sources removed ──
  const govtRows = await getActiveGovtRows()
  const govtJobRoutes: MetadataRoute.Sitemap = govtRows
    .filter(j => isIndexable(govtClassifiable(j)))
    .map(j => `/jobs/govt/${j.slug || j.id}`)
    .filter(path => !REDIRECT_SOURCE_PATHS.has(path))
    .map(path => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }))

  // ── WFH / Abroad — only genuine, currently-open rows are listed. The current
  //    inventory is synthetic showcase content, so these resolve to empty until
  //    real WFH/abroad sources are wired; their detail pages still 200 on-site. ──
  const wfhJobRoutes: MetadataRoute.Sitemap = WFH_INVENTORY.filter(isIndexable)
    .slice(0, PER_BOARD_LIMIT)
    .map(j => ({
      url: `${base}/jobs/wfh/${j.id}`,
      lastModified: new Date(j.posted_at || now),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }))

  const abroadJobRoutes: MetadataRoute.Sitemap = ABROAD_INVENTORY.filter(isIndexable)
    .slice(0, PER_BOARD_LIMIT)
    .map(j => ({
      url: `${base}/jobs/abroad/${j.id}`,
      lastModified: new Date(j.posted_at || now),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }))

  // ── Private — only genuine active DB rows are listed. Synthetic inventory is
  //    NOT a fallback here: demo rows must never be submitted to search engines.
  //    (Detail pages still 200 for on-site browsing; they're just unlisted.) ──
  let privateJobRoutes: MetadataRoute.Sitemap = []
  if (isSupabaseConfigured()) {
    try {
      // Cookie-LESS service-role read (same query/columns/filter as before). The
      // previous cookie-based client called cookies(), a dynamic API that would
      // force this route to render per-request in production and ignore the
      // `revalidate` above. Output is identical: only status=active rows that
      // pass the genuine-provenance gate are listed.
      const { supabaseAdmin } = await import("@/lib/supabase/admin")
      const { data: jobs } = await supabaseAdmin
        .from("jobs")
        .select("id, posted_at, provenance, apply_url, employer_id, is_verified, job_status")
        .eq("status", "active")
        .limit(PER_BOARD_LIMIT)
      privateJobRoutes = (jobs || [])
        .filter(job => {
          const r = job as Record<string, unknown>
          // Defense-in-depth: even an "active" DB row is only listed when it
          // passes the genuine-provenance publication gate (fail closed).
          return isIndexable({
            id: String(r.id),
            board: "private",
            provenance: r.provenance as string | undefined,
            apply_url: r.apply_url as string | undefined,
            employer_id: r.employer_id as string | undefined,
            is_verified: Boolean(r.is_verified),
            jobStatus: (r.job_status as string | undefined) ?? "LIVE_JOB",
          })
        })
        .map(job => ({
          url: `${base}/jobs/private/${(job as { id: string }).id}`,
          lastModified: new Date((job as { posted_at: string }).posted_at || now),
          changeFrequency: "weekly" as const,
          priority: 0.8,
        }))
    } catch {
      /* no private job URLs when the DB is unreachable */
    }
  }

  // De-duplicate by URL (defensive — a govt slug could echo a taxonomy path).
  const all = [
    ...staticRoutes,
    ...landingRoutes,
    ...cityCategoryRoutes,
    ...tailCityRoutes,
    ...tailCityCategoryRoutes,
    ...guideRoutes,
    ...govtCategoryRoutes,
    ...govtStateRoutes,
    ...govtQualRoutes,
    ...govtJobRoutes,
    ...wfhJobRoutes,
    ...abroadJobRoutes,
    ...privateJobRoutes,
  ]
  const seen = new Set<string>()
  return all.filter(e => {
    if (seen.has(e.url)) return false
    seen.add(e.url)
    return true
  })
}
