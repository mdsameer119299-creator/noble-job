/**
 * Tail-city hub pages (/jobs-in/[city]) — the long tail beyond the 8
 * hand-authored city pages in landingCities.ts. Content is entirely
 * data-derived (real job counts, real companies/roles/categories currently
 * listed for that city) rather than templated prose, and a city below the
 * minimum real-job threshold is gated out rather than shipped as a thin
 * page — same principle as cityCategoryLanding.ts.
 */
import { getGenuineOpenJobs } from "@/lib/seo/genuineJobs"
import { TAIL_CITY_MIN_GENUINE_JOBS } from "@/lib/seo/indexThresholds"
import { TAIL_CITIES, getTailCityBySlug, type TailCityDef } from "@/lib/data/cityTaxonomy"
import { getQualifyingCategorySlugsForCity, categoryFromSlug } from "@/lib/seo/cityCategoryLanding"
import { jobDetailHref } from "@/lib/jobs/provenance"
import { joinReal, displayValue } from "@/lib/jobs/renderable"
import type { LandingView, FaqItem } from "@/lib/seo/landingTypes"
import type { LandingJobBlocks } from "@/lib/seo/landing"
import type { Job } from "@/types/job"

/**
 * A tail-city hub below this GENUINE open-job count is not generated — gate, not
 * a thin page. Synthetic / unclassified / archived rows do not count. Configurable:
 * SEO_MIN_GENUINE_JOBS_TAIL_CITY (see indexThresholds.ts).
 */
export const TAIL_CITY_MIN_JOBS = TAIL_CITY_MIN_GENUINE_JOBS

export { TAIL_CITIES, getTailCityBySlug }
export type { TailCityDef }

/**
 * GENUINE open jobs for a whole city (all categories). Also used to decide the
 * min-count gate and the counts/lists rendered on the page, so all three agree.
 */
export async function getTailCityJobs(city: TailCityDef, limit = 30): Promise<Job[]> {
  return getGenuineOpenJobs({ location: city.locationQuery, limit, sort: "latest" })
}

const privateCard = (j: Job) => ({
  href: jobDetailHref("private", j),
  title: j.title,
  company: j.company,
  meta: joinReal(j.location, j.salary),
  badge: displayValue(j.badge),
})

export function buildTailCityView(city: TailCityDef, jobs: Job[], qualifyingCategorySlugs: string[] = []): LandingView {
  const count = jobs.length
  const categories = [...new Set(jobs.map(j => j.cat).filter(Boolean))].slice(0, 10)
  const companies = [...new Set(jobs.map(j => j.company).filter(Boolean))].slice(0, 8)

  const faqs: FaqItem[] = [
    {
      q: `How many jobs are there in ${city.city}?`,
      a: `There are currently ${count}+ openings listed for ${city.city} on Noble Job, across categories including ${categories.slice(0, 4).join(", ") || "multiple industries"}. Browse the live listings on this page for the latest postings.`,
    },
    {
      q: `Which companies are hiring in ${city.city}?`,
      a: companies.length
        ? `Employers currently listing openings in ${city.city} include ${companies.slice(0, 5).join(", ")}, among others. See the full list below.`
        : `Check the live listings on this page for employers currently hiring in ${city.city}.`,
    },
    {
      q: `Is there any fee to apply for jobs in ${city.city}?`,
      a: "No. Noble Job never charges candidates, and genuine employers never ask for a fee to apply or interview. Report any such demand as a scam.",
    },
    {
      q: `How do I apply for jobs in ${city.city} on Noble Job?`,
      a: `Browse the listings for ${city.city} on this page, click "Apply Now" on a role that fits, and complete the application with an updated resume.`,
    },
  ]

  return {
    slug: `jobs-in/${city.slug}`,
    accent: city.accent,
    breadcrumb: [
      { label: "Home", href: "/" },
      { label: `Jobs in ${city.city}` },
    ],
    h1: `Jobs in ${city.city}`,
    heroSubtitle: `${count}+ openings in ${city.city}, ${city.state}, updated regularly.`,
    heroBadges: [city.city, city.state, "Updated Regularly"],
    intro: [
      `Looking for jobs in ${city.city}? This page lists current openings in ${city.city}, ${city.state} on Noble Job` +
        (companies.length ? `, from employers including ${companies.slice(0, 3).join(", ")}.` : "."),
      categories.length
        ? `Categories currently hiring in ${city.city} include ${categories.slice(0, 5).join(", ")}, among others — browse the full list below and apply directly.`
        : `Browse the full list below and apply directly to roles that match your experience.`,
    ],
    sections: [
      {
        id: "categories",
        icon: "#",
        title: `Job Categories Hiring in ${city.city}`,
        chips: categories.length ? categories : [`Openings in ${city.city} updated regularly`],
      },
      ...(companies.length
        ? [{
            id: "employers",
            icon: "*",
            title: `Employers Hiring in ${city.city}`,
            chips: companies,
          }]
        : []),
    ],
    faqs,
    relatedCategories: qualifyingCategorySlugs
      .slice(0, 6)
      .map(slug => ({ label: `${categoryFromSlug(slug) || slug} Jobs in ${city.city}`, href: `/jobs-in/${city.slug}/${slug}` })),
    relatedCities: TAIL_CITIES.filter(c => c.slug !== city.slug && c.state === city.state)
      .slice(0, 4)
      .map(c => ({ label: `Jobs in ${c.city}`, href: `/jobs-in/${c.slug}` })),
    relatedGuides: [],
    govtStateLink: city.govtStateSlug ? { label: `${city.state} Government Jobs`, href: `/jobs/govt/state/${city.govtStateSlug}` } : undefined,
    jobsHref: `/jobs/private?location=${encodeURIComponent(city.locationQuery)}`,
    jobsLabel: `Browse All Jobs in ${city.city}`,
  }
}

export function buildTailCityJobBlocks(jobs: Job[]): LandingJobBlocks {
  const cards = jobs.map(privateCard)
  return { latest: cards.slice(0, 8), trending: cards.slice(8, 16) }
}

/** Tail-city slugs that clear TAIL_CITY_MIN_JOBS — used by generateStaticParams and the sitemap. */
export async function getQualifyingTailCitySlugs(): Promise<string[]> {
  const results = await Promise.all(
    TAIL_CITIES.map(async city => {
      const jobs = await getTailCityJobs(city, TAIL_CITY_MIN_JOBS)
      return { slug: city.slug, qualifies: jobs.length >= TAIL_CITY_MIN_JOBS }
    }),
  )
  return results.filter(r => r.qualifies).map(r => r.slug)
}

/** Category slugs (for a given tail city) that clear the city x category gate. */
export async function getQualifyingCategorySlugsForTailCity(city: TailCityDef): Promise<string[]> {
  return getQualifyingCategorySlugsForCity(city)
}
