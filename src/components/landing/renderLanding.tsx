import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { getCategoryLanding, getCityLanding, buildLandingView, fetchLandingJobs } from "@/lib/seo/landing"
import { getQualifyingCategorySlugsForCity, categoryFromSlug } from "@/lib/seo/cityCategoryLanding"
import { LandingPage } from "@/components/landing/LandingPage"
import type { Landing } from "@/lib/seo/landingTypes"

function resolve(slug: string): Landing | undefined {
  return getCategoryLanding(slug) ?? getCityLanding(slug)
}

export function landingMetadata(slug: string): Metadata {
  const cfg = resolve(slug)
  if (!cfg) return { title: "Jobs — Noble Job" }
  return buildPageMetadata({
    title: cfg.metaTitle,
    description: cfg.metaDescription,
    path: `/${slug}`,
    keywords: cfg.keywords,
  })
}

export async function LandingRoute({ slug }: { slug: string }) {
  const cfg = resolve(slug)
  if (!cfg) notFound()
  const [view, jobs] = await Promise.all([
    Promise.resolve(buildLandingView(cfg)),
    fetchLandingJobs(cfg),
  ])

  // City hubs connect down to their city x category pages (e.g. Jobs in Delhi
  // -> Driver Jobs in Delhi) — only combos already confirmed to clear the
  // minimum-job gate, so this can never link to a 404.
  if (cfg.kind === "city") {
    const qualifyingSlugs = await getQualifyingCategorySlugsForCity(cfg)
    if (qualifyingSlugs.length) {
      view.relatedCategories = [
        ...view.relatedCategories,
        ...qualifyingSlugs.slice(0, 8).map(s => ({ label: `${categoryFromSlug(s) || s} Jobs in ${cfg.city}`, href: `/${cfg.slug}/${s}` })),
      ]
    }
  }

  return <LandingPage view={view} jobs={jobs} />
}
