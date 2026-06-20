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

export type PageSeoInput = {
  title: string
  description: string
  path?: string
  keywords?: string[]
  ogType?: "website" | "article"
  noIndex?: boolean
}

/** Builds Next.js Metadata with canonical, Open Graph, and Twitter cards */
export function buildPageMetadata(input: PageSeoInput): Metadata {
  const base = siteUrl()
  const url = input.path ? `${base}${input.path.startsWith("/") ? input.path : `/${input.path}`}` : base
  const keywords = [...new Set([...(input.keywords || []), ...DEFAULT_KEYWORDS])]

  const ogImage = `${base}${ORG_LOGO}`

  return {
    title: input.title,
    description: input.description,
    keywords,
    alternates: { canonical: url },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
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
