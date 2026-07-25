/**
 * Live hero statistics — sourced from seeded inventory (and govt dataset when Supabase is off).
 */
import {
  getPrivateInventoryCounts,
  getWfhInventoryCounts,
  getAbroadInventoryCounts,
  getAbroadCountryCounts,
  ABROAD_COUNTRY_COUNT,
} from "@/lib/data/jobInventory"
import { getGovtHubStats } from "@/lib/services/govtHubStats"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export type HeroVariant =
  | "govt"
  | "private"
  | "wfh"
  | "abroad"
  | "banking"
  | "railway"
  | "ssc"
  | "upsc"
  | "defence"
  | "police"
  | "teaching"
  | "psu"
  | "engineering"

export interface HeroCounter {
  key: string
  label: string
  value: number
}

export interface HeroFloatingCard {
  label: string
  sub?: string
  accent?: string
}

export interface HeroStatsPayload {
  counters: HeroCounter[]
  floatingCards: HeroFloatingCard[]
  countryCards?: { flag: string; name: string; jobs: number }[]
}

async function govtStatsForSlug(slug?: string): Promise<HeroStatsPayload> {
  const counters: HeroCounter[] = (await getGovtHubStats({ slug })).map(({ key, label, num }) => ({
    key,
    label,
    value: num,
  }))

  const sectorCards: Record<string, HeroFloatingCard[]> = {
    banking: [
      { label: "SBI", sub: "PO & Clerk" },
      { label: "IBPS", sub: "RRB & CWE" },
      { label: "RBI", sub: "Grade B" },
      { label: "NABARD", sub: "Officer" },
    ],
    railway: [
      { label: "RRB NTPC", sub: "Graduate Level" },
      { label: "RRB Group D", sub: "Level 1" },
      { label: "RPF", sub: "Constable" },
      { label: "ALP", sub: "Technician" },
    ],
    ssc: [
      { label: "SSC CGL", sub: "Combined Graduate" },
      { label: "SSC CHSL", sub: "10+2 Level" },
      { label: "SSC MTS", sub: "Multi Tasking" },
      { label: "SSC GD", sub: "Constable" },
    ],
    upsc: [
      { label: "Civil Services", sub: "IAS / IPS" },
      { label: "CDS", sub: "Defence Services" },
      { label: "NDA", sub: "National Defence" },
      { label: "IES", sub: "Engineering" },
    ],
    defence: [
      { label: "Indian Army", sub: "Agniveer" },
      { label: "Indian Navy", sub: "Sailor" },
      { label: "IAF", sub: "Airmen" },
      { label: "DRDO", sub: "Scientist" },
    ],
    police: [
      { label: "State Police", sub: "Constable" },
      { label: "CAPF", sub: "Assistant Commandant" },
      { label: "CRPF", sub: "Head Constable" },
      { label: "BSF", sub: "Tradesman" },
    ],
    teaching: [
      { label: "KVS", sub: "PRT / TGT" },
      { label: "CTET", sub: "Central TET" },
      { label: "UGC NET", sub: "Assistant Professor" },
      { label: "State TET", sub: "Teacher Eligibility" },
    ],
    psu: [
      { label: "ONGC", sub: "Graduate Trainee" },
      { label: "NTPC", sub: "Executive" },
      { label: "BHEL", sub: "Engineer" },
      { label: "GAIL", sub: "Officer" },
    ],
    engineering: [
      { label: "Junior Engineer", sub: "Civil / Mech" },
      { label: "Assistant Engineer", sub: "State PSC" },
      { label: "RRB JE", sub: "Railways" },
      { label: "PSU Trainee", sub: "Technical" },
    ],
  }

  const defaultCards: HeroFloatingCard[] = [
    { label: "SSC CGL", sub: "Graduate Level" },
    { label: "UPSC", sub: "Civil Services" },
    { label: "Railway", sub: "RRB NTPC" },
    { label: "Bank PO", sub: "IBPS / SBI" },
    { label: "Defence", sub: "Army · Navy · IAF" },
  ]

  return {
    counters,
    floatingCards: (slug && sectorCards[slug]) || defaultCards,
  }
}

