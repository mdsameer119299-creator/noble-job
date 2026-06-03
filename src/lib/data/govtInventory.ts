/**
 * Expanded government notification inventory (fallback / demo).
 * Every entry gets a realistic vacancy count via applyGovtVacancies in govtData.
 */
import { INDIAN_STATES } from "@/lib/config/govtTaxonomy"
import type { GovtJob, GovtJobTab } from "@/types/govtJob"

type GovtJobRow = GovtJob & { last_date: string; age_range: string }

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length]
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const

function lastDate(i: number): string {
  const day = 5 + (i % 24)
  return `${day} ${pick(MONTHS, i + 3)} 2026`
}

interface Template {
  org: string
  short: string
  titlePrefix: string
  posts: string[]
  qualification: string
  salary: string
  color: string
  tab?: GovtJobTab
  state?: string
  location?: string
  badge?: string
}

const CENTRAL: Template[] = [
  { org: "Staff Selection Commission", short: "SSC", titlePrefix: "SSC CGL", posts: ["Assistant Section Officer", "Inspector", "Tax Assistant", "Auditor"], qualification: "Graduation", salary: "25,500-1,51,100/mo", color: "#7c3aed" },
  { org: "Staff Selection Commission", short: "SSC", titlePrefix: "SSC CHSL", posts: ["LDC", "JSA", "PA", "SA", "DEO"], qualification: "12th Pass", salary: "19,900-81,100/mo", color: "#7c3aed" },
  { org: "Staff Selection Commission", short: "SSC", titlePrefix: "SSC MTS", posts: ["Multi Tasking Staff", "Havaldar"], qualification: "10th / 12th Pass", salary: "18,000-56,900/mo", color: "#7c3aed" },
  { org: "Staff Selection Commission", short: "SSC", titlePrefix: "SSC GD Constable", posts: ["Constable (GD)", "Rifleman"], qualification: "10th Pass", salary: "21,700-69,100/mo", color: "#7c3aed" },
  { org: "Railway Recruitment Board", short: "RRB", titlePrefix: "RRB NTPC", posts: ["Station Master", "Goods Guard", "Commercial Apprentice", "Clerk"], qualification: "Graduation", salary: "35,400-1,12,400/mo", color: "#0e7490" },
  { org: "Railway Recruitment Board", short: "RRB", titlePrefix: "RRB Group D", posts: ["Track Maintainer", "Pointsman", "Helper"], qualification: "10th Pass", salary: "18,000-22,000/mo", color: "#0e7490" },
  { org: "Railway Recruitment Board", short: "RRB", titlePrefix: "RRB ALP", posts: ["Assistant Loco Pilot", "Technician"], qualification: "ITI / Diploma", salary: "19,900-35,400/mo", color: "#0e7490" },
  { org: "IBPS", short: "IBPS", titlePrefix: "IBPS PO", posts: ["Probationary Officer"], qualification: "Graduation", salary: "36,000-63,840/mo", color: "#1847d4" },
  { org: "IBPS", short: "IBPS", titlePrefix: "IBPS Clerk", posts: ["Clerk", "Customer Service Associate"], qualification: "Graduation", salary: "11,765-42,020/mo", color: "#1847d4" },
  { org: "IBPS", short: "IBPS", titlePrefix: "IBPS RRB", posts: ["Officer Scale I", "Office Assistant"], qualification: "Graduation", salary: "29,000-65,000/mo", color: "#1847d4" },
  { org: "State Bank of India", short: "SBI", titlePrefix: "SBI PO", posts: ["Probationary Officer"], qualification: "Graduation", salary: "36,000-63,840/mo", color: "#1e3a8a" },
  { org: "State Bank of India", short: "SBI", titlePrefix: "SBI Clerk", posts: ["Junior Associate"], qualification: "Graduation", salary: "17,900-47,920/mo", color: "#1e3a8a" },
  { org: "UPSC", short: "UPSC", titlePrefix: "UPSC CDS", posts: ["Army Officer", "Navy Officer", "Air Force Officer"], qualification: "Graduation", salary: "56,100-1,77,500/mo", color: "#1e3a8a" },
  { org: "UPSC", short: "UPSC", titlePrefix: "UPSC CAPF", posts: ["Assistant Commandant"], qualification: "Graduation", salary: "56,100-1,77,500/mo", color: "#1e3a8a" },
  { org: "Indian Air Force", short: "IAF", titlePrefix: "IAF Agniveer", posts: ["Agniveer Vayu"], qualification: "12th / Diploma", salary: "30,000-40,000/mo", color: "#1d4ed8" },
  { org: "Indian Army", short: "ARMY", titlePrefix: "Indian Army Agniveer", posts: ["Agniveer General Duty"], qualification: "10th / 12th Pass", salary: "30,000-40,000/mo", color: "#166534" },
  { org: "Indian Navy", short: "NAVY", titlePrefix: "Indian Navy SSR", posts: ["Senior Secondary Recruit"], qualification: "12th with PCM", salary: "21,700-69,100/mo", color: "#0369a1" },
  { org: "CRPF", short: "CRPF", titlePrefix: "CRPF Constable", posts: ["Constable", "Tradesman"], qualification: "10th / ITI", salary: "21,700-69,100/mo", color: "#7c3aed" },
  { org: "BSF", short: "BSF", titlePrefix: "BSF Constable", posts: ["Constable Tradesman"], qualification: "10th / ITI", salary: "21,700-69,100/mo", color: "#7c3aed" },
  { org: "CBSE", short: "CBSE", titlePrefix: "CTET", posts: ["Primary Teacher", "TGT"], qualification: "B.Ed / Graduation", salary: "As per state rules", color: "#059669" },
  { org: "KVS", short: "KVS", titlePrefix: "KVS Recruitment", posts: ["PGT", "TGT", "PRT"], qualification: "Graduation / B.Ed", salary: "35,400-1,12,400/mo", color: "#059669" },
  { org: "ONGC", short: "ONGC", titlePrefix: "ONGC Graduate Trainee", posts: ["E1 Level Executive"], qualification: "B.Tech / MBA", salary: "60,000-1,80,000/mo", color: "#b45309" },
  { org: "NTPC", short: "NTPC", titlePrefix: "NTPC Executive Trainee", posts: ["Executive Trainee"], qualification: "B.Tech", salary: "40,000-1,40,000/mo", color: "#b45309" },
]

