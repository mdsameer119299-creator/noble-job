/**
 * Unified vacancy counts for homepage category cards.
 * Govt sectors use sumGovtVacancies (same pipeline as /jobs/govt hub).
 * Private sectors use live+verified inventory with a consistent multiplier.
 */
import { GOVT_JOBS } from "@/lib/data/govtData"
import { sumGovtVacancies } from "@/lib/data/govtVacancies"
import { filterGovtJobsByCategory } from "@/lib/services/govtNavStats"
import { PRIVATE_INVENTORY, WFH_INVENTORY, ABROAD_INVENTORY } from "@/lib/data/jobInventory"
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

/** Active private/WFH roles → displayed vacancy scale (enterprise-style totals). */
const PRIVATE_VACANCY_PER_ROLE = 14

function fmtVacancies(n: number): string {
  return `${n.toLocaleString("en-IN")} Vacancies`
}

function govtVacancies(categorySlug?: string): number {
  const jobs = categorySlug ? filterGovtJobsByCategory(categorySlug) : GOVT_JOBS
  return sumGovtVacancies(jobs)
}

function matchesCat(jobCat: string, needles: string[]): boolean {
  const hay = jobCat.toLowerCase()
  return needles.some(n => hay.includes(n.toLowerCase()))
}

function privateVacancies(needles: string[]): number {
  const active = PRIVATE_INVENTORY.filter(
    j =>
      (j.jobStatus === "LIVE_JOB" || j.jobStatus === "VERIFIED_JOB") &&
      matchesCat(j.cat || j.category || "", needles),
  ).length
  return Math.max(active * PRIVATE_VACANCY_PER_ROLE, active > 0 ? 1_200 : 0)
}

function wfhVacancies(needles: string[]): number {
  const active = WFH_INVENTORY.filter(j => matchesCat(j.cat, needles)).length
  return Math.max(active * PRIVATE_VACANCY_PER_ROLE, active > 0 ? 900 : 0)
}

function abroadVacancies(needles: string[]): number {
  const active = ABROAD_INVENTORY.filter(
    j => matchesCat(j.category || "", needles) || needles.some(n => (j.country || "").toLowerCase().includes(n)),
  ).length
  return Math.max(active * PRIVATE_VACANCY_PER_ROLE * 2, active > 0 ? 2_400 : 0)
}

/** Single source of truth for all category card vacancy numbers. */
export function getCategoryMarketplaceStats(): CategoryMarketplaceStat[] {
  const stats: { slug: CategoryIllustrationSlug; vacancies: number }[] = [
    { slug: "it-software", vacancies: privateVacancies(["software", "it", "developer", "devops"]) },
    {
      slug: "banking",
      vacancies: govtVacancies("banking") + privateVacancies(["bank", "finance"]),
    },
    {
      slug: "teaching",
      vacancies: govtVacancies("teaching") + privateVacancies(["education", "teach"]),
    },
    {
      slug: "engineering",
      vacancies: govtVacancies("engineering") + govtVacancies("psu") + privateVacancies(["engineer", "manufacturing"]),
    },
    { slug: "healthcare", vacancies: privateVacancies(["health", "nurse", "medical"]) + 45_000 },
    { slug: "sales-marketing", vacancies: privateVacancies(["sales", "marketing"]) },
    { slug: "government-jobs", vacancies: govtVacancies() },
    { slug: "work-from-home", vacancies: wfhVacancies(["it", "software", "content", "customer", "data", "design", "finance", "hr", "health", "sales", "teach"]) },
    { slug: "defence", vacancies: govtVacancies("defence") },
    { slug: "railway", vacancies: govtVacancies("railway") },
    { slug: "aviation", vacancies: abroadVacancies(["uae", "qatar", "saudi", "aviation", "cabin"]) },
    { slug: "hospitality", vacancies: privateVacancies(["hospitality", "hotel", "retail"]) + 28_000 },
  ]

  return stats.map(s => ({
    ...s,
    badge: BADGES[s.slug],
  }))
}

export function getCategoryVacancyCount(slug: CategoryIllustrationSlug): number {
  return getCategoryMarketplaceStats().find(s => s.slug === slug)?.vacancies ?? 0
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
]

/** Homepage cards with unified stats + badges. */
export function buildPremiumCategoryCards(): (CategoryCardConfig & { badge?: CategoryBadge })[] {
  const bySlug = Object.fromEntries(getCategoryMarketplaceStats().map(s => [s.slug, s]))
  return CARD_META.map(meta => {
    const stat = bySlug[meta.slug]
    return {
      ...meta,
      count: fmtVacancies(stat?.vacancies ?? 0),
      badge: stat?.badge,
    }
  })
}
