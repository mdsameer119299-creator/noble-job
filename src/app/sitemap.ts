import type { MetadataRoute } from "next"
import { GOVT_TOP_CATEGORIES, INDIAN_STATES, GOVT_QUALIFICATIONS } from "@/lib/config/govtTaxonomy"
import { getActiveGovtRowsStrict } from "@/lib/services/govtStatsSource"
import { getGovtJobsFiltered, getGovtContent } from "@/lib/services/govtJobService"
import { CATEGORY_SLUGS, CITY_SLUGS } from "@/lib/seo/landing"
import { CITY_LANDINGS } from "@/lib/data/landingCities"
import { getQualifyingCategorySlugsForCityFromSnapshot } from "@/lib/seo/cityCategoryLanding"
import {
  TAIL_CITIES,
  getQualifyingTailCitySlugsFromSnapshot,
  getQualifyingCategorySlugsForTailCityFromSnapshot,
} from "@/lib/seo/tailCityLanding"
import { getGenuineOpenJobsSnapshot } from "@/lib/seo/genuineJobs"
import { ARTICLE_SLUGS, getArticle } from "@/lib/seo/articles"
import { siteUrl } from "@/lib/seo/constants"
import { isIndexable } from "@/lib/jobs/provenance"
import { govtClassifiable } from "@/lib/jobs/govtProvenance"
import { GOVT_STATE_MIN_JOBS } from "@/lib/seo/indexThresholds"
import { readSitemapJobRows, SITEMAP_ROWS_PER_BOARD } from "@/lib/seo/sitemapJobs"
import {
  finalizeSitemap,
  jobRowsToSitemapEntries,
  latestDate,
  toLastModified,
  type SitemapEntry,
  type SitemapJobBoard,
} from "@/lib/seo/sitemapPolicy"
import { readOrThrow } from "@/lib/seo/sitemapReadGuard"
import type { GovtJob } from "@/types/govtJob"

// Cache the generated sitemap for 1 hour. Its contents change at most hourly
// (govt ingestion), so per-request regeneration — which re-ran the govt and
// jobs queries on every bot fetch — is pure waste.
export const revalidate = 3600

/**
 * Sitemap policy (rules live in `src/lib/seo/sitemapPolicy.ts`, pinned by
 * `sitemapPolicy.test.ts`):
 *
 *   • Every URL is canonical, has no query string and resolves to real content.
 *   • Job URLs are listed only when the row is GENUINE and currently OPEN (the same
 *     `isIndexable` gate the detail page's robots + JobPosting use). Synthetic,
 *     unclassified, closed, archived and deadline-expired rows are never listed.
 *   • Private / WFH / abroad jobs are read from Supabase — NOT from the local
 *     synthetic inventory — so a real job posted to any board is listed.
 *   • `lastmod` is a REAL content-change date (a govt record's `content_changed_at`,
 *     an article's `dateModified`, a govt hub's newest child) or it is OMITTED. It is
 *     never the generation time, and never a job row's `posted_at` (that is the
 *     INSERTION time — an ingestion run would look like a content change). Private /
 *     WFH / abroad job URLs and their hubs therefore carry NO lastmod: their tables
 *     store no content-change date.
 *   • Auth, API, dashboard and 404 paths, redirect sources, filtered and paginated
 *     variants are excluded.
 *   • If the database cannot be read the generation FAILS, so the previously good
 *     sitemap keeps being served instead of one with every job URL missing. (During
 *     `next build` there is no live database in CI, so the dynamic sections are
 *     skipped rather than failing the build; ISR regenerates them within an hour.)
 *   • One sitemap file: the URL count is far below the 50,000 limit, so splitting
 *     into child sitemaps would add moving parts for no benefit yet.
 */

// Keep in sync with redirects() in next.config.ts. A redirect *source* in the
// sitemap creates a redirect chain, so it must never be emitted.
const REDIRECT_SOURCE_PATHS = new Set<string>([
  "/jobs",
  "/jobs/govt/rrb-ntpc-graduate-level-recruitment-2026",
])

