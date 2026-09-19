import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { LandingPage } from "@/components/landing/LandingPage"
import {
  getTailCityBySlug,
  getTailCityJobs,
  buildTailCityView,
  buildTailCityJobBlocks,
  getQualifyingCategorySlugsForTailCity,
  TAIL_CITY_MIN_JOBS,
} from "@/lib/seo/tailCityLanding"
import {
  categoryFromSlug,
  getCityCategoryJobs,
  buildCityCategoryView,
  buildCityCategoryJobBlocks,
  CITY_CATEGORY_MIN_JOBS,
} from "@/lib/seo/cityCategoryLanding"

export async function tailCityMetadata(citySlug: string): Promise<Metadata> {
  const city = getTailCityBySlug(citySlug)
  if (!city) {
    return buildPageMetadata({ title: "Jobs Not Found — Noble Job", description: "This city page could not be found.", path: `/jobs-in/${citySlug}`, noIndex: true })
  }
  // Fetched at the page body's default limit (not the TAIL_CITY_MIN_JOBS gate
  // limit) so the title/description show the same real count the page renders,
  // instead of an artificial "5+" on every qualifying city regardless of its
  // actual total.
  const jobs = await getTailCityJobs(city)
  if (jobs.length < TAIL_CITY_MIN_JOBS) {
    return buildPageMetadata({ title: `Jobs in ${city.city} — Noble Job`, description: `Jobs in ${city.city}, ${city.state}.`, path: `/jobs-in/${citySlug}`, noIndex: true })
  }
  return buildPageMetadata({
    title: `Jobs in ${city.city} 2026 — ${jobs.length}+ Openings | Noble Job`,
    description: `Find the latest jobs in ${city.city}, ${city.state} — ${jobs.length}+ current openings. See how to apply for each listing on Noble Job.`,
    path: `/jobs-in/${citySlug}`,
    keywords: [`jobs in ${city.city}`, `${city.city} jobs`, `${city.city} vacancies`, `private jobs in ${city.city}`],
  })
}

/**
 * Below the minimum real-job-count threshold, the page 404s rather than
 * rendering thin content — enforced here (not just in generateStaticParams)
 * so a direct hit on an under-threshold URL can never serve a live page.
 */
export async function TailCityRoute({ citySlug }: { citySlug: string }) {
  const city = getTailCityBySlug(citySlug)
  if (!city) notFound()

  const jobs = await getTailCityJobs(city)
  if (jobs.length < TAIL_CITY_MIN_JOBS) notFound()

  const qualifyingCategories = await getQualifyingCategorySlugsForTailCity(city)
  const view = buildTailCityView(city, jobs, qualifyingCategories)
  const blocks = buildTailCityJobBlocks(jobs)
  return <LandingPage view={view} jobs={blocks} />
}

export async function tailCityCategoryMetadata(citySlug: string, categorySlugParam: string): Promise<Metadata> {
  const city = getTailCityBySlug(citySlug)
  const categoryLabel = categoryFromSlug(categorySlugParam)
  if (!city || !categoryLabel) {
    return buildPageMetadata({ title: "Jobs Not Found — Noble Job", description: "This job category could not be found.", path: `/jobs-in/${citySlug}/${categorySlugParam}`, noIndex: true })
  }
  const jobs = await getCityCategoryJobs(city, categoryLabel)
  if (jobs.length < CITY_CATEGORY_MIN_JOBS) {
    return buildPageMetadata({ title: `${categoryLabel} Jobs in ${city.city} — Noble Job`, description: `${categoryLabel} jobs in ${city.city}.`, path: `/jobs-in/${citySlug}/${categorySlugParam}`, noIndex: true })
  }
  return buildPageMetadata({
    title: `${categoryLabel} Jobs in ${city.city} 2026 — ${jobs.length}+ Openings | Noble Job`,
    description: `Find ${categoryLabel} jobs in ${city.city} — ${jobs.length}+ current openings. See how to apply for each listing on Noble Job.`,
    path: `/jobs-in/${citySlug}/${categorySlugParam}`,
    keywords: [`${categoryLabel} jobs in ${city.city}`, `${categoryLabel} jobs ${city.city}`, `${city.city} ${categoryLabel} vacancies`],
  })
}

export async function TailCityCategoryRoute({ citySlug, categorySlug }: { citySlug: string; categorySlug: string }) {
  const city = getTailCityBySlug(citySlug)
  const categoryLabel = categoryFromSlug(categorySlug)
  if (!city || !categoryLabel) notFound()

  const jobs = await getCityCategoryJobs(city, categoryLabel)
  if (jobs.length < CITY_CATEGORY_MIN_JOBS) notFound()

  const qualifyingSlugs = await getQualifyingCategorySlugsForTailCity(city)
  const view = buildCityCategoryView({ ...city, hrefBase: `/jobs-in/${city.slug}` }, categoryLabel, jobs, qualifyingSlugs)
  const blocks = buildCityCategoryJobBlocks(jobs)
  return <LandingPage view={view} jobs={blocks} />
}
