/**
 * govtData.ts — enriched government job + content inventory (fallback / demo).
 *
 * Takes the base seed notifications, auto-tags them against the taxonomy
 * (categories, qualifications, state), slugs them, and generates full SEO
 * detail sections so every job has its own complete page. Also provides the
 * content datasets (admit cards, results, answer keys, syllabus, papers).
 */
import { FALLBACK_GOVT_JOBS } from "./fallbackJobs"
import { GENERATED_GOVT_JOBS } from "./govtInventory"
import { applyGovtVacancies } from "./govtVacancies"
import {
  GOVT_TOP_CATEGORIES,
  GOVT_QUALIFICATIONS,
  slugify,
  stateSlugFromName,
} from "@/lib/config/govtTaxonomy"
import { generateGovtArticle } from "@/lib/services/govtArticle"
import { resolveGovtJobLinks } from "@/lib/services/govtOfficialLinks"
import type { GovtJob, GovtContentItem } from "@/types/govtJob"

type GovtJobRow = GovtJob & { last_date?: string; age_range?: string }

function matchCategoryTags(job: GovtJob): string[] {
  const hay = `${job.org} ${job.title} ${job.post} ${job.department || ""}`.toLowerCase()
  const tags: string[] = []
  for (const c of GOVT_TOP_CATEGORIES) {
    if (c.keywords?.some(k => hay.includes(k))) tags.push(c.slug)
  }
  // Scope buckets
  if ((job.state || "").toLowerCase() === "all india" || !job.state) tags.push("all-india")
  else tags.push("state-govt")
  tags.push("latest-notifications")
  return Array.from(new Set(tags))
}

function matchQualificationTags(job: GovtJob): string[] {
  const hay = (job.qualification || "").toLowerCase()
  const tags: string[] = []
  for (const q of GOVT_QUALIFICATIONS) {
    if (q.keywords.some(k => hay.includes(k))) tags.push(q.slug)
  }
  return tags
}

/**
 * Normalise + tag + generate SEO sections for a single job.
 *
 * opts.synthesizeVacancies=false (ingested jobs): never fabricate a vacancy
 * count — unknown counts become "Not Specified". Default true preserves the
 * demo/fallback datasets that rely on profile-based placeholders.
 */
export function enrichGovtJob(raw: GovtJobRow, opts?: { synthesizeVacancies?: boolean }): GovtJob {
  const withVacancies = applyGovtVacancies(
    {
      ...raw,
      lastDate: raw.lastDate || raw.last_date || "TBA",
      ageRange: raw.ageRange || raw.age_range || "-",
      department: raw.department || raw.org,
    },
    { synthesize: opts?.synthesizeVacancies ?? true },
  )
  const job: GovtJob = { ...withVacancies }
  job.slug = job.slug || slugify(`${job.title}`) || job.id
  job.stateSlug = job.stateSlug || stateSlugFromName(job.state || job.location)
  job.categoryTags = job.categoryTags?.length ? job.categoryTags : matchCategoryTags(job)
  job.qualificationTags = job.qualificationTags?.length ? job.qualificationTags : matchQualificationTags(job)

  const gen = generateGovtArticle(job)
  job.overview = job.overview || gen.overview
  job.eligibility = job.eligibility || gen.eligibility
  job.ageLimit = job.ageLimit || gen.ageLimit
  job.salaryDetails = job.salaryDetails || gen.salaryDetails
  job.selectionProcess = job.selectionProcess?.length ? job.selectionProcess : gen.selectionProcess
  job.feeDetails = job.feeDetails?.length ? job.feeDetails : gen.feeDetails
  job.examPattern = job.examPattern || gen.examPattern
  job.importantDates = job.importantDates?.length ? job.importantDates : gen.importantDates
  job.faqs = job.faqs?.length ? job.faqs : gen.faqs
  job.howToApply = job.howToApply?.length ? job.howToApply : gen.howToApply
  job.article = job.article || gen.article

  const links = resolveGovtJobLinks(job)
  job.applyUrl = links.applyUrl
  job.officialUrl = links.officialUrl
  job.notificationPdf = links.notificationPdf
  job.notificationUrl = job.notificationUrl || links.notificationPdf
  job.resultUrl = links.resultUrl
  job.admitUrl = links.admitUrl
  job.answerUrl = links.answerUrl

  job.jobStatus = job.jobStatus || (job.status === "expired" ? "ARCHIVED_JOB" : "LIVE_JOB")
  return job
}

