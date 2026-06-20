/**
 * articleTypes.ts — shapes for the topical-authority guide/article system
 * (/guides and /guides/<slug>). Reuses the landing section/FAQ shapes so the
 * renderer stays consistent across hubs and articles.
 */
import type { LandingSection, FaqItem } from "@/lib/seo/landingTypes"

export type { LandingSection, FaqItem }

export type ArticleCluster = "government" | "career" | "city"
export type ArticleJobSource = "govt" | "private" | "wfh"

export interface ArticleConfig {
  slug: string
  cluster: ArticleCluster
  /** H1 / headline. */
  title: string
  metaTitle: string
  metaDescription: string
  keywords: string[]
  heroSubtitle: string
  /** ISO dates for Article schema. */
  datePublished: string
  dateModified: string
  readMinutes: number
  /** Which board's live jobs back the "Latest Opportunities" block. */
  jobSource: ArticleJobSource
  /** Optional city filter (private board) for city-guide articles. */
  cityLocation?: string
  intro: string[]
  /** Ordered content sections (Key Opportunities, Eligibility, Skills, ...). */
  sections: LandingSection[]
  faqs: FaqItem[]
  /** Closing call-to-action paragraphs. */
  cta: string[]
  /** Related article slugs (cluster siblings + cross-cluster). */
  relatedSlugs: string[]
  /** Extra contextual links beyond the mandatory hub/listing set. */
  extraLinks?: { label: string; href: string }[]
}

export interface ArticleLink {
  slug: string
  title: string
  href: string
  cluster: ArticleCluster
}

export interface ArticleView {
  slug: string
  cluster: ArticleCluster
  accent: string
  clusterLabel: string
  breadcrumb: { label: string; href?: string }[]
  title: string
  heroSubtitle: string
  datePublished: string
  dateModified: string
  readMinutes: number
  intro: string[]
  sections: LandingSection[]
  faqs: FaqItem[]
  cta: string[]
  relatedArticles: ArticleLink[]
  /** Mandatory + contextual internal links rendered in the article. */
  hubLinks: { label: string; href: string }[]
  listingLinks: { label: string; href: string }[]
  jobsHref: string
  jobsLabel: string
}
