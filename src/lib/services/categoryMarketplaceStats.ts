/**
 * Unified counts for homepage category cards, framed honestly as "roles to
 * explore" — NEVER as genuine/verified vacancies.
 *
 * COUNT INTEGRITY: a card's number is the size of the list its link opens. Private,
 * WFH and abroad cards are therefore counted by the SAME list pipeline that serves the
 * destination (renderable records only, the destination's own category filter, the
 * synthetic-listings switch honoured — see visibleCounts.ts), with the same non-archived
 * (Live + Verified tabs) semantics. There is no substring heuristic ("it" matching
 * "hospitality"), no mixing of government vacancies into a private-jobs link, no invented
 * floor or multiplier, and a category with nothing to open shows no number at all.
 * Govt cards are counted in NOTIFICATIONS — the current-notification pool the destination lists (hubCounts.ts) — and are
 * labelled as such: a vacancy total over every active row (61,352) is neither the size of the list nor a number of "roles".
 */
import { notificationCountFor } from "@/lib/govt/hubCounts"
import { getActiveGovtRows } from "@/lib/services/govtStatsSource"
import { getPrivateVisibleCounts, getWfhVisibleCounts, getAbroadVisibleCounts, type StatusCounts } from "@/lib/services/visibleCounts"
import type {
  CategoryIllustrationSlug,
  CategoryCardConfig,
  CategoryBadge,
} from "@/lib/config/categoryIllustrations"

export interface CategoryMarketplaceStat {
  slug: CategoryIllustrationSlug
  /** The card's number: open roles for job-board cards, current notifications for government cards (see `unit`). */
  vacancies: number
  unit: "roles" | "notifications"
  badge?: CategoryBadge
}

const BADGES: Partial<Record<CategoryIllustrationSlug, CategoryBadge>> = {
  "government-jobs": { emoji: "🔥", label: "Trending" },
  "it-software": { emoji: "⭐", label: "Most Popular" },
  banking: { emoji: "🆕", label: "Updated Today" },
}

function fmtCount(n: number, unit: "roles" | "notifications"): string {
  return `${n.toLocaleString("en-IN")} ${unit === "roles" ? "Roles to Explore" : n === 1 ? "Notification" : "Notifications"}`
}

const GOVT_CARDS = new Set<CategoryIllustrationSlug>(["government-jobs", "defence", "railway"])

/** Open (Live + Verified tab) jobs of a list — exactly what its default tabs show. */
const open = (c: StatusCounts): number => Math.max(0, c.live + c.verified)

/** Single source of truth for all category card numbers. DB-first for govt. */
export async function getCategoryMarketplaceStats(): Promise<CategoryMarketplaceStat[]> {
  const pool = await getActiveGovtRows()
  // Notifications the card's destination lists: the same current-notification pool and category predicate.
  const govtVacancies = (categorySlug?: string): number => notificationCountFor(pool, categorySlug)
  // Each private card links to /jobs/private?category=<label>; count that very list.
  const priv = async (category: string) => open(await getPrivateVisibleCounts({ category }))

  const [it, banking, teaching, engineering, healthcare, sales, hospitality, blueCollar, wfh, aviation] = await Promise.all([
    priv("IT / Software"),
    priv("Banking"),
    priv("Teaching"),
    priv("Engineering"),
    priv("Healthcare"),
    priv("Sales & Marketing"),
    priv("Hospitality"),
    priv("blue-collar"),
    getWfhVisibleCounts().then(open),
    getAbroadVisibleCounts({ category: "Aviation" }).then(open),
  ])

  const stats: { slug: CategoryIllustrationSlug; vacancies: number }[] = [
    { slug: "it-software", vacancies: it },
    { slug: "banking", vacancies: banking },
    { slug: "teaching", vacancies: teaching },
    { slug: "engineering", vacancies: engineering },
    { slug: "healthcare", vacancies: healthcare },
    { slug: "sales-marketing", vacancies: sales },
    { slug: "government-jobs", vacancies: govtVacancies() },
    { slug: "work-from-home", vacancies: wfh },
    { slug: "defence", vacancies: govtVacancies("defence") },
    { slug: "railway", vacancies: govtVacancies("railway") },
    { slug: "aviation", vacancies: aviation },
    { slug: "hospitality", vacancies: hospitality },
    { slug: "blue-collar-jobs", vacancies: blueCollar },
  ]

  return stats.map(s => ({
    ...s,
    unit: GOVT_CARDS.has(s.slug) ? ("notifications" as const) : ("roles" as const),
    badge: BADGES[s.slug],
  }))
}

export async function getCategoryVacancyCount(slug: CategoryIllustrationSlug): Promise<number> {
  return (await getCategoryMarketplaceStats()).find(s => s.slug === slug)?.vacancies ?? 0
}

const CARD_META: Omit<CategoryCardConfig, "count">[] = [
  { slug: "it-software", name: "IT & Software", href: "/jobs/private?category=IT+%2F+Software" },
  { slug: "banking", name: "Banking", href: "/jobs/private?category=Banking" },
  { slug: "teaching", name: "Teaching", href: "/jobs/private?category=Teaching" },
  { slug: "engineering", name: "Engineering", href: "/jobs/private?category=Engineering" },
  { slug: "healthcare", name: "Healthcare", href: "/jobs/private?category=Healthcare" },
  { slug: "sales-marketing", name: "Sales & Marketing", href: "/jobs/private?category=Sales+%26+Marketing" },
  { slug: "government-jobs", name: "Government Jobs", href: "/jobs/govt" },
  { slug: "work-from-home", name: "Work From Home", href: "/jobs/wfh" },
  { slug: "defence", name: "Defence", href: "/jobs/govt/category/defence" },
  { slug: "railway", name: "Railway", href: "/jobs/govt/category/railway" },
  { slug: "aviation", name: "Aviation", href: "/jobs/abroad?category=Aviation" },
  { slug: "hospitality", name: "Hospitality", href: "/jobs/private?category=Hospitality" },
  { slug: "blue-collar-jobs", name: "Blue Collar Jobs", href: "/jobs/private?category=blue-collar" },
]

/** Homepage cards with unified stats + badges. DB-first for govt. */
export async function buildPremiumCategoryCards(): Promise<(CategoryCardConfig & { badge?: CategoryBadge })[]> {
  const bySlug = Object.fromEntries((await getCategoryMarketplaceStats()).map(s => [s.slug, s]))
  return CARD_META.map(meta => {
    const stat = bySlug[meta.slug]
    return {
      ...meta,
      // Nothing to open → no number (never "0 Roles to Explore", never a padded figure).
      count: (stat?.vacancies ?? 0) > 0 ? fmtCount(stat!.vacancies, stat!.unit) : "",
      badge: stat?.badge,
    }
  })
}