// A couple of fully hand-detailed showcase jobs (rich vacancy break-up etc.).
const DETAILED_JOBS: GovtJobRow[] = [
  {
    id: "rrb-ntpc-graduate-2026",
    slug: "rrb-ntpc-graduate-level-2026",
    title: "RRB NTPC Graduate Level Recruitment 2026",
    org: "Railway Recruitment Board",
    short: "RRB",
    post: "Station Master, Goods Guard, Sr. Clerk",
    vacancies: "11558",
    qualification: "Graduation in any discipline",
    ageRange: "18-36 Years",
    age_range: "18-36 Years",
    fee: "500",
    lastDate: "30 Jun 2026",
    last_date: "30 Jun 2026",
    startDate: "01 Jun 2026",
    examDate: "Aug 2026",
    salary: "35,400 - 1,12,400/mo",
    location: "All India",
    state: "All India",
    tab: "latest",
    department: "Indian Railways",
    experience: "Fresher",
    color: "#0e7490",
    badge: "Hot",
    status: "active",
    notificationPdf: "https://www.rrbcdg.gov.in/",
    officialUrl: "https://www.rrbcdg.gov.in/",
    vacancyBreakup: [
      { post: "Station Master", total: "1850", eligibility: "Graduate" },
      { post: "Goods Guard", total: "5620", eligibility: "Graduate" },
      { post: "Senior Clerk cum Typist", total: "2200", eligibility: "Graduate + Typing" },
      { post: "Commercial Apprentice", total: "1888", eligibility: "Graduate" },
    ],
  },
]

/** Full enriched, tagged & SEO-ready government job inventory. */
export const GOVT_JOBS: GovtJob[] = (() => {
  const merged: GovtJobRow[] = [...DETAILED_JOBS, ...FALLBACK_GOVT_JOBS, ...GENERATED_GOVT_JOBS]
  const seen = new Set<string>()
  const out: GovtJob[] = []
  for (const j of merged) {
    const enriched = enrichGovtJob(j)
    if (seen.has(enriched.slug!)) continue
    seen.add(enriched.slug!)
    out.push(enriched)
  }
  return out
})()

// ── Government content datasets ──────────────────────────────────────
function content(items: Omit<GovtContentItem, "slug">[]): GovtContentItem[] {
  return items.map(i => ({ ...i, slug: slugify(`${i.title}`) || i.id }))
}

