import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { LandingPage } from "@/components/landing/LandingPage"
import {
  getCityBySlug,
  categoryFromSlug,
  getCityCategoryJobs,
  buildCityCategoryView,
  buildCityCategoryJobBlocks,
  getQualifyingCategorySlugsForCity,
  CITY_CATEGORY_MIN_JOBS,
} from "@/lib/seo/cityCategoryLanding"

export async function cityCategoryMetadata(citySlug: string, categorySlugParam: string): Promise<Metadata> {
  const city = getCityBySlug(citySlug)
  const categoryLabel = categoryFromSlug(categorySlugParam)
  if (!city || !categoryLabel) {
    return buildPageMetadata({ title: "Jobs Not Found — Noble Job", description: "This job category could not be found.", path: `/${citySlug}/${categorySlugParam}`, noIndex: true })
  }
  const jobs = await getCityCategoryJobs(city, categoryLabel)
  if (jobs.length < CITY_CATEGORY_MIN_JOBS) {
    return buildPageMetadata({ title: `${categoryLabel} Jobs in ${city.city} — Noble Job`, description: `${categoryLabel} jobs in ${city.city}.`, path: `/${citySlug}/${categorySlugParam}`, noIndex: true })
  }
  return buildPageMetadata({
    title: `${categoryLabel} Jobs in ${city.city} 2026 — ${jobs.length}+ Openings | Noble Job`,
    description: `Find ${categoryLabel} jobs in ${city.city} — ${jobs.length}+ current openings. See how to apply for each listing on Noble Job.`,
    path: `/${citySlug}/${categorySlugParam}`,
    keywords: [`${categoryLabel} jobs in ${city.city}`, `${categoryLabel} jobs ${city.city}`, `${city.city} ${categoryLabel} vacancies`],
  })
}

/**
 * Below the minimum real-job-count threshold, the page 404s rather than
 * rendering thin content — enforced here (not just in generateStaticParams)
 * so a direct hit on an under-threshold URL can never serve a live page.
 */
export async function CityCategoryRoute({ citySlug, categorySlug }: { citySlug: string; categorySlug: string }) {
  const city = getCityBySlug(citySlug)
  const categoryLabel = categoryFromSlug(categorySlug)
  if (!city || !categoryLabel) notFound()

  const jobs = await getCityCategoryJobs(city, categoryLabel)
  if (jobs.length < CITY_CATEGORY_MIN_JOBS) notFound()

  const qualifyingSlugs = await getQualifyingCategorySlugsForCity(city)
  const view = buildCityCategoryView(city, categoryLabel, jobs, qualifyingSlugs)
  const blocks = buildCityCategoryJobBlocks(jobs)
  return <LandingPage view={view} jobs={blocks} />
}
