import type { Metadata } from "next"
import { DEFAULT_KEYWORDS, ORG_LOGO, SITE_NAME, siteUrl } from "./constants"

/**
 * Metadata overrides for paginated listing pages (?page=N). Page 1 keeps the
 * page/layout defaults; page 2+ self-canonicalises and is noindex,follow — so
 * Googlebot crawls the pagination links (discovering every job URL) without
 * indexing thin paginated variants. Merge the result over the base metadata.
 */
export function paginationMeta(path: string, page: number): Metadata {
  if (!page || page <= 1) return {}
  const base = siteUrl()
  const p = path.startsWith("/") ? path : `/${path}`
  return {
    alternates: { canonical: `${base}${p}?page=${page}` },
    robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
  }
}

/**
 * Query parameters that FILTER a listing (search text, category, location…).
 * A listing URL carrying any of these is a keyword/filter variant, not a landing
 * page — it must not be indexed. Tracking parameters (utm_*, gclid, fbclid…) are
 * deliberately NOT here: they are ignored and canonicalise to the clean path.
 */
export const LISTING_FILTER_PARAMS = [
  "q", "category", "cat", "country", "location", "exp", "experience", "type", "salary",
  "sort", "status", "qualification", "state", "department", "lastDate",
] as const

type SearchParamBag = Record<string, string | string[] | undefined>

/** Page number from `?page=`, minimum 1. */
export function pageFromSearchParams(sp: SearchParamBag | undefined): number {
  const raw = Array.isArray(sp?.page) ? sp?.page[0] : sp?.page
  return Math.max(1, Number(raw) || 1)
}

/**
 * ONE pagination/filter policy for every listing board and taxonomy page:
 *   • a filter/keyword parameter present  → noindex,follow, canonical stays the CLEAN path;
 *   • page >= 2 (unfiltered)              → noindex,follow, self-canonical `?page=N`;
 *   • otherwise (page 1, tracking params) → no override (page defaults apply,
 *     canonical = the clean path).
 * Crawlable prev/next links are untouched — `follow` keeps them discoverable.
 * Merge the result over the page's base metadata.
 */
export function listingMeta(
  path: string,
  sp: SearchParamBag | undefined,
  filterKeys: readonly string[] = LISTING_FILTER_PARAMS,
): Metadata {
  const filtered = filterKeys.some(k => {
    const v = sp?.[k]
    const s = Array.isArray(v) ? v.join("") : v
    return typeof s === "string" && s.trim() !== ""
  })
  if (filtered) {
    return { robots: { index: false, follow: true, googleBot: { index: false, follow: true } } }
  }
  return paginationMeta(path, pageFromSearchParams(sp))
}

export type PageSeoInput = {
  title: string
  description: string
  path?: string
  keywords?: string[]
  ogType?: "website" | "article"
  noIndex?: boolean
  /**
   * Emit NO canonical (and no og:url). For pages that have no canonical URL of
   * their own — the 404 page. Without `path` the builder otherwise falls back to
   * the site root, which would canonicalise the page to the homepage.
   */
  noCanonical?: boolean
}

/** Builds Next.js Metadata with canonical, Open Graph, and Twitter cards */
export function buildPageMetadata(input: PageSeoInput): Metadata {
  const base = siteUrl()
  const url = input.path ? `${base}${input.path.startsWith("/") ? input.path : `/${input.path}`}` : base
  const keywords = [...new Set([...(input.keywords || []), ...DEFAULT_KEYWORDS])]

  const ogImage = `${base}${ORG_LOGO}`

  // The root layout applies a `%s | Noble Job` title template. Some page configs
  // (e.g. landing city/category metaTitle) already bake the brand suffix in,
  // which the template would duplicate ("… | Noble Job | Noble Job"). When the
  // brand is already present, emit an absolute title to bypass the template.
  const titleHasBrand = /\|\s*noble job\s*$/i.test(input.title)
  const title: Metadata["title"] = titleHasBrand ? { absolute: input.title } : input.title

  return {
    title,
    description: input.description,
    keywords,
    ...(input.noCanonical ? {} : { alternates: { canonical: url } }),
    openGraph: {
      title: input.title,
      description: input.description,
      ...(input.noCanonical ? {} : { url }),
      siteName: SITE_NAME,
      type: input.ogType || "website",
      locale: "en_IN",
      images: [{ url: ogImage, width: 1200, height: 630, alt: SITE_NAME }],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [ogImage],
    },
    robots: input.noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true, googleBot: { index: true, follow: true } },
  }
}
