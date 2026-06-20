import { CATEGORY_LANDINGS } from "@/lib/data/landingCategories"
import { CITY_LANDINGS } from "@/lib/data/landingCities"
import { LANDING_CLOSINGS } from "@/lib/data/landingClosings"
import { getHubGuides } from "@/lib/seo/articles"
import { getGovtJobs } from "@/lib/services/govtJobService"
import { getJobs } from "@/lib/services/jobService"
import { getWfhJobs } from "@/lib/services/wfhJobService"
import { getAbroadJobs } from "@/lib/services/abroadJobService"
import type { CategoryLanding, CityLanding, Landing, LandingJobCard, LandingView } from "@/lib/seo/landingTypes"

const CATEGORY_BY_SLUG = new Map(CATEGORY_LANDINGS.map(c => [c.slug, c]))
const CITY_BY_SLUG = new Map(CITY_LANDINGS.map(c => [c.slug, c]))

export const ALL_LANDINGS: Landing[] = [...CATEGORY_LANDINGS, ...CITY_LANDINGS]
export const CATEGORY_SLUGS = CATEGORY_LANDINGS.map(c => c.slug)
export const CITY_SLUGS = CITY_LANDINGS.map(c => c.slug)

export const getCategoryLanding = (slug: string): CategoryLanding | undefined => CATEGORY_BY_SLUG.get(slug)
export const getCityLanding = (slug: string): CityLanding | undefined => CITY_BY_SLUG.get(slug)

function relatedLabel(slug: string): string {
  const cat = CATEGORY_BY_SLUG.get(slug)
  if (cat) return (cat.h1 ?? cat.metaTitle).split(/\s[-–]\s/)[0].replace(/\s2026.*$/, "").trim()
  const city = CITY_BY_SLUG.get(slug)
  if (city) return `Jobs in ${city.city}`
  return slug
}

/** Resolve a landing config into the render model (links + breadcrumb). */
export function buildLandingView(cfg: Landing): LandingView {
  const breadcrumb =
    cfg.kind === "city"
      ? [{ label: "Home", href: "/" }, { label: "Jobs by City", href: "/jobs/private" }, { label: `Jobs in ${cfg.city}` }]
      : [{ label: "Home", href: "/" }, { label: "Browse Jobs", href: "/jobs/private" }, { label: (cfg.h1 ?? cfg.metaTitle).split(/\s[-–]\s/)[0] }]

  const relatedCategories = cfg.relatedCategorySlugs
    .map(s => CATEGORY_BY_SLUG.get(s))
    .filter((c): c is CategoryLanding => !!c)
    .map(c => ({ label: relatedLabel(c.slug), href: `/${c.slug}` }))

  const relatedCities = cfg.relatedCitySlugs
    .map(s => CITY_BY_SLUG.get(s))
    .filter((c): c is CityLanding => !!c)
    .map(c => ({ label: `Jobs in ${c.city}`, href: `/${c.slug}` }))

  return {
    slug: cfg.slug,
    accent: cfg.accent,
    breadcrumb,
    h1: cfg.h1 ?? cfg.metaTitle.split(" | ")[0],
    heroSubtitle: cfg.heroSubtitle,
    heroBadges: cfg.heroBadges,
    intro: cfg.intro,
    sections: LANDING_CLOSINGS[cfg.slug] ? [...cfg.sections, LANDING_CLOSINGS[cfg.slug]] : cfg.sections,
    faqs: cfg.faqs,
    relatedCategories,
    relatedCities,
    relatedGuides: getHubGuides(cfg.slug),
    govtStateLink:
      cfg.kind === "city" && cfg.govtStateSlug
        ? { label: `${cfg.state} Government Jobs`, href: `/jobs/govt/state/${cfg.govtStateSlug}` }
        : undefined,
    jobsHref: cfg.jobsHref,
    jobsLabel: cfg.jobsLabel,
  }
}

/* ── Job blocks ──────────────────────────────────────────────────── */

const govtCard = (j: { slug?: string; id: string; title: string; org: string; vacancies?: string; qualification?: string; badge?: string }): LandingJobCard => ({
  href: `/jobs/govt/${j.slug || j.id}`,
  title: j.title,
  company: j.org,
  meta: [j.vacancies ? `${j.vacancies} posts` : null, j.qualification].filter(Boolean).join(" · "),
  badge: j.badge,
})
const privateCard = (j: { id: string; title: string; company: string; location: string; salary: string; badge?: string }): LandingJobCard => ({
  href: `/jobs/private/${j.id}`,
  title: j.title,
  company: j.company,
  meta: [j.location, j.salary].filter(Boolean).join(" · "),
  badge: j.badge,
})
const wfhCard = (j: { id: string; title: string; company: string; cat: string; salary: string; badge?: string }): LandingJobCard => ({
  href: `/jobs/wfh/${j.id}`,
  title: j.title,
  company: j.company,
  meta: [j.cat, j.salary].filter(Boolean).join(" · "),
  badge: j.badge,
})
const abroadCard = (j: { id: string; title: string; company: string; country: string; salary: string; badge?: string }): LandingJobCard => ({
  href: `/jobs/abroad/${j.id}`,
  title: j.title,
  company: j.company,
  meta: [j.country, j.salary].filter(Boolean).join(" · "),
  badge: j.badge,
})

export interface LandingJobBlocks {
  latest: LandingJobCard[]
  trending: LandingJobCard[]
}

/** Fetch the latest + trending job cards that back a landing page. */
export async function fetchLandingJobs(cfg: Landing): Promise<LandingJobBlocks> {
  try {
    if (cfg.kind === "city") {
      const r = await getJobs({ location: cfg.locationQuery, limit: 18, sort: "latest" })
      const cards = r.jobs.map(privateCard)
      return { latest: cards.slice(0, 8), trending: cards.slice(8, 16) }
    }

    switch (cfg.source) {
      case "govt": {
        const rows = await getGovtJobs("latest")
        const cards = rows.map(govtCard)
        return { latest: cards.slice(0, 8), trending: cards.slice(8, 16) }
      }
      case "private": {
        const [latest, trending] = await Promise.all([
          getJobs({ limit: 8, sort: "latest" }),
          getJobs({ limit: 8, sort: "salary_high" }),
        ])
        return { latest: latest.jobs.map(privateCard), trending: trending.jobs.map(privateCard) }
      }
      case "fresher": {
        const r = await getJobs({ exp: "fresher", limit: 18, sort: "latest" })
        const cards = r.jobs.map(privateCard)
        if (cards.length >= 4) return { latest: cards.slice(0, 8), trending: cards.slice(8, 16) }
        // Fallback: not enough fresher-tagged rows — show entry-level latest.
        const all = (await getJobs({ limit: 16, sort: "latest" })).jobs.map(privateCard)
        return { latest: cards.length ? cards : all.slice(0, 8), trending: all.slice(8, 16) }
      }
      case "wfh": {
        const rows = await getWfhJobs()
        const cards = rows.map(wfhCard)
        return { latest: cards.slice(0, 8), trending: cards.slice(8, 16) }
      }
      case "abroad": {
        const rows = await getAbroadJobs()
        const cards = rows.map(abroadCard)
        return { latest: cards.slice(0, 8), trending: cards.slice(8, 16) }
      }
      default:
        return { latest: [], trending: [] }
    }
  } catch {
    return { latest: [], trending: [] }
  }
}
