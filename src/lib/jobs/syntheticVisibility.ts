import { getAdminSettings } from "@/lib/services/siteContentService"
import { classifyProvenance, type Classifiable } from "@/lib/jobs/provenance"

const KEY = "synthetic_jobs_visible"

/**
 * Admin kill-switch for synthetic/demo job rows.
 *
 * Production is fail-closed: when the setting is absent, generated inventory is
 * hidden. Samples must never become candidate-facing content just because an
 * admin setting was not seeded. An explicit "true" can still be used by an
 * administrator for a controlled internal/demo environment.
 */
export async function isSyntheticJobsVisible(): Promise<boolean> {
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
