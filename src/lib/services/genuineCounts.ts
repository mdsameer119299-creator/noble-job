/**
 * genuineCounts.ts — the one honest "live jobs" number.
 *
 * NO EMPTY JOBS: a headline count must equal the number of jobs a candidate can
 * actually open and act on. It is therefore computed with EXACTLY the predicate the
 * sitemap uses for private / WFH / abroad rows (`jobRowsToSitemapEntries`: genuine +
 * open + renderable) and, for government jobs, the servable pool filtered to
 * actionable rows. Raw `count: exact` over `status = active` is never used — it
 * includes samples, incomplete rows and rows past their deadline.
 *
 * Server-only. Returns 0 when nothing can be counted; never a made-up figure.
 */
import { readSitemapJobRows, SITEMAP_ROWS_PER_BOARD } from "@/lib/seo/sitemapJobs"
import { jobRowsToSitemapEntries, type SitemapJobBoard } from "@/lib/seo/sitemapPolicy"
import { filterActionable } from "@/lib/jobs/renderable"

const BOARDS: SitemapJobBoard[] = ["private", "wfh", "abroad"]

export interface GenuineJobCounts {
  private: number
  wfh: number
  abroad: number
  govt: number
  total: number
}

export async function getGenuineJobCounts(): Promise<GenuineJobCounts> {
  const perBoard = await Promise.all(
    BOARDS.map(async b => {
      try {
        const rows = await readSitemapJobRows(b)
        return jobRowsToSitemapEntries(b, rows, "https://count.invalid", { limit: SITEMAP_ROWS_PER_BOARD }).length
      } catch {
        return 0
      }
    }),
  )
  let govt = 0
  try {
    const { getActiveGovtRows } = await import("@/lib/services/govtStatsSource")
    govt = filterActionable(await getActiveGovtRows(), "govt").length
  } catch {
    govt = 0
  }
  const [priv, wfh, abroad] = perBoard
  return { private: priv, wfh, abroad, govt, total: priv + wfh + abroad + govt }
}
