import type { GovtJob, GovtJobTab } from "@/types/govtJob"

export interface ResolvedGovtLinks {
  applyUrl: string
  officialUrl: string
  notificationPdf?: string
  resultUrl?: string
  admitUrl?: string
  answerUrl?: string
}

interface PortalUrls {
  applyUrl: string
  officialUrl: string
  notificationPdf?: string
}

/** Match by recruiting body short code (most reliable). */
const SHORT_PORTALS: Record<string, PortalUrls> = {
  SSC: { applyUrl: "https://ssc.gov.in/", officialUrl: "https://ssc.gov.in/" },
  RRB: { applyUrl: "https://www.rrbcdg.gov.in/", officialUrl: "https://indianrailways.gov.in/" },
  IBPS: { applyUrl: "https://www.ibps.in/", officialUrl: "https://www.ibps.in/" },
  SBI: { applyUrl: "https://sbi.co.in/web/careers", officialUrl: "https://sbi.co.in/web/careers" },
  UPSC: { applyUrl: "https://upsconline.nic.in/", officialUrl: "https://upsc.gov.in/" },
  IAF: { applyUrl: "https://agnipathvayu.cdac.in/", officialUrl: "https://indianairforce.nic.in/" },
  ARMY: { applyUrl: "https://joinindianarmy.nic.in/", officialUrl: "https://joinindianarmy.nic.in/" },
  NAVY: { applyUrl: "https://www.joinindiannavy.gov.in/", officialUrl: "https://www.indiannavy.nic.in/" },
  CRPF: { applyUrl: "https://rectt.crpf.gov.in/", officialUrl: "https://crpf.gov.in/" },
  BSF: { applyUrl: "https://rectt.bsf.gov.in/", officialUrl: "https://bsf.gov.in/" },
  CISF: { applyUrl: "https://cisfrectt.in/", officialUrl: "https://cisf.gov.in/" },
  CBSE: { applyUrl: "https://ctet.nic.in/", officialUrl: "https://www.cbse.gov.in/" },
  KVS: { applyUrl: "https://kvsangathan.nic.in/", officialUrl: "https://kvsangathan.nic.in/" },
  ONGC: { applyUrl: "https://ongcindia.com/wps/wcm/connect/en/career/", officialUrl: "https://ongcindia.com/" },
  NTPC: { applyUrl: "https://careers.ntpc.co.in/", officialUrl: "https://www.ntpc.co.in/" },
  POST: { applyUrl: "https://indiapostgdsonline.gov.in/", officialUrl: "https://www.indiapost.gov.in/" },
  BOB: { applyUrl: "https://www.bankofbaroda.in/career", officialUrl: "https://www.bankofbaroda.in/" },
  UBI: { applyUrl: "https://www.unionbankofindia.co.in/english/recruitment.aspx", officialUrl: "https://www.unionbankofindia.co.in/" },
  NIACL: { applyUrl: "https://www.niacl.co.in/", officialUrl: "https://www.niacl.co.in/" },
  SECR: { applyUrl: "https://secr.indianrailways.gov.in/", officialUrl: "https://secr.indianrailways.gov.in/" },
  OSSC: { applyUrl: "https://www.odishassc.gov.in/", officialUrl: "https://www.odishassc.gov.in/" },
  CNP: { applyUrl: "https://www.spmcil.com/HR/opening.aspx", officialUrl: "https://www.spmcil.com/" },
  MC: { applyUrl: "https://www.india.gov.in/", officialUrl: "https://www.india.gov.in/" },
  PSC: { applyUrl: "https://www.india.gov.in/", officialUrl: "https://www.india.gov.in/" },
}

/** Fallback when short code is unknown — match org / department text only (not post titles). */
const ORG_PORTALS: { test: RegExp; urls: PortalUrls }[] = [
  { test: /staff selection commission|\bssc\b/i, urls: SHORT_PORTALS.SSC },
  { test: /railway recruitment|\brrb\b|\brrc\b|central railway|indian railways/i, urls: SHORT_PORTALS.RRB },
  { test: /\bibps\b|banking personnel/i, urls: SHORT_PORTALS.IBPS },
  { test: /state bank of india|\bsbi\b/i, urls: SHORT_PORTALS.SBI },
  { test: /union public service|\bupsc\b/i, urls: SHORT_PORTALS.UPSC },
  { test: /indian army|joinindianarmy/i, urls: SHORT_PORTALS.ARMY },
  { test: /indian navy|joinindiannavy/i, urls: SHORT_PORTALS.NAVY },
  { test: /indian air force|agniveer|afcat/i, urls: SHORT_PORTALS.IAF },
  { test: /\bcrpf\b/i, urls: SHORT_PORTALS.CRPF },
  { test: /\bbsf\b/i, urls: SHORT_PORTALS.BSF },
  { test: /\bcisf\b/i, urls: SHORT_PORTALS.CISF },
  { test: /\bkvs\b|kendriya vidyalaya/i, urls: SHORT_PORTALS.KVS },
  { test: /\bcbse\b|\bctet\b/i, urls: SHORT_PORTALS.CBSE },
  { test: /\bongc\b/i, urls: SHORT_PORTALS.ONGC },
  { test: /\bntpc\b/i, urls: SHORT_PORTALS.NTPC },
  { test: /postal|gramin dak|\bgds\b/i, urls: SHORT_PORTALS.POST },
  { test: /bank of baroda|\bbob\b/i, urls: SHORT_PORTALS.BOB },
  { test: /union bank|\bubi\b/i, urls: SHORT_PORTALS.UBI },
  { test: /niacl|new india assurance/i, urls: SHORT_PORTALS.NIACL },
  { test: /odisha ssc|\bossc\b/i, urls: SHORT_PORTALS.OSSC },
  { test: /municipal|safai/i, urls: SHORT_PORTALS.MC },
  { test: /staff selection \/ psc|public service commission|\bpsc\b/i, urls: SHORT_PORTALS.PSC },
]

