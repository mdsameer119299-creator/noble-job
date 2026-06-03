import type { MetadataRoute } from "next"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { GOVT_TOP_CATEGORIES, INDIAN_STATES, GOVT_QUALIFICATIONS } from "@/lib/config/govtTaxonomy"
import { GOVT_JOBS } from "@/lib/data/govtData"
import { FALLBACK_WFH_JOBS, FALLBACK_ABROAD_JOBS } from "@/lib/data/fallbackJobs"
import { siteUrl } from "@/lib/seo/constants"

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
  ]

  const govtCategoryRoutes: MetadataRoute.Sitemap = GOVT_TOP_CATEGORIES.map(c => ({
    url: `${base}/jobs/govt/category/${c.slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.85,
  }))

  const govtStateRoutes: MetadataRoute.Sitemap = INDIAN_STATES.map(s => ({
    url: `${base}/jobs/govt/state/${s.slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.8,
  }))

  const govtQualRoutes: MetadataRoute.Sitemap = GOVT_QUALIFICATIONS.map(q => ({
    url: `${base}/jobs/govt/qualification/${q.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.75,
  }))

  const govtJobRoutes: MetadataRoute.Sitemap = GOVT_JOBS.map(j => ({
    url: `${base}/jobs/govt/${j.slug || j.id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }))

  const wfhJobRoutes: MetadataRoute.Sitemap = FALLBACK_WFH_JOBS.slice(0, 120).map(j => ({
    url: `${base}/jobs/wfh/${j.id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.75,
  }))

  const abroadJobRoutes: MetadataRoute.Sitemap = FALLBACK_ABROAD_JOBS.slice(0, 120).map(j => ({
    url: `${base}/jobs/abroad/${j.id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.75,
  }))

  let privateJobRoutes: MetadataRoute.Sitemap = []
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      if (supabase) {
        const { data: jobs } = await supabase
          .from("jobs")
          .select("id, posted_at")
          .eq("status", "active")
          .limit(2000)
        privateJobRoutes = (jobs || []).map(job => ({
          url: `${base}/jobs/private/${(job as { id: string }).id}`,
          lastModified: new Date((job as { posted_at: string }).posted_at || now),
          changeFrequency: "weekly",
          priority: 0.8,
        }))
      }
    } catch {
      /* static + taxonomy routes only */
    }
  }

  return [
    ...staticRoutes,
    ...govtCategoryRoutes,
    ...govtStateRoutes,
    ...govtQualRoutes,
    ...govtJobRoutes,
    ...wfhJobRoutes,
    ...abroadJobRoutes,
    ...privateJobRoutes,
  ]
}