const CONTENT_SEEDS: Omit<GovtContentItem, "slug">[] = [
  { id: "ac-ibps-clerk", contentType: "admit_cards", title: "IBPS Clerk Prelims Admit Card 2025", org: "IBPS", examName: "IBPS Clerk Prelims", date: "25 Jun 2026", link: "https://www.ibps.in/", color: "#1847d4", badge: "Out" },
  { id: "ac-ssc-gd", contentType: "admit_cards", title: "SSC GD Constable Admit Card 2026", org: "SSC", examName: "SSC GD Constable", date: "10 Jul 2026", link: "https://ssc.gov.in/", color: "#7c3aed", badge: "Out" },
  { id: "ac-rrb-ntpc", contentType: "admit_cards", title: "RRB NTPC CBT-1 Admit Card 2026", org: "RRB", examName: "RRB NTPC", date: "Aug 2026", link: "https://www.rrbcdg.gov.in/", color: "#0e7490" },
  { id: "rs-ibps-po", contentType: "results", title: "IBPS PO XIV Final Result 2025", org: "IBPS", examName: "IBPS PO XIV", date: "12 May 2026", link: "https://www.ibps.in/", color: "#059669", badge: "Declared" },
  { id: "rs-ssc-chsl", contentType: "results", title: "SSC CHSL 2024 Final Result", org: "SSC", examName: "SSC CHSL", date: "02 May 2026", link: "https://ssc.gov.in/", color: "#7c3aed", badge: "Declared" },
  { id: "ak-ctet", contentType: "answer_keys", title: "CTET December 2025 Answer Key", org: "CBSE", examName: "CTET", date: "15 Jan 2026", link: "https://ctet.nic.in/", color: "#059669", badge: "Released" },
  { id: "ak-ssc-cgl", contentType: "answer_keys", title: "SSC CGL Tier-1 Answer Key 2025", org: "SSC", examName: "SSC CGL", date: "20 Dec 2025", link: "https://ssc.gov.in/", color: "#1847d4" },
  { id: "sy-upsc-cse", contentType: "syllabus", title: "UPSC Civil Services Syllabus 2026", org: "UPSC", examName: "UPSC CSE", date: "Updated 2026", link: "https://upsc.gov.in/", color: "#1e3a8a" },
  { id: "sy-ssc-cgl", contentType: "syllabus", title: "SSC CGL Complete Syllabus & Pattern", org: "SSC", examName: "SSC CGL", date: "Updated 2026", link: "https://ssc.gov.in/", color: "#7c3aed" },
  { id: "pp-rrb-ntpc", contentType: "previous_papers", title: "RRB NTPC Previous Year Papers (PDF)", org: "RRB", examName: "RRB NTPC", date: "2016-2024", link: "https://www.rrbcdg.gov.in/", color: "#0e7490" },
  { id: "pp-ibps-po", contentType: "previous_papers", title: "IBPS PO Previous Year Papers (PDF)", org: "IBPS", examName: "IBPS PO", date: "2018-2025", link: "https://www.ibps.in/", color: "#1847d4" },
]

const EXTRA_CONTENT: Omit<GovtContentItem, "slug">[] = [
  { id: "ac-rrb-group-d", contentType: "admit_cards", title: "RRB Group D CBT Admit Card 2026", org: "RRB", examName: "RRB Group D", date: "Jul 2026", link: "https://www.rrbcdg.gov.in/", color: "#0e7490", badge: "Out" },
  { id: "ac-upsc-cds", contentType: "admit_cards", title: "UPSC CDS-II Admit Card 2026", org: "UPSC", examName: "CDS", date: "Aug 2026", link: "https://upsc.gov.in/", color: "#b45309", badge: "Out" },
  { id: "rs-rrb-alp", contentType: "results", title: "RRB ALP Final Result 2025", org: "RRB", examName: "ALP", date: "Apr 2026", link: "https://www.rrbcdg.gov.in/", color: "#0e7490", badge: "Declared" },
  { id: "rs-upsc-nda", contentType: "results", title: "UPSC NDA-II Result 2025", org: "UPSC", examName: "NDA", date: "Mar 2026", link: "https://upsc.gov.in/", color: "#b45309", badge: "Declared" },
  { id: "ak-ibps-po", contentType: "answer_keys", title: "IBPS PO Mains Answer Key 2025", org: "IBPS", examName: "IBPS PO", date: "Jan 2026", link: "https://www.ibps.in/", color: "#1847d4", badge: "Released" },
  { id: "sy-rrb-je", contentType: "syllabus", title: "RRB Junior Engineer Syllabus 2026", org: "RRB", examName: "RRB JE", date: "Updated 2026", link: "https://www.rrbcdg.gov.in/", color: "#0e7490" },
  { id: "sy-banking", contentType: "syllabus", title: "Bank PO Complete Syllabus 2026", org: "IBPS", examName: "Bank PO", date: "Updated 2026", link: "https://www.ibps.in/", color: "#1847d4" },
  { id: "pp-ssc-cgl", contentType: "previous_papers", title: "SSC CGL Previous Papers (PDF)", org: "SSC", examName: "SSC CGL", date: "2019-2025", link: "https://ssc.gov.in/", color: "#7c3aed" },
]

export const GOVT_CONTENT: GovtContentItem[] = content([...CONTENT_SEEDS, ...EXTRA_CONTENT])
