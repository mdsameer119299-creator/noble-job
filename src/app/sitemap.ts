import type { MetadataRoute } from "next"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { GOVT_TOP_CATEGORIES, INDIAN_STATES, GOVT_QUALIFICATIONS } from "@/lib/config/govtTaxonomy"
import { getActiveGovtRows } from "@/lib/services/govtStatsSource"
import { getGovtJobsFiltered, getGovtContent } from "@/lib/services/govtJobService"
import { WFH_INVENTORY, ABROAD_INVENTORY, PRIVATE_INVENTORY } from "@/lib/data/jobInventory"
import { CATEGORY_SLUGS, CITY_SLUGS } from "@/lib/seo/landing"
import { siteUrl } from "@/lib/seo/constants"

/**
 * Sitemap policy: every emitted URL must resolve to HTTP 200 with real content.
 * We therefore:
 *   • only list job URLs whose IDs actually resolve in the detail route's data
 *     source (live/verified inventory + active govt rows + active DB jobs);
 *   • exclude ARCHIVED demo vacancies (200 but "position filled" → soft 404);
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

const isIndexable = (j: { jobStatus?: string }) => j.jobStatus !== "ARCHIVED_JOB"

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

  // ── Govt job detail pages — active rows, redirect sources removed ──
  const govtRows = await getActiveGovtRows()
  const govtJobRoutes: MetadataRoute.Sitemap = govtRows
    .map(j => `/jobs/govt/${j.slug || j.id}`)
    .filter(path => !REDIRECT_SOURCE_PATHS.has(path))
    .map(path => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }))

  // ── WFH / Abroad — generated inventory IDs always resolve (DB → local
  //    fallback). Archived demo vacancies excluded. ──
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

  // ── Private — prefer active DB rows; fall back to live/verified inventory
  //    so the sitemap is never empty and every ID resolves to 200. ──
  let privateJobRoutes: MetadataRoute.Sitemap = []
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (supabase) {
        const { data: jobs } = await supabase
          .from("jobs")
          .select("id, posted_at")
          .eq("status", "active")
          .limit(PER_BOARD_LIMIT)
        privateJobRoutes = (jobs || []).map(job => ({
          url: `${base}/jobs/private/${(job as { id: string }).id}`,
          lastModified: new Date((job as { posted_at: string }).posted_at || now),
          changeFrequency: "weekly",
          priority: 0.8,
        }))
      }
    } catch {
      /* fall through to inventory */
    }
  }
  if (privateJobRoutes.length === 0) {
    privateJobRoutes = PRIVATE_INVENTORY.filter(isIndexable)
      .slice(0, PER_BOARD_LIMIT)
      .map(j => ({
        url: `${base}/jobs/private/${j.id}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.75,
      }))
  }

  // De-duplicate by URL (defensive — a govt slug could echo a taxonomy path).
  const all = [
    ...staticRoutes,
    ...landingRoutes,
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