/** Dedicated notifications per qualification bucket (ensures listing pages have real jobs). */
const QUALIFICATION_TEMPLATES: { slug: string; items: Template[] }[] = [
  {
    slug: "8th-pass",
    items: [
      { org: "Staff Selection Commission", short: "SSC", titlePrefix: "SSC MTS", posts: ["Multi Tasking Staff", "Havaldar"], qualification: "8th Pass / Matriculation", salary: "18,000-56,900/mo", color: "#7c3aed", badge: "New" },
      { org: "Railway Recruitment Board", short: "RRB", titlePrefix: "RRB Group D", posts: ["Track Maintainer", "Helper", "Pointsman"], qualification: "8th Pass (Class VIII)", salary: "18,000-22,000/mo", color: "#0e7490" },
      { org: "Indian Army", short: "ARMY", titlePrefix: "Army Tradesman", posts: ["Tradesman Mate", "Store Hand"], qualification: "8th Pass", salary: "21,700-69,100/mo", color: "#166534" },
      { org: "BSF", short: "BSF", titlePrefix: "BSF Constable Tradesman", posts: ["Constable", "Tradesman"], qualification: "8th Pass / ITI", salary: "21,700-69,100/mo", color: "#7c3aed" },
      { org: "CISF", short: "CISF", titlePrefix: "CISF Constable", posts: ["Constable (GD)", "Driver"], qualification: "8th Pass", salary: "21,700-69,100/mo", color: "#1e3a8a" },
      { org: "State PSC", short: "PSC", titlePrefix: "Class IV Recruitment", posts: ["Peon", "Orderly", "Watchman"], qualification: "8th Pass", salary: "15,000-35,000/mo", color: "#0e7490" },
      { org: "Municipal Corporation", short: "MC", titlePrefix: "Safai Karmachari", posts: ["Sanitation Worker", "Sweeper"], qualification: "8th Pass", salary: "12,000-28,000/mo", color: "#059669" },
      { org: "Postal Department", short: "POST", titlePrefix: "GDS Recruitment", posts: ["Gramin Dak Sevak", "Branch Postmaster"], qualification: "8th Pass / 10th Pass", salary: "12,000-35,000/mo", color: "#b45309" },
    ],
  },
  {
    slug: "10th-pass",
    items: [
      { org: "Staff Selection Commission", short: "SSC", titlePrefix: "SSC GD Constable", posts: ["Constable (GD)", "Rifleman"], qualification: "10th Pass / Matriculation", salary: "21,700-69,100/mo", color: "#7c3aed" },
      { org: "Railway Recruitment Board", short: "RRB", titlePrefix: "RRB Group D", posts: ["Track Maintainer", "Helper"], qualification: "10th Pass", salary: "18,000-22,000/mo", color: "#0e7490" },
      { org: "CRPF", short: "CRPF", titlePrefix: "CRPF Constable", posts: ["Constable", "Tradesman"], qualification: "10th Pass / ITI", salary: "21,700-69,100/mo", color: "#7c3aed" },
    ],
  },
  {
    slug: "12th-pass",
    items: [
      { org: "Staff Selection Commission", short: "SSC", titlePrefix: "SSC CHSL", posts: ["LDC", "DEO", "PA"], qualification: "12th Pass / Intermediate", salary: "19,900-81,100/mo", color: "#7c3aed" },
      { org: "Indian Air Force", short: "IAF", titlePrefix: "IAF Agniveer", posts: ["Agniveer Vayu"], qualification: "12th Pass with PCM", salary: "30,000-40,000/mo", color: "#1d4ed8" },
    ],
  },
]

