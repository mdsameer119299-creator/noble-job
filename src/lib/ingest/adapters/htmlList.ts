/**
 * htmlList.ts — generic HTML notification-list adapter.
 *
 * Many official portals server-render their notice list as anchors whose TEXT or
 * title attribute already names the recruitment (e.g. MPPSC, HPSC, state police).
 * The PDF-feed adapter under-delivers on these because it downloads and content-
 * classifies every PDF (isRecruitmentPdf), which rejects results/marks PDFs and
 * is slow. This adapter instead TRUSTS the anchor title: it keeps links whose
 * title/href matches a recruitment pattern and drops results/admit/answer-key
 * noise — no PDF download, far higher yield, fast enough for one cron pass.
 *
 * Use for sources whose list page is in the server HTML. JS-rendered portals
 * (RPSC) still need the Playwright adapter.
 */
import type { SourceAdapter, RawNotification } from "../types"
import { fetchHtml } from "../http"

export interface HtmlListConfig {
  id: string
  label: string
  org: string
  listUrl: string
  /** Authoritative state tagging (omit for national sources). */
  stateSlug?: string
  stateName?: string
  /** Keep anchors whose title/href matches this (default: recruitment terms). */
  keep?: RegExp
  /** Drop anchors whose title matches this (default: results/admit/answer/etc). */
  drop?: RegExp
  /** Only consider anchors whose href contains this substring (e.g. "advertisement"). */
  hrefIncludes?: string
  /** Derive a title from the file name when anchor text is empty. */
  titleFromHref?: boolean
  maxItems?: number
  enabled?: boolean
}

const DEFAULT_KEEP = /\b(recruit|advertis|advt|vacan|notification|appli|invited|direct recruitment|engagement|walk[- ]?in|posts?\b)/i
const DEFAULT_DROP = /\b(result|answer key|marks|merit|interview|admit card|hall ticket|cut[- ]?off|selection list|score|revised|corrigend|syllabus|exam date|time table|calendar)\b/i

function decode(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#\d+;/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim()
}

function abs(href: string, base: string): string | null {
  try { return new URL(href.replace(/ /g, "%20"), base).href } catch { return null }
}

function titleFromFilename(href: string): string {
  const f = href.split("/").pop()?.replace(/\.[a-z0-9]+(\?.*)?$/i, "") || ""
  return decode(f.replace(/[_\-]+/g, " ").replace(/\b[0-9a-f]{8,}\b/gi, "").replace(/\d{6,}/g, "")).trim()
}

/** Build a list adapter that parses notice anchors from server-rendered HTML. */
export function makeHtmlListAdapter(cfg: HtmlListConfig): SourceAdapter {
  const keep = cfg.keep ?? DEFAULT_KEEP
  const drop = cfg.drop ?? DEFAULT_DROP
  return {
    id: cfg.id,
    label: cfg.label,
    kind: "html",
    enabled: cfg.enabled ?? false,
    async fetch(): Promise<RawNotification[]> {
      const html = await fetchHtml(cfg.listUrl, 18000)
      const out: RawNotification[] = []
      const seen = new Set<string>()

      // Match anchors with quoted or unquoted href; capture full tag + inner text.
      for (const a of html.matchAll(/<a\b([^>]*?)href=("?'?)([^"'>\s]+)\2'?([^>]*)>([\s\S]*?)<\/a>/gi)) {
        const pre = a[1], href = a[3], post = a[4], inner = a[5]
        if (cfg.hrefIncludes && !href.toLowerCase().includes(cfg.hrefIncludes.toLowerCase())) continue
        const titleAttr = (`${pre} ${post}`.match(/title=["']([^"']+)["']/i) || [])[1]
        // Prefer an English-rich title: anchor text is often Hindi/Kannada while
        // the title attribute / filename carries the English description.
        const asciiRich = (s: string) => (s.match(/[A-Za-z]/g) || []).length >= 8
        const candidates = [decode(inner), decode(titleAttr || ""), cfg.titleFromHref ? titleFromFilename(href) : ""]
        let title = candidates.find(c => c.length >= 8 && asciiRich(c)) || candidates.find(c => c.length >= 8) || ""
        if (!title) continue

        const hay = `${title} ${href}`
        if (!keep.test(hay) || drop.test(title)) continue

        const url = abs(href, cfg.listUrl)
        if (!url) continue
        const key = title.toLowerCase().replace(/\s+/g, " ").slice(0, 90)
        if (seen.has(key)) continue
        seen.add(key)

        const isPdf = /\.pdf(\?|$)/i.test(url)
        out.push({
          externalId: `${cfg.id}-${key.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70)}`,
          title: `${cfg.org} ${title}`.replace(/\s+/g, " ").trim().slice(0, 150),
          org: cfg.org,
          post: title.slice(0, 120),
          lastDate: "TBA",
          ...(cfg.stateName ? { state: cfg.stateName, location: cfg.stateName } : {}),
          ...(cfg.stateSlug ? { stateSlug: cfg.stateSlug } : {}),
          officialUrl: cfg.listUrl,
          notificationPdf: isPdf ? url : undefined,
          tab: "latest",
        })
        if (out.length >= (cfg.maxItems ?? 30)) break
      }
      return out
    },
  }
}
