/** Central SEO configuration for Noble Job */
export const SITE_NAME = "Noble Job"
export const SITE_TAGLINE = "Find The Right Job, Build Your Bright Future"
export const SITE_DESCRIPTION =
  "Noble Job is India's trusted job portal — browse Jobs in India including Government Jobs, Private Jobs, Work From Home Jobs, and Abroad Jobs. Apply to verified openings from top employers."

export const DEFAULT_KEYWORDS = [
  "Jobs in India",
  "Job Portal India",
  "Government Jobs",
  "Private Jobs",
  "Work From Home Jobs",
  "WFH Jobs",
  "Abroad Jobs",
  "Noble Job",
  "NCC Foundation",
  "sarkari naukri",
  "fresher jobs India",
] as const

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://www.noblejob.in").replace(/\/$/, "")
}

export const ORG_LOGO = "/opengraph-image"

/**
 * Applicant country asserted for a fully-remote job on the Work-From-Home board
 * (`applicantLocationRequirements`). The WFH board is NobleJob's India board and
 * no per-job applicant country is stored yet, so this board-level default is the
 * ONE place that assumption lives. Remove it (and store a per-job value) if WFH
 * roles open to applicants outside India are ever listed.
 */
export const WFH_APPLICANT_COUNTRY_ISO = "IN"
export const SUPPORT_EMAIL = "support@noblejob.in"
export const SUPPORT_PHONE = "+91-9971177468"
