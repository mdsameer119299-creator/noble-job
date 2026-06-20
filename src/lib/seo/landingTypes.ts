/**
 * landingTypes.ts — shared shapes for the SEO landing pages
 * (/government-jobs, /jobs-in-delhi, …).
 */

export interface LandingSection {
  id: string
  icon: string
  title: string
  paragraphs?: string[]
  bullets?: string[]
  /** Ordered/numbered list. */
  steps?: string[]
  /** Pill/tag list (e.g. popular roles). */
  chips?: string[]
  table?: { head: [string, string]; rows: [string, string][] }
}

export interface FaqItem {
  q: string
  a: string
}

interface BaseLanding {
  /** URL slug without leading slash, e.g. "government-jobs" / "jobs-in-delhi". */
  slug: string
  accent: string
  metaTitle: string
  metaDescription: string
  keywords: string[]
  /** Optional — falls back to metaTitle (sans " | Noble Job") for city pages. */
  h1?: string
  heroSubtitle: string
  heroBadges: string[]
  intro: string[]
  sections: LandingSection[]
  faqs: FaqItem[]
  relatedCategorySlugs: string[]
  relatedCitySlugs: string[]
  /** Primary CTA: the live listing this hub feeds into. */
  jobsHref: string
  jobsLabel: string
}

export type JobSource = "govt" | "private" | "wfh" | "abroad" | "fresher"

export interface CategoryLanding extends BaseLanding {
  kind: "category"
  source: JobSource
}

export interface CityLanding extends BaseLanding {
  kind: "city"
  city: string
  state: string
  /** Substring matched against private-job `location`. */
  locationQuery: string
  /** Govt state taxonomy slug for the "state government jobs" link. */
  govtStateSlug?: string
}

export type Landing = CategoryLanding | CityLanding

/** Normalised job card used by the latest/trending blocks. */
export interface LandingJobCard {
  href: string
  title: string
  company: string
  meta: string
  badge?: string
}

export interface LandingView {
  slug: string
  accent: string
  breadcrumb: { label: string; href?: string }[]
  h1: string
  heroSubtitle: string
  heroBadges: string[]
  intro: string[]
  sections: LandingSection[]
  faqs: FaqItem[]
  relatedCategories: { label: string; href: string }[]
  relatedCities: { label: string; href: string }[]
  /** Reciprocal hub -> guide links (topical-authority silo). */
  relatedGuides: { anchor: string; href: string }[]
  /** City pages: link to that state's government-jobs page. */
  govtStateLink?: { label: string; href: string }
  jobsHref: string
  jobsLabel: string
}
