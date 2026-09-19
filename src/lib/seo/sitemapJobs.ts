/**
 * sitemapJobs.ts — reads the GENUINE private / WFH / abroad rows the sitemap may
 * list, straight from Supabase (never from the local synthetic inventory).
 *
 * Server-only and cookie-less (service role) so the sitemap stays statically
 * revalidated. Throws on a database error: the sitemap treats that as "keep the
 * previous good sitemap" rather than silently publishing one with every job
 * URL missing.
 */
import { useLocalInventoryOnly } from "@/lib/supabase/useLocalInventory"
import { isMissingColumnError } from "@/lib/supabase/columnErrors"
import type { SitemapJobBoard, SitemapJobRow } from "@/lib/seo/sitemapPolicy"

const TABLE: Record<SitemapJobBoard, "jobs" | "wfh_jobs" | "abroad_jobs"> = {
  private: "jobs",
  wfh: "wfh_jobs",
  abroad: "abroad_jobs",
}

const BASE_COLUMNS: Record<SitemapJobBoard, string> = {
  // title/company/description/location|country: the completeness columns the
  // "no empty jobs" gate needs, so an incomplete row can never be listed.
  private: "id, posted_at, provenance, apply_url, employer_id, is_verified, job_status, status, source, title, company, description, location",
  wfh: "id, posted_at, provenance, apply_url, employer_id, status, title, company, description",
  abroad: "id, posted_at, provenance, apply_url, employer_id, status, title, company, description, country",
}

export const SITEMAP_ROWS_PER_BOARD = 2000

/**
 * Do the job DETAIL routes serve database rows? Only with Supabase configured AND
 * `NEXT_PUBLIC_JOB_DATA_SOURCE=supabase` — otherwise `getJobById` & co. resolve ids
 * against the local inventory alone, so a database job would 404. A sitemap URL (and a
 * "live jobs" count) must never point at a page that does not open, so both use the
 * same switch the detail pages use.
 */
export function detailPagesServeDatabase(): boolean {
  return !useLocalInventoryOnly()
}

/**
 * Newest genuine-candidate rows for a board. Returns [] when Supabase is not configured
 * or the detail pages are not serving database rows (see detailPagesServeDatabase).
 */
export async function readSitemapJobRows(board: SitemapJobBoard): Promise<SitemapJobRow[]> {
  if (!detailPagesServeDatabase()) return []
  const { supabaseAdmin } = await import("@/lib/supabase/admin")

  // `application_deadline` arrives with migration 20260727000002; read it when it
  // exists, fall back to the base columns before the migration is applied.
  const run = async (columns: string) =>
    supabaseAdmin
      .from(TABLE[board])
      .select(columns as "*")
      .eq("status", "active")
      .order("posted_at", { ascending: false })
      .limit(SITEMAP_ROWS_PER_BOARD)

  let res = await run(`${BASE_COLUMNS[board]}, application_deadline`)
  if (res.error && isMissingColumnError(res.error)) res = await run(BASE_COLUMNS[board])
  if (res.error) throw new Error(`sitemap ${board} read failed: ${res.error.message}`)
  return ((res.data ?? []) as unknown) as SitemapJobRow[]
}