function generateQualificationJobs(): GovtJobRow[] {
  const out: GovtJobRow[] = []
  let n = 0
  for (const block of QUALIFICATION_TEMPLATES) {
    block.items.forEach((t, i) => {
      const row = buildFromTemplate(t, 9000 + n, "latest")
      row.id = `govt-qual-${block.slug}-${i}`
      row.slug = `${block.slug}-${slugId(t.short, undefined, n)}-2026`
      row.qualificationTags = [block.slug]
      out.push(row)
      n += 1
    })
    if (block.slug === "8th-pass") {
      for (let s = 0; s < INDIAN_STATES.length; s++) {
        const region = INDIAN_STATES[s]
        const t = block.items[s % block.items.length]
        const row = buildFromTemplate(t, 9000 + n, "latest", region.label)
        row.id = `govt-qual-8th-pass-${region.slug}`
        row.slug = `8th-pass-${region.slug}-${slugId(t.short, region.slug, n)}`
        row.qualificationTags = ["8th-pass"]
        out.push(row)
        n += 1
      }
    }
  }
  return out
}

function buildFromTemplate(t: Template, i: number, tab: GovtJobTab, stateLabel?: string): GovtJobRow {
  const post = pick(t.posts, i)
  const state = stateLabel || t.state || "All India"
  const location = t.location || state
  const year = tab === "upcoming" ? "2026-27" : "2026"
  const title = stateLabel
    ? `${stateLabel} ${t.titlePrefix} Recruitment ${year}`
    : `${t.titlePrefix} Recruitment ${year}`
  const id = `govt-${tab}-${slugId(t.short, stateLabel, i)}`
  return {
    id,
    title,
    org: stateLabel ? `${stateLabel} Staff Selection / PSC` : t.org,
    short: stateLabel ? stateLabel.slice(0, 4).toUpperCase() : t.short,
    post,
    vacancies: "0",
    qualification: t.qualification,
    ageRange: "18-32 Years",
    age_range: "18-32 Years",
    fee: "100",
    lastDate: tab === "upcoming" ? "TBA" : lastDate(i),
    last_date: tab === "upcoming" ? "TBA" : lastDate(i),
    salary: t.salary,
    location,
    state,
    tab,
    color: t.color,
    badge: t.badge || (tab === "latest" ? "New" : tab === "upcoming" ? "Upcoming" : "Active"),
    status: "active",
    department: t.org,
    experience: "Fresher",
  }
}

function slugId(short: string, state: string | undefined, i: number): string {
  const base = `${short}-${state || "in"}-${i}`.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  return base.replace(/-+/g, "-").slice(0, 48)
}

function generateTab(tab: GovtJobTab, count: number, offset: number): GovtJobRow[] {
  const out: GovtJobRow[] = []
  for (let n = 0; n < count; n++) {
    const i = offset + n
    const t = pick(CENTRAL, i)
    out.push(buildFromTemplate(t, i, tab))
  }
  return out
}

function generateStateJobs(count: number): GovtJobRow[] {
  const out: GovtJobRow[] = []
  for (let n = 0; n < count; n++) {
    const region = pick(INDIAN_STATES, n)
    const t = pick(CENTRAL, n + 5)
    out.push(buildFromTemplate(t, n, "latest", region.label))
  }
  return out
}

/** ~520 notifications before de-duplication by slug. */
export const GENERATED_GOVT_JOBS: GovtJobRow[] = [
  ...generateTab("latest", 220, 0),
  ...generateTab("upcoming", 35, 300),
  ...generateTab("results", 55, 400),
  ...generateTab("admit", 55, 500),
  ...generateTab("answer", 35, 600),
  ...generateStateJobs(120),
  ...generateQualificationJobs(),
]

export const GOVT_INVENTORY_COUNTS = {
  notifications: GENERATED_GOVT_JOBS.length,
  targetVacancies: 25_000,
}