const govtChangedAt = (j: GovtJob, now: Date) => toLastModified([j.contentChangedAt], now)

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()
  const now = new Date() // used ONLY to reject future-dated data — never written as lastmod

  // ── Genuine job rows (Supabase) ──────────────────────────────────────────
  const boards: SitemapJobBoard[] = ["private", "wfh", "abroad"]
  const jobEntries = {} as Record<SitemapJobBoard, SitemapEntry[]>
  for (const b of boards) {
    const rows = await readOrThrow(() => readSitemapJobRows(b), [], `${b} jobs`)
    jobEntries[b] = jobRowsToSitemapEntries(b, rows, base, { now, limit: SITEMAP_ROWS_PER_BOARD })
  }

  // ── Govt pool (strict: throws when unavailable) ──────────────────────────
  const govtRows = await readOrThrow(() => getActiveGovtRowsStrict(), [] as GovtJob[], "govt pool")
  const govtIndexable = govtRows.filter(j => isIndexable(govtClassifiable(j)))

  // Only government records store a real content-change date. Private / WFH / abroad
  // rows do not, so their hubs have no lastmod either (nothing to take the newest of).
  const newestGovt = latestDate(govtIndexable.map(j => govtChangedAt(j, now)))

  // Static pages carry no real modification date → no lastmod. The government hub and
  // the homepage take the newest real government content change they show.
  const staticRoutes: SitemapEntry[] = [
    { url: base, lastModified: newestGovt, changeFrequency: "daily", priority: 1 },
    { url: `${base}/jobs/private`, changeFrequency: "hourly", priority: 0.95 },
    { url: `${base}/jobs/govt`, lastModified: newestGovt, changeFrequency: "daily", priority: 0.95 },
    { url: `${base}/jobs/wfh`, changeFrequency: "daily", priority: 0.95 },
    { url: `${base}/jobs/abroad`, changeFrequency: "daily", priority: 0.95 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.65 },
    { url: `${base}/editorial-policy`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/job-verification-policy`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/privacy-policy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ]

  // SEO landing hubs — category head-terms + city pages. Existing pages only; no
  // per-page modification date exists, so no lastmod.
  const landingRoutes: SitemapEntry[] = [
    ...CATEGORY_SLUGS.map(slug => ({ url: `${base}/${slug}`, changeFrequency: "daily" as const, priority: 0.9 })),
    ...CITY_SLUGS.map(slug => ({ url: `${base}/${slug}`, changeFrequency: "daily" as const, priority: 0.85 })),
  ]

  // ── Private-job snapshot (one DB call) ──────────────────────────────────────
  // City×category and tail-city×category qualifying checks used to run ~1,396
  // individual Supabase queries per ISR regeneration — the same fan-out that
  // caused BUILD_UTILS_SPAWN_1 in the build phase. The snapshot loads all genuine
  // open private-board jobs in a single bounded query; eligibility is then derived
  // in memory from the shared pool.
  //
  // If the snapshot fetch fails at runtime, readOrThrow re-throws and ISR keeps the
  // previously generated sitemap rather than publishing one with these sections empty.
  // During build phase, readOrThrow returns the null sentinel immediately and all
  // three derived sections return [].
  const privateSnapshot = await readOrThrow(
    () => getGenuineOpenJobsSnapshot(),
    null,
    "private-jobs snapshot",
  )

  if (privateSnapshot?.capped) {
    console.warn(
      `[sitemap] private-jobs snapshot hit the cap (${privateSnapshot.jobs.length} rows). ` +
      `Some city/category combinations may be missing. ` +
      `Raise SITEMAP_SNAPSHOT_LIMIT (current default: 3000) if this is unexpected.`,
    )
  }

  // City x category pages — only combos that clear the GENUINE-job threshold (the
  // same function the pages themselves use, so sitemap and page cannot disagree).
  // Derived from the shared snapshot: 0 extra DB calls instead of ~304.
  const cityCategoryRoutes: SitemapEntry[] = privateSnapshot
    ? CITY_LANDINGS.flatMap(city => {
        const slugs = getQualifyingCategorySlugsForCityFromSnapshot(city, privateSnapshot)
        return slugs.map(categorySlug => ({
          url: `${base}/${city.slug}/${categorySlug}`,
          changeFrequency: "weekly" as const,
          priority: 0.6,
        }))
      })
    : []

  // Tail-city hubs and tail-city x category pages — same genuine-only gate.
  // Derived from the shared snapshot: 0 extra DB calls instead of ~1,092.
  const qualifyingTailCitySlugs: string[] = privateSnapshot
    ? getQualifyingTailCitySlugsFromSnapshot(privateSnapshot)
    : []
  const tailCityRoutes: SitemapEntry[] = qualifyingTailCitySlugs.map(slug => ({
    url: `${base}/jobs-in/${slug}`,
    changeFrequency: "daily" as const,
    priority: 0.75,
  }))
  const tailCityCategoryRoutes: SitemapEntry[] = privateSnapshot
    ? TAIL_CITIES.flatMap(city => {
        const slugs = getQualifyingCategorySlugsForTailCityFromSnapshot(city, privateSnapshot)
        return slugs.map(categorySlug => ({
          url: `${base}/jobs-in/${city.slug}/${categorySlug}`,
          changeFrequency: "weekly" as const,
          priority: 0.55,
        }))
      })
    : []

  // Guides — the article's own published / modified dates.
  const articleDates = ARTICLE_SLUGS.map(slug => {
    const a = getArticle(slug)
    return { slug, at: toLastModified([a?.dateModified, a?.datePublished], now) }
  })
  const guideRoutes: SitemapEntry[] = [
    { url: `${base}/guides`, lastModified: latestDate(articleDates.map(a => a.at)), changeFrequency: "weekly", priority: 0.8 },
    ...articleDates.map(a => ({
      url: `${base}/guides/${a.slug}`,
      lastModified: a.at,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ]

  // ── Govt taxonomy — only URLs that actually have content (no soft 404) ──
  // Each section calls getGovtJobsFiltered (DB-backed); wrapped in readOrThrow so
  // the build doesn't fail when the database is unavailable. ISR regenerates within
  // revalidate seconds.
  const govtCategoryRoutes: SitemapEntry[] = await readOrThrow(async () => {
    const categoryRows = await Promise.all(
      GOVT_TOP_CATEGORIES.map(async c => {
        if (c.contentType === "jobs") {
          const r = await getGovtJobsFiltered({ category: c.slug, page: 1, limit: 100000 })
          return { slug: c.slug, total: r.total, at: latestDate(r.items.map(j => govtChangedAt(j, now))) }
        }
        const r = await getGovtContent(c.contentType as Parameters<typeof getGovtContent>[0], { page: 1 })
        return { slug: c.slug, total: r.total, at: undefined as Date | undefined }
      }),
    )
    return categoryRows
      .filter(c => c.total > 0)
      .map(c => ({
        url: `${base}/jobs/govt/category/${c.slug}`,
        lastModified: c.at,
        changeFrequency: "daily" as const,
        priority: 0.85,
      }))
  }, [] as SitemapEntry[], "govt category pages")

  // State pages: listed only when the state has its own openings. A state with
  // none falls back to the national pool and is served noindex, so it must not
  // be submitted.
  const govtStateRoutes: SitemapEntry[] = await readOrThrow(async () => {
    const stateRows = await Promise.all(
      INDIAN_STATES.map(async s => {
        const r = await getGovtJobsFiltered({ state: s.slug, page: 1, limit: 100000 })
        return { slug: s.slug, total: r.total, at: latestDate(r.items.map(j => govtChangedAt(j, now))) }
      }),
    )
    return stateRows
      .filter(s => s.total >= GOVT_STATE_MIN_JOBS)
      .map(s => ({
        url: `${base}/jobs/govt/state/${s.slug}`,
        lastModified: s.at,
        changeFrequency: "daily" as const,
        priority: 0.8,
      }))
  }, [] as SitemapEntry[], "govt state pages")

  const govtQualRoutes: SitemapEntry[] = await readOrThrow(async () => {
    const qualRows = await Promise.all(
      GOVT_QUALIFICATIONS.map(async q => {
        const r = await getGovtJobsFiltered({ qualification: q.slug, page: 1, limit: 100000 })
        return { slug: q.slug, total: r.total, at: latestDate(r.items.map(j => govtChangedAt(j, now))) }
      }),
    )
    return qualRows
      .filter(q => q.total > 0)
      .map(q => ({
        url: `${base}/jobs/govt/qualification/${q.slug}`,
        lastModified: q.at,
        changeFrequency: "weekly" as const,
        priority: 0.75,
      }))
  }, [] as SitemapEntry[], "govt qualification pages")

  // ── Govt detail pages — active rows that pass the fail-closed OFFICIAL gate. ──
  const govtJobRoutes: SitemapEntry[] = govtIndexable.map(j => ({
    url: `${base}/jobs/govt/${j.slug || j.id}`,
    lastModified: govtChangedAt(j, now),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }))

  const all: SitemapEntry[] = [
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
    ...jobEntries.wfh,
    ...jobEntries.abroad,
    ...jobEntries.private,
  ]

  // Final safety net: drops query-string, authentication, API and redirect-source URLs plus duplicates.
  return finalizeSitemap(all, { base, redirectSources: REDIRECT_SOURCE_PATHS }) as MetadataRoute.Sitemap
}
