/**
 * City x category landing pages (e.g. /jobs-in-delhi/driver — "Driver Jobs in
 * Delhi"). Unlike the hand-authored city/category hubs in landingCities.ts /
 * landingCategories.ts (1500+ words of editorial content per page), these are
 * generated — so uniqueness comes from the REAL underlying data (actual job
 * count, actual companies, actual roles) rather than templated prose. A combo
 * with too few real+synthetic matches is gated out entirely (see
 * CITY_CATEGORY_MIN_JOBS) rather than shipped as a thin page — same principle
 * already used for empty govt category/qualification URLs in sitemap.ts.
 */
import { getJobs } from "@/lib/services/jobService"
import { CITY_LANDINGS } from "@/lib/data/landingCities"
import { PRIVATE_CATEGORIES, BLUE_COLLAR_CATEGORIES } from "@/lib/data/jobInventory"
import type { CityLanding } from "@/lib/seo/landingTypes"
import type { LandingJobBlocks } from "@/lib/seo/landing"
import type { LandingView, FaqItem } from "@/lib/seo/landingTypes"
import { jobDetailHref } from "@/lib/jobs/provenance"
import type { Job } from "@/types/job"

/** A page below this real job count is not generated — gate, not a thin page. */
export const CITY_CATEGORY_MIN_JOBS = 3

/** Real category labels that exist on generated job rows (see jobInventory.ts). */
export const CITY_CATEGORY_LIST: readonly string[] = [...PRIVATE_CATEGORIES, ...BLUE_COLLAR_CATEGORIES]

