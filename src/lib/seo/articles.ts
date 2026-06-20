import { GOVERNMENT_ARTICLES } from "@/lib/data/articles/governmentArticles"
import { CAREER_ARTICLES } from "@/lib/data/articles/careerArticles"
import { CITY_ARTICLES } from "@/lib/data/articles/cityArticles"
import { ARTICLE_EXPANSIONS } from "@/lib/data/articles/articleExpansions"
import { ARTICLE_EXPANSIONS_2 } from "@/lib/data/articles/articleExpansions2"
import { getGovtJobs } from "@/lib/services/govtJobService"
import { getJobs } from "@/lib/services/jobService"
import { getWfhJobs } from "@/lib/services/wfhJobService"
import type { ArticleCluster, ArticleConfig, ArticleLink, ArticleView } from "@/lib/seo/articleTypes"
import type { LandingJobCard } from "@/lib/seo/landingTypes"

export const ALL_ARTICLES: ArticleConfig[] = [
  ...GOVERNMENT_ARTICLES,
  ...CAREER_ARTICLES,
  ...CITY_ARTICLES,
]

const BY_SLUG = new Map(ALL_ARTICLES.map(a => [a.slug, a]))
export const ARTICLE_SLUGS = ALL_ARTICLES.map(a => a.slug)
export const getArticle = (slug: string): ArticleConfig | undefined => BY_SLUG.get(slug)

export const CLUSTER_META: Record<ArticleCluster, { label: string; accent: string }> = {
  government: { label: "Government Jobs Guides", accent: "#1e3a8a" },
  career: { label: "Career Guides", accent: "#059669" },
  city: { label: "City Job Guides", accent: "#b91c1c" },
}

export function articlesByCluster(cluster: ArticleCluster): ArticleConfig[] {
  return ALL_ARTICLES.filter(a => a.cluster === cluster)
}

/**
 * Reciprocal hub -> guide map with contextual, keyword-rich anchor text.
 * Each landing hub links down to its relevant guides, completing the silo
 * (guides already link up to their hubs).
 */
const HUB_GUIDES: Record<string, { slug: string; anchor: string }[]> = {
  "government-jobs": [
    { slug: "government-jobs-after-10th", anchor: "Government Jobs After 10th: eligibility, salary & full exam list" },
    { slug: "government-jobs-after-12th", anchor: "Government Jobs After 12th: SSC CHSL, NDA, railways & more" },
    { slug: "government-jobs-for-graduates", anchor: "Government Jobs for Graduates: SSC CGL, banking & UPSC guide" },
  ],
  "fresher-jobs": [
    { slug: "resume-format-for-freshers", anchor: "Resume Format for Freshers: template, ATS tips & examples" },
    { slug: "interview-questions-and-answers", anchor: "Interview Questions and Answers: top questions with sample answers" },
    { slug: "how-to-get-a-private-job", anchor: "How to Get a Private Job: a step-by-step job-search strategy" },
  ],
  "work-from-home-jobs": [
    { slug: "best-work-from-home-jobs", anchor: "Best Work From Home Jobs: top remote careers, skills & salary" },
  ],
  "jobs-in-delhi": [
    { slug: "jobs-in-delhi-guide", anchor: "Jobs in Delhi: the complete job seeker's guide to the capital" },
  ],
  "jobs-in-gurgaon": [
    { slug: "jobs-in-gurgaon-guide", anchor: "Jobs in Gurgaon: how to land an MNC, IT or fintech role" },
  ],
  "jobs-in-bangalore": [
    { slug: "jobs-in-bangalore-guide", anchor: "Jobs in Bangalore: how to land a tech job in India's Silicon Valley" },
  ],
}

/** Resolve the guides a given landing hub should link to. */
export function getHubGuides(hubSlug: string): { anchor: string; href: string }[] {
  return (HUB_GUIDES[hubSlug] || [])
    .filter(g => BY_SLUG.has(g.slug))
    .map(g => ({ anchor: g.anchor, href: `/guides/${g.slug}` }))
}

function toLink(a: ArticleConfig): ArticleLink {
  return { slug: a.slug, title: a.title, href: `/guides/${a.slug}`, cluster: a.cluster }
}