const DEFAULT_PORTAL: PortalUrls = {
  applyUrl: "https://www.india.gov.in/",
  officialUrl: "https://www.india.gov.in/",
}

function matchPortal(job: Partial<GovtJob>): PortalUrls {
  const short = (job.short || "").trim().toUpperCase()
  if (short && SHORT_PORTALS[short]) return SHORT_PORTALS[short]

  const hay = `${job.org || ""} ${job.department || ""}`
  const orgMatch = ORG_PORTALS.find(p => p.test.test(hay))
  if (orgMatch) return orgMatch.urls

  const titleHay = `${job.org || ""} ${job.title || ""}`
  const titleMatch = ORG_PORTALS.find(p => p.test.test(titleHay))
  return titleMatch?.urls ?? DEFAULT_PORTAL
}

function validUrl(url?: string | null): url is string {
  return typeof url === "string" && url.startsWith("http")
}

/** Fill missing apply / official / notification URLs from known portals. */
export function resolveGovtJobLinks(job: Partial<GovtJob>): ResolvedGovtLinks {
  const portal = matchPortal(job)
  const officialUrl =
    (validUrl(job.officialUrl) && job.officialUrl) ||
    (validUrl(job.official_url) && job.official_url) ||
    portal.officialUrl
  const applyUrl = (validUrl(job.applyUrl) && job.applyUrl) || officialUrl
  const notificationPdf =
    (validUrl(job.notificationPdf) && job.notificationPdf) ||
    (validUrl(job.notificationUrl) && job.notificationUrl) ||
    (validUrl(job.notification_url) && job.notification_url) ||
    portal.notificationPdf ||
    officialUrl

  const fallback = officialUrl

  return {
    applyUrl,
    officialUrl,
    notificationPdf,
    resultUrl: (validUrl(job.resultUrl) && job.resultUrl) || (validUrl(job.result_url) && job.result_url) || fallback,
    admitUrl: (validUrl(job.admitUrl) && job.admitUrl) || (validUrl(job.admit_url) && job.admit_url) || fallback,
    answerUrl: (validUrl(job.answerUrl) && job.answerUrl) || (validUrl(job.answer_url) && job.answer_url) || fallback,
  }
}

export interface GovtLinkButton {
  l: string
  href: string
  primary?: boolean
}

function primaryForTab(tab: GovtJobTab | undefined, urls: ResolvedGovtLinks): GovtLinkButton | null {
  if (tab === "results") return { l: "Check Result", href: urls.resultUrl!, primary: true }
  if (tab === "admit") return { l: "Download Admit Card", href: urls.admitUrl!, primary: true }
  if (tab === "answer") return { l: "Download Answer Key", href: urls.answerUrl!, primary: true }
  if (tab === "latest" || tab === "upcoming") return { l: "Apply Online", href: urls.applyUrl, primary: true }
  return null
}

/** Standard link buttons for detail page, modal, and sidebars. */
export function buildGovtJobLinkButtons(job: Partial<GovtJob>): GovtLinkButton[] {
  const urls = resolveGovtJobLinks(job)
  const tab = job.tab
  const primary = primaryForTab(tab, urls)
  const seen = new Set<string>()
  const out: GovtLinkButton[] = []

  const add = (btn: GovtLinkButton) => {
    if (!btn.href?.startsWith("http") || seen.has(btn.href)) return
    seen.add(btn.href)
    out.push(btn)
  }

  if (primary) add(primary)

  const rest: GovtLinkButton[] = [
    { l: "Apply Online", href: urls.applyUrl },
    { l: "Download Notification PDF", href: urls.notificationPdf! },
    { l: "Official Website", href: urls.officialUrl },
    { l: "Download Admit Card", href: urls.admitUrl! },
    { l: "Check Result", href: urls.resultUrl! },
    { l: "Answer Key", href: urls.answerUrl! },
  ]

  for (const btn of rest) {
    if (primary && btn.l === primary.l) continue
    add(btn)
  }

  return out
}
