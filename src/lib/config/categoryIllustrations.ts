/**
 * Noble Job category illustration slugs — shared across home, govt, WFH, abroad.
 * Assets: /public/images/categories/{slug}.svg (transparent, 120×120 viewBox).
 */

export const CATEGORY_ILLUSTRATION_SLUGS = [
  "it-software",
  "banking",
  "teaching",
  "engineering",
  "healthcare",
  "sales-marketing",
  "government-jobs",
  "work-from-home",
  "defence",
  "railway",
  "aviation",
  "hospitality",
  "blue-collar-jobs",
] as const

export type CategoryIllustrationSlug = (typeof CATEGORY_ILLUSTRATION_SLUGS)[number]

/**
 * Slugs with no authored /public/images/categories asset yet — CategoryIllustration
 * renders this emoji instead of a broken <img>. Remove an entry once a real
 * illustration is added for that slug.
 */
export const CATEGORY_EMOJI_FALLBACK: Partial<Record<CategoryIllustrationSlug, string>> = {
  "blue-collar-jobs": "👷",
}

export interface CategoryBadge {
  emoji: string
  label: string
}

export interface CategoryCardConfig {
  slug: CategoryIllustrationSlug
  name: string
  count?: string
  badge?: CategoryBadge
  href: string
}

/** @deprecated Use buildPremiumCategoryCards() for live govt-aligned counts. */
export const PREMIUM_CATEGORY_CARDS: CategoryCardConfig[] = []

const GOVT_SLUG_MAP: Record<string, CategoryIllustrationSlug> = {
  banking: "banking",
  railway: "railway",
  defence: "defence",
  police: "defence",
  teaching: "teaching",
  engineering: "engineering",
  ssc: "government-jobs",
  upsc: "government-jobs",
  psu: "engineering",
  "latest-notifications": "government-jobs",
  "all-india": "government-jobs",
  "state-govt": "government-jobs",
  "admit-cards": "government-jobs",
  results: "government-jobs",
  "answer-keys": "government-jobs",
  syllabus: "teaching",
  "previous-papers": "teaching",
  "8th-pass": "teaching",
  "10th-pass": "teaching",
  "12th-pass": "teaching",
  graduate: "it-software",
  iti: "engineering",
  diploma: "engineering",
}

const LABEL_MAP: Record<string, CategoryIllustrationSlug> = {
  "it / software": "it-software",
  it: "it-software",
  software: "it-software",
  banking: "banking",
  "banking / finance": "banking",
  teaching: "teaching",
  "teaching / education": "teaching",
  education: "teaching",
  engineering: "engineering",
  healthcare: "healthcare",
  "sales & marketing": "sales-marketing",
  "sales / marketing": "sales-marketing",
  sales: "sales-marketing",
  marketing: "sales-marketing",
  hospitality: "hospitality",
  aviation: "aviation",
  "content writing": "it-software",
  "customer support": "sales-marketing",
  "data entry": "it-software",
  "design & creative": "it-software",
  "finance / accounts": "banking",
  "hr / recruitment": "sales-marketing",
  "teaching / tutoring": "teaching",
}

/** Resolve illustration slug from govt category slug, job category label, or private filter name. */
export function resolveCategoryIllustrationSlug(
  key: string,
): CategoryIllustrationSlug {
  const k = key.trim().toLowerCase()
  if ((CATEGORY_ILLUSTRATION_SLUGS as readonly string[]).includes(k)) {
    return k as CategoryIllustrationSlug
  }
  if (GOVT_SLUG_MAP[k]) return GOVT_SLUG_MAP[k]
  if (LABEL_MAP[k]) return LABEL_MAP[k]
  if (k.includes("rail")) return "railway"
  if (k.includes("bank") || k.includes("ibps") || k.includes("sbi")) return "banking"
  if (k.includes("army") || k.includes("navy") || k.includes("defence") || k.includes("police")) return "defence"
  if (k.includes("teach") || k.includes("tet") || k.includes("ctet")) return "teaching"
  if (k.includes("engineer") || k.includes("psu") || k.includes("ongc")) return "engineering"
  if (k.includes("health") || k.includes("nurse")) return "healthcare"
  if (k.includes("hotel") || k.includes("hospitality")) return "hospitality"
  if (k.includes("aviation") || k.includes("cabin") || k.includes("airline")) return "aviation"
  if (k.includes("wfh") || k.includes("remote") || k.includes("work from home")) return "work-from-home"
  if (
    k.includes("blue collar") ||
    k.includes("blue-collar") ||
    k.includes("driver") ||
    k.includes("delivery") ||
    k.includes("security guard") ||
    k.includes("housekeeping") ||
    k.includes("warehouse") ||
    k.includes("electrician") ||
    k.includes("plumber") ||
    k.includes("carpenter") ||
    k.includes("welder") ||
    k.includes("mechanic") ||
    k.includes("factory")
  )
    return "blue-collar-jobs"
  if (k.includes("govt") || k.includes("sarkari") || k.includes("ssc") || k.includes("upsc")) return "government-jobs"
  if (k.includes("software") || k.includes("developer") || k.includes("data")) return "it-software"
  return "it-software"
}

/** Prefer WebP (smaller); SVG kept as source for regeneration. */
export function categoryIllustrationSrc(slug: CategoryIllustrationSlug): string {
  return `/images/categories/${slug}.webp`
}

export function categoryIllustrationSrcSvg(slug: CategoryIllustrationSlug): string {
  return `/images/categories/${slug}.svg`
}
