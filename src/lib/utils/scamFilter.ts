/**
 * scamFilter.ts — Server-side scam job detection
 *
 * Ported from SCAM_KEYWORDS and isScam() in the original js-live-jobs script.
 * Now runs server-side BEFORE any job is stored or returned via API.
 *
 * Checks:
 *  1. Keyword blacklist (40 scam terms from original)
 *  2. Salary sanity check (INR > 1 crore/year or USD > 500K = suspect)
 *  3. Trusted company boost (bypass some checks for verified companies)
 *
 * Used in: himalayasService.ts, jobService.ts, admin job approval.
 */
import { SCAM_KEYWORDS, containsScamKeyword } from "@/lib/constants/scamKeywords"
import { TRUSTED_COMPANIES } from "@/lib/constants/trustedCompanies"

export interface ScamCheckInput {
  title:      string
  company:    string
  description?: string
  minSalary?: number
  maxSalary?: number
  currency?:  string
}

export function isScam(job: ScamCheckInput): boolean {
  const text = `${job.title} ${job.company} ${job.description ?? ""}`.toLowerCase()

  // 1. Keyword blacklist
  if (containsScamKeyword(text)) return true

  // 2. Salary sanity check
  if (job.minSalary && job.minSalary > 0) {
    if (job.currency === "INR" && job.minSalary > 10_000_000) return true
    if (job.currency === "USD" && job.minSalary > 500_000) return true
  }

  return false
}

export function isTrustedCompany(companyName: string): boolean {
  const lower = companyName.toLowerCase()
  return TRUSTED_COMPANIES.some(c => lower.includes(c.toLowerCase()))
}
