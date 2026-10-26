/** Central SEO configuration for Noble Job */
export const SITE_NAME = "Noble Job"
export const SITE_TAGLINE = "Find The Right Job, Build Your Bright Future"
export const SITE_DESCRIPTION =
  "Noble Job is India's trusted job portal — browse Jobs in India including Government Jobs, Private Jobs, Work From Home Jobs, and Abroad Jobs. Listings from external sources link to the original application page."

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

export const SUPPORT_EMAIL = "support@noblejob.in"
export const SUPPORT_PHONE = "+91-9971177468"