export function categoryToSlug(label: string): string {
  return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

const SLUG_TO_CATEGORY = new Map(CITY_CATEGORY_LIST.map(label => [categoryToSlug(label), label]))

export function categoryFromSlug(slug: string): string | undefined {
  return SLUG_TO_CATEGORY.get(slug)
}

export function getCityBySlug(slug: string): CityLanding | undefined {
  return CITY_LANDINGS.find(c => c.slug === slug)
}

const privateCard = (j: Job) => ({
  href: jobDetailHref("private", j),
  title: j.title,
  company: j.company,
  meta: [j.location, j.salary].filter(Boolean).join(" · "),
  badge: j.badge,
})

/** Fetch jobs for a city+category combo. Also used to decide the min-count gate. */
export async function getCityCategoryJobs(city: CityLanding, categoryLabel: string, limit = 24): Promise<Job[]> {
  const r = await getJobs({ location: city.locationQuery, category: categoryLabel, limit, sort: "latest" })
  return r.jobs
}

/**
 * Build the LandingView from real fetched jobs — content is data-derived, not
 * templated prose. `qualifyingCategorySlugsInCity` must be pre-verified via
 * getQualifyingCategorySlugsForCity — internal links only ever point at
 * combos confirmed to clear the minimum-job gate, never a possible 404.
 */
export function buildCityCategoryView(
  city: CityLanding,
  categoryLabel: string,
  jobs: Job[],
  qualifyingCategorySlugsInCity: string[] = [],
): LandingView {
  const slug = `${city.slug}/${categoryToSlug(categoryLabel)}`
  const count = jobs.length
  const companies = [...new Set(jobs.map(j => j.company).filter(Boolean))].slice(0, 8)
  const titles = [...new Set(jobs.map(j => j.title).filter(Boolean))].slice(0, 8)

  const faqs: FaqItem[] = [
    {
      q: `How many ${categoryLabel} jobs are there in ${city.city}?`,
      a: `There are currently ${count}+ ${categoryLabel} openings listed for ${city.city} on Noble Job, updated regularly. Browse the live listings on this page for the latest postings.`,
    },
    {
      q: `Which companies are hiring for ${categoryLabel} roles in ${city.city}?`,
      a: companies.length
        ? `Employers currently listing ${categoryLabel} openings in ${city.city} include ${companies.slice(0, 5).join(", ")}, among others. See the full list below.`
        : `Check the live listings on this page for employers currently hiring for ${categoryLabel} roles in ${city.city}.`,
    },
    {
      q: `Is there any fee to apply for ${categoryLabel} jobs in ${city.city}?`,
      a: "No. Noble Job never charges candidates, and genuine employers never ask for a fee to apply or interview. Report any such demand as a scam.",
    },
    {
      q: `How do I apply for ${categoryLabel} jobs in ${city.city} on Noble Job?`,
      a: `Browse the ${categoryLabel} listings for ${city.city} on this page, click "Apply Now" on a role that fits, and complete the application with an updated resume.`,
    },
  ]

  return {
    slug,
    accent: city.accent,
    breadcrumb: [
      { label: "Home", href: "/" },
      { label: `Jobs in ${city.city}`, href: `/${city.slug}` },
      { label: `${categoryLabel} Jobs` },
    ],
    h1: `${categoryLabel} Jobs in ${city.city}`,
    heroSubtitle: `${count}+ ${categoryLabel} openings in ${city.city}, updated regularly.`,
    heroBadges: [city.city, categoryLabel, "Updated Regularly", `${city.state}`],
    intro: [
      `Looking for ${categoryLabel} jobs in ${city.city}? This page lists current ${categoryLabel} openings in ${city.city} on Noble Job` +
        (companies.length ? `, from employers including ${companies.slice(0, 3).join(", ")}.` : "."),
      titles.length
        ? `Roles currently listed include ${titles.slice(0, 4).join(", ")}, among others — browse the full list below and apply directly.`
        : `Browse the full list below and apply directly to roles that match your experience.`,
    ],
    sections: [
      {
        id: "roles",
        icon: "#",
        title: `${categoryLabel} Roles Currently Listed in ${city.city}`,
        chips: titles.length ? titles : [`${categoryLabel} openings updated regularly`],
      },
      ...(companies.length
        ? [{
            id: "employers",
            icon: "*",
            title: `Employers Hiring for ${categoryLabel} in ${city.city}`,
            chips: companies,
          }]
        : []),
    ],
    faqs,
    // Only ever link to combos already confirmed to clear the min-job gate —
    // never a slug that might 404.
    relatedCategories: qualifyingCategorySlugsInCity
      .filter(slug => slug !== categoryToSlug(categoryLabel))
      .slice(0, 4)
      .map(slug => ({ label: `${categoryFromSlug(slug) || slug} Jobs in ${city.city}`, href: `/${city.slug}/${slug}` })),
    relatedCities: [
      { label: `All Jobs in ${city.city}`, href: `/${city.slug}` },
      { label: `Browse Private Jobs`, href: "/jobs/private" },
    ],
    relatedGuides: [],
    govtStateLink: city.govtStateSlug ? { label: `${city.state} Government Jobs`, href: `/jobs/govt/state/${city.govtStateSlug}` } : undefined,
    jobsHref: `/jobs/private?location=${encodeURIComponent(city.locationQuery)}&category=${encodeURIComponent(categoryLabel)}`,
    jobsLabel: `Browse All ${categoryLabel} Jobs in ${city.city}`,
  }
}

export function buildCityCategoryJobBlocks(jobs: Job[]): LandingJobBlocks {
  const cards = jobs.map(privateCard)
  return { latest: cards.slice(0, 8), trending: cards.slice(8, 16) }
}

/** Category slugs (for a given city) that clear CITY_CATEGORY_MIN_JOBS — used
 * by both generateStaticParams (build) and the sitemap (so the two can never
 * disagree about which combos are "real"). */
export async function getQualifyingCategorySlugsForCity(city: CityLanding): Promise<string[]> {
  const results = await Promise.all(
    CITY_CATEGORY_LIST.map(async label => {
      const jobs = await getCityCategoryJobs(city, label, CITY_CATEGORY_MIN_JOBS)
      return { label, qualifies: jobs.length >= CITY_CATEGORY_MIN_JOBS }
    }),
  )
  return results.filter(r => r.qualifies).map(r => categoryToSlug(r.label))
}