/** Mandatory category hubs + relevant city hubs (every article links to these). */
const HUB_LINKS = [
  { label: "Government Jobs", href: "/government-jobs" },
  { label: "Private Jobs", href: "/private-jobs" },
  { label: "Work From Home Jobs", href: "/work-from-home-jobs" },
  { label: "Fresher Jobs", href: "/fresher-jobs" },
  { label: "Jobs in Delhi", href: "/jobs-in-delhi" },
  { label: "Jobs in Gurgaon", href: "/jobs-in-gurgaon" },
  { label: "Jobs in Bangalore", href: "/jobs-in-bangalore" },
]

const LISTING_LINKS = [
  { label: "Government Job Listings", href: "/jobs/govt" },
  { label: "Private Job Listings", href: "/jobs/private" },
  { label: "Work From Home Listings", href: "/jobs/wfh" },
]

function jobsCta(cfg: ArticleConfig): { jobsHref: string; jobsLabel: string } {
  if (cfg.cityLocation) {
    const slug = cfg.cityLocation.toLowerCase()
    return { jobsHref: `/jobs-in-${slug}`, jobsLabel: `Browse Jobs in ${cfg.cityLocation}` }
  }
  if (cfg.jobSource === "govt") return { jobsHref: "/jobs/govt", jobsLabel: "Browse Government Jobs" }
  if (cfg.jobSource === "wfh") return { jobsHref: "/jobs/wfh", jobsLabel: "Browse Work From Home Jobs" }
  return { jobsHref: "/jobs/private", jobsLabel: "Browse Private Jobs" }
}

export function buildArticleView(cfg: ArticleConfig): ArticleView {
  const meta = CLUSTER_META[cfg.cluster]
  const related = cfg.relatedSlugs
    .map(s => BY_SLUG.get(s))
    .filter((a): a is ArticleConfig => !!a)
    .map(toLink)
  const { jobsHref, jobsLabel } = jobsCta(cfg)

  return {
    slug: cfg.slug,
    cluster: cfg.cluster,
    accent: meta.accent,
    clusterLabel: meta.label,
    breadcrumb: [
      { label: "Home", href: "/" },
      { label: "Guides", href: "/guides" },
      { label: cfg.title },
    ],
    title: cfg.title,
    heroSubtitle: cfg.heroSubtitle,
    datePublished: cfg.datePublished,
    dateModified: cfg.dateModified,
    readMinutes: cfg.readMinutes,
    intro: cfg.intro,
    // Append the in-depth expansion sections (keeps every guide in the 2,500+ band).
    sections: [
      ...cfg.sections,
      ...(ARTICLE_EXPANSIONS[cfg.slug] || []),
      ...(ARTICLE_EXPANSIONS_2[cfg.slug] || []),
    ],
    faqs: cfg.faqs,
    cta: cfg.cta,
    relatedArticles: related,
    hubLinks: [...HUB_LINKS, ...(cfg.extraLinks || [])],
    listingLinks: LISTING_LINKS,
    jobsHref,
    jobsLabel,
  }
}

/* ── Latest Opportunities block ──────────────────────────────────── */

export async function fetchArticleJobs(cfg: ArticleConfig): Promise<LandingJobCard[]> {
  try {
    if (cfg.cityLocation) {
      const r = await getJobs({ location: cfg.cityLocation, limit: 8, sort: "latest" })
      return r.jobs.slice(0, 8).map(j => ({
        href: `/jobs/private/${j.id}`,
        title: j.title,
        company: j.company,
        meta: [j.location, j.salary].filter(Boolean).join(" · "),
        badge: j.badge,
      }))
    }
    if (cfg.jobSource === "govt") {
      const rows = await getGovtJobs("latest")
      return rows.slice(0, 8).map(g => ({
        href: `/jobs/govt/${(g as { slug?: string }).slug || g.id}`,
        title: g.title,
        company: g.org,
        meta: [g.vacancies ? `${g.vacancies} posts` : null, g.qualification].filter(Boolean).join(" · "),
        badge: g.badge,
      }))
    }
    if (cfg.jobSource === "wfh") {
      const rows = await getWfhJobs()
      return rows.slice(0, 8).map(j => ({
        href: `/jobs/wfh/${j.id}`,
        title: j.title,
        company: j.company,
        meta: [j.cat, j.salary].filter(Boolean).join(" · "),
        badge: j.badge,
      }))
    }
    const r = await getJobs({ limit: 8, sort: "latest" })
    return r.jobs.slice(0, 8).map(j => ({
      href: `/jobs/private/${j.id}`,
      title: j.title,
      company: j.company,
      meta: [j.location, j.salary].filter(Boolean).join(" · "),
      badge: j.badge,
    }))
  } catch {
    return []
  }
}
