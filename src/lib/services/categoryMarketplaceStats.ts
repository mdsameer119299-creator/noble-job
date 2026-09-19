/**
 * Unified counts for homepage category cards, framed honestly as "roles to
 * explore" (a browsable-catalog figure) — NEVER as genuine/verified vacancies.
 * Govt sectors contribute real vacancies (sumRealVacancies over active rows);
 * private/WFH/abroad sectors contribute their actual catalog listing counts.
 * There is no fabricated multiplier or invented floor: synthetic demo content
 * is countable only as "roles to explore", never as a genuine open vacancy.
 */
import { sumRealVacancies, isVacancyBearingJob } from "@/lib/data/govtVacancies"
import { jobMatchesCategorySlug } from "@/lib/services/govtNavStats"
import { getActiveGovtRows } from "@/lib/services/govtStatsSource"
import { renderablePrivateInventory, renderableWfhInventory, renderableAbroadInventory, BLUE_COLLAR_CATEGORIES } from "@/lib/data/jobInventory"
import type {
  CategoryIllustrationSlug,
  CategoryCardConfig,
  CategoryBadge,
} from "@/lib/config/categoryIllustrations"

export interface CategoryMarketplaceStat {
  slug: CategoryIllustrationSlug
  vacancies: number
  badge?: CategoryBadge
}

const BADGES: Partial<Record<CategoryIllustrationSlug, CategoryBadge>> = {
  "government-jobs": { emoji: "🔥", label: "Trending" },
  "it-software": { emoji: "⭐", label: "Most Popular" },
  banking: { emoji: "🆕", label: "Updated Today" },
}

function fmtRoles(n: number): string {
  return `${n.toLocaleString("en-IN")} Roles to Explore`
}

function matchesCat(jobCat: string, needles: string[]): boolean {
  const hay = jobCat.toLowerCase()
  return needles.some(n => hay.includes(n.toLowerCase()))
}

/** Actual count of browsable (non-archived) private catalog listings in a category. */
function privateRoles(needles: string[]): number {
  return renderablePrivateInventory().filter(
    j =>
      j.jobStatus !== "ARCHIVED_JOB" &&
      matchesCat(j.cat || j.category || "", needles),
  ).length
}

const BLUE_COLLAR_SET = new Set<string>(BLUE_COLLAR_CATEGORIES)

/** Blue-collar umbrella count — exact category match, not the substring `matchesCat` heuristic. */
function blueCollarRoles(): number {
  return renderablePrivateInventory().filter(j => j.jobStatus !== "ARCHIVED_JOB" && BLUE_COLLAR_SET.has(j.cat)).length
}

function wfhRoles(needles: string[]): number {
  return renderableWfhInventory().filter(j => j.jobStatus !== "ARCHIVED_JOB" && matchesCat(j.cat, needles)).length
}

function abroadRoles(needles: string[]): number {
  return renderableAbroadInventory().filter(
    j =>
      j.jobStatus !== "ARCHIVED_JOB" &&
      (matchesCat(j.category || "", needles) || needles.some(n => (j.country || "").toLowerCase().includes(n))),
  ).length
}

/** Single source of truth for all category card vacancy numbers. DB-first for govt. */
export async function getCategoryMarketplaceStats(): Promise<CategoryMarketplaceStat[]> {
  const pool = await getActiveGovtRows()
  const govtVacancies = (categorySlug?: string): number => {
    const jobs = categorySlug ? pool.filter(j => jobMatchesCategorySlug(j, categorySlug)) : pool
    return sumRealVacancies(jobs.filter(isVacancyBearingJob))
  }
  const stats: { slug: CategoryIllustrationSlug; vacancies: number }[] = [
    { slug: "it-software", vacancies: privateRoles(["software", "it", "developer", "devops"]) },
    {
      slug: "banking",
      vacancies: govtVacancies("banking") + privateRoles(["bank", "finance"]),
    },
    {
      slug: "teaching",
      vacancies: govtVacancies("teaching") + privateRoles(["education", "teach"]),
    },
    {
      slug: "engineering",
      vacancies: govtVacancies("engineering") + govtVacancies("psu") + privateRoles(["engineer", "manufacturing"]),
    },
    { slug: "healthcare", vacancies: privateRoles(["health", "nurse", "medical"]) },
    { slug: "sales-marketing", vacancies: privateRoles(["sales", "marketing"]) },
    { slug: "government-jobs", vacancies: govtVacancies() },
    { slug: "work-from-home", vacancies: wfhRoles(["it", "software", "content", "customer", "data", "design", "finance", "hr", "health", "sales", "teach"]) },
    { slug: "defence", vacancies: govtVacancies("defence") },
    { slug: "railway", vacancies: govtVacancies("railway") },
    { slug: "aviation", vacancies: abroadRoles(["uae", "qatar", "saudi", "aviation", "cabin"]) },
    { slug: "hospitality", vacancies: privateRoles(["hospitality", "hotel", "retail"]) },
    { slug: "blue-collar-jobs", vacancies: blueCollarRoles() },
  ]

  return stats.map(s => ({
    ...s,
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
      count: fmtRoles(stat?.vacancies ?? 0),
      badge: stat?.badge,
    }
  })
}
