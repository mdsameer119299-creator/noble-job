import { getAdminSettings } from "@/lib/services/siteContentService"
import { classifyProvenance, type Classifiable } from "@/lib/jobs/provenance"

const KEY = "synthetic_jobs_visible"

/**
 * Admin kill-switch for synthetic/demo job rows.
 *
 * Candidate-facing production is always fail-closed: generated inventory can
 * never be presented as a live vacancy, even if an old admin setting was left
 * enabled. The setting remains useful for local/demo environments.
 */
export async function isSyntheticJobsVisible(): Promise<boolean> {
  if (process.env.NODE_ENV === "production") return false
  const settings = await getAdminSettings()
  return settings[KEY] === "true"
}

/**
 * Drops SYNTHETIC rows when the toggle is OFF. Deliberately narrower than
 * `isGenuine` — real-but-UNCLASSIFIED rows are still rejected by the normal
 * renderability/provenance gates rather than being silently treated as samples.
 */
export function applySyntheticVisibility<T extends Classifiable>(jobs: T[], visible: boolean): T[] {
  return visible ? jobs : jobs.filter(j => classifyProvenance(j) !== "SYNTHETIC")
}
