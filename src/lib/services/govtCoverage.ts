/**
 * govtCoverage.ts — admin monitoring report for government-job coverage.
 *
 * Read-only aggregation over govt_jobs (service-role) that answers the four
 * questions an operator needs to grow real state coverage:
 *   1. State-wise active job count (which states have real data, which are bare)
 *   2. National (All-India) active job count
 *   3. Jobs mis-tagged: a real state name but no state_slug (normalisation gaps)
 *   4. Jobs expiring in the next 30 days (renewal / re-ingest watchlist)
 *
 * Surfaced in the admin dashboard (/admin/govt-jobs). Pairs with
 * getGovtIngestMetrics (last-sync / failed sources) from govtAutoUpdate.
 */
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { INDIAN_STATES } from "@/lib/config/govtTaxonomy"
import { parseLastDate } from "@/lib/utils/govtJobExpiry"

export interface StateCoverageRow {
  slug: string
  label: string
  jobs: number
}

export interface ExpiringJobRow {
  id: string
  title: string
  state: string | null
  lastDate: string
  daysLeft: number
}

export interface GovtCoverageReport {
  totalActive: number
  nationalJobs: number
  stateJobs: number
  statesCovered: number
  statesEmpty: number
  /** Active rows whose state names a real state but state_slug is null/empty. */
  misTagged: number
  perState: StateCoverageRow[]
  expiringSoon: ExpiringJobRow[]
}

const STATE_LABEL = new Map(INDIAN_STATES.map(s => [s.slug, s.label]))

function isNational(state: string | null, slug: string | null): boolean {
  return !slug || (state || "").toLowerCase() === "all india"
}

const EMPTY: GovtCoverageReport = {
  totalActive: 0, nationalJobs: 0, stateJobs: 0, statesCovered: 0,
  statesEmpty: INDIAN_STATES.length, misTagged: 0, perState: [], expiringSoon: [],
}

export async function getGovtCoverageReport(): Promise<GovtCoverageReport> {
  if (!isSupabaseConfigured()) return EMPTY
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin")
    const { data, error } = await supabaseAdmin
      .from("govt_jobs")
      .select("id, title, state, state_slug, last_date")
      .eq("status", "active")
    if (error || !data) return EMPTY

    const rows = data as { id: string; title: string; state: string | null; state_slug: string | null; last_date: string | null }[]

    let nationalJobs = 0
    let misTagged = 0
    const counts = new Map<string, number>()
    for (const r of rows) {
      if (isNational(r.state, r.state_slug)) {
        nationalJobs++
        continue
      }
      // Has a non-All-India state. If the slug is present, count it; if absent,
      // it's a normalisation gap (real state name that never got slugified).
      if (r.state_slug) counts.set(r.state_slug, (counts.get(r.state_slug) ?? 0) + 1)
      else misTagged++
    }

    const perState: StateCoverageRow[] = INDIAN_STATES
      .map(s => ({ slug: s.slug, label: s.label, jobs: counts.get(s.slug) ?? 0 }))
      .sort((a, b) => b.jobs - a.jobs || a.label.localeCompare(b.label))

    const statesCovered = perState.filter(s => s.jobs > 0).length

    // Expiring within 30 days (valid future date only; placeholders excluded).
    const now = Date.now()
    const horizon = 30
    const expiringSoon: ExpiringJobRow[] = rows
      .map(r => {
        const d = parseLastDate(r.last_date)
        if (!d) return null
        const daysLeft = Math.ceil((d.getTime() - now) / 86_400_000)
        if (daysLeft < 0 || daysLeft > horizon) return null
        return {
          id: r.id,
          title: r.title,
          state: isNational(r.state, r.state_slug) ? "All India" : r.state,
          lastDate: r.last_date as string,
          daysLeft,
        }
      })
      .filter((x): x is ExpiringJobRow => x !== null)
      .sort((a, b) => a.daysLeft - b.daysLeft)

    return {
      totalActive: rows.length,
      nationalJobs,
      stateJobs: rows.length - nationalJobs,
      statesCovered,
      statesEmpty: INDIAN_STATES.length - statesCovered,
      misTagged,
      perState,
      expiringSoon,
    }
  } catch {
    return EMPTY
  }
}