export async function getHeroStats(variant: HeroVariant, opts?: { govtSlug?: string }): Promise<HeroStatsPayload> {
  switch (variant) {
    case "private": {
      const c = getPrivateInventoryCounts()
      // These counts are the browsable demo catalog, not genuine openings, so
      // the labels deliberately avoid any "live"/"verified" trust claim.
      return {
        counters: [
          { key: "all", label: "Roles to Explore", value: c.all },
          { key: "live", label: "Live Openings", value: c.live },
          { key: "verified", label: "Featured Openings", value: c.verified },
          { key: "archived", label: "Archived Records", value: c.archived },
        ],
        // `accent` here is a short icon rendered as visible text next to the
        // label (see CategoryHeroView.tsx) — same contract the WFH/Abroad/Govt
        // variants use below (emoji, never a raw color value).
        floatingCards: [
          { label: "TCS", sub: "IT Services", accent: "💻" },
          { label: "Infosys", sub: "Consulting", accent: "💼" },
          { label: "Wipro", sub: "Technology", accent: "⚙️" },
          { label: "Amazon", sub: "E-Commerce", accent: "🛒" },
          { label: "Accenture", sub: "Global", accent: "🌐" },
          { label: "HCL", sub: "Enterprise", accent: "🏢" },
        ],
      }
    }
    case "wfh": {
      const c = getWfhInventoryCounts()
      // Demo catalog counts — labels avoid any "live"/"verified" trust claim.
      return {
        counters: [
          { key: "all", label: "Remote Roles to Explore", value: c.all },
          { key: "live", label: "Live Openings", value: c.live },
          { key: "verified", label: "Featured Openings", value: c.verified },
          { key: "archived", label: "Archived Records", value: c.archived },
        ],
        floatingCards: [
          { label: "Remote", sub: "Work anywhere", accent: "🏠" },
          { label: "Flexible Hours", sub: "Your schedule", accent: "⏰" },
          { label: "Global Teams", sub: "International", accent: "🌍" },
          { label: "Verified Employers", sub: "Trusted companies", accent: "✓" },
        ],
      }
    }
    case "abroad": {
      const c = getAbroadInventoryCounts()
      const allCountries = getAbroadCountryCounts()
      const topByJobs = [...allCountries].sort((a, b) => b.jobs - a.jobs)
      // Demo catalog counts — labels avoid any "live"/"verified" trust claim.
      return {
        counters: [
          { key: "all", label: "Roles to Explore", value: c.all },
          { key: "live", label: "Live Openings", value: c.live },
          { key: "verified", label: "Featured Openings", value: c.verified },
          { key: "countries", label: "Countries", value: ABROAD_COUNTRY_COUNT },
        ],
        floatingCards: topByJobs.slice(0, 8).map(co => ({
          label: co.name,
          sub: `${co.jobs.toLocaleString("en-IN")}+ jobs`,
          accent: co.flag,
        })),
        countryCards: allCountries.map(co => ({
          flag: co.flag,
          name: co.name,
          jobs: co.jobs,
        })),
      }
    }
    case "banking":
    case "railway":
    case "ssc":
    case "upsc":
    case "defence":
    case "police":
    case "teaching":
    case "psu":
      return govtStatsForSlug(variant)
    case "govt":
    default:
      return govtStatsForSlug(opts?.govtSlug)
  }
}

/**
 * Genuine verified-employer count for the private/WFH hero. Returns the real
 * number of employers marked `verified` in the DB, or 0 when unavailable — we
 * never fall back to the fabricated marketing target. Callers should hide the
 * stat when this is 0 rather than invent a figure.
 */
export async function getVerifiedEmployerCount(): Promise<number> {
  if (!isSupabaseConfigured()) return 0
  try {
    const { createClient } = await import("@/lib/supabase/server")
    const sb = await createClient()
    if (!sb) return 0
    const { count } = await sb
      .from("employers")
      .select("id", { count: "exact", head: true })
      .eq("verified", true)
    return count || 0
  } catch {
    return 0
  }
}
