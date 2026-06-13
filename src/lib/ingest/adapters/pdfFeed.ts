/**
 * makePdfFeedAdapter — reusable adapter for official orgs that publish
 * recruitment as PDF links on a GET-accessible page (PSUs, AIIMS/ESIC, DRDO,
 * AAI, etc.). Fetches the list, downloads each candidate PDF, classifies it
 * (isRecruitmentPdf), extracts fields, and emits only genuine recruitments.
 *
 * Quality first: scanned/non-recruitment PDFs are rejected (no false positives).
 */
import type { SourceAdapter, RawNotification } from "../types"
import { extractPdfText, isRecruitmentPdf, parseRecruitmentFields } from "../pdf"

const UA = "Mozilla/5.0 (compatible; NobleJobBot/1.0; +https://www.noblejob.in)"

export interface PdfFeedConfig {
  id: string
  label: string
  /** Organisation display name used in titles. */
  org: string
  /** GET-accessible page listing recruitment PDFs. */
  listUrl: string
  /** Cap PDFs fetched per run (time budget). Default 10. */
  maxPdfs?: number
  /** Default true; set false to keep registered but unpolled. */
  enabled?: boolean
}

function abs(href: string, base: string): string | null {
  try { return new URL(href, base).href } catch { return null }
}

function decode(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#\d+;/g, " ").replace(/\s+/g, " ").trim()
}

const ANCHOR_HINT = /recruit|advert|advt|vacanc|\bpost\b|junior exec|engineer|officer|trainee|apprentice|scientist|consultant|faculty|applications?\s+invited|notification/i

export function makePdfFeedAdapter(cfg: PdfFeedConfig): SourceAdapter {
  return {
    id: cfg.id,
    label: cfg.label,
    kind: "pdf",
    enabled: cfg.enabled ?? true,
    async fetch(): Promise<RawNotification[]> {
      const res = await fetch(cfg.listUrl, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(18000), cache: "no-store" })
      if (!res.ok) throw new Error(`list HTTP ${res.status}`)
      const html = await res.text()

      const candidates: { url: string; anchor: string }[] = []
      const seen = new Set<string>()
      for (const a of html.matchAll(/<a[^>]+href="([^"]+\.pdf[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
        const url = abs(a[1], cfg.listUrl)
        const anchor = decode(a[2])
        if (!url || seen.has(url)) continue
        if (!ANCHOR_HINT.test(anchor || url)) continue
        seen.add(url)
        candidates.push({ url, anchor })
      }

      const out: RawNotification[] = []
      for (const c of candidates.slice(0, cfg.maxPdfs ?? 10)) {
        const text = await extractPdfText(c.url)
        if (!isRecruitmentPdf(text)) continue // reject scanned / non-recruitment

        const f = parseRecruitmentFields(text)
        const year = (f.lastDate?.match(/20\d{2}/) || text.match(/20\d{2}/) || ["2026"])[0]
        // Reliable advt number: prefer the filename (e.g. advt_157.pdf → 157), then text.
        const advtFromUrl = (c.url.match(/advt[_\-]?(\d{1,4})/i) || [])[1]
        const advtNo = advtFromUrl || f.advtNo
        // Use a clean extracted post for the DB field only — never the noisy fallback in the title.
        const post = f.post || "Various Posts"
        const fileKey = (advtNo || c.url.split("/").pop()?.replace(/\.pdf.*$/i, "") || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60)

        out.push({
          externalId: `${cfg.id}-${fileKey}`,
          // Clean, deterministic, verifiable title (no fragile text fragments).
          title: `${cfg.org} Recruitment${advtNo ? ` (Advt ${advtNo})` : ""} ${year}`.replace(/\s+/g, " ").trim().slice(0, 150),
          org: cfg.org,
          post,
          vacancies: f.vacancy || "TBA",
          qualification: f.qualification,
          lastDate: f.lastDate || "TBA",
          officialUrl: cfg.listUrl,
          notificationPdf: c.url,
          tab: "latest",
        })
      }
      return out
    },
  }
}
