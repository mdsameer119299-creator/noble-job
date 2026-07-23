import { getAdminSettings } from "@/lib/services/siteContentService"
import { classifyProvenance, type Classifiable } from "@/lib/jobs/provenance"

const KEY = "synthetic_jobs_visible"

/**
 * Admin kill-switch for synthetic/demo job rows. Missing key = visible
 * (default ON) — admin_settings is not seeded, so absence must not be
 * mistaken for an explicit OFF.
 */
export async function isSyntheticJobsVisible(): Promise<boolean> {
  const settings = await getAdminSettings()
  return settings[KEY] !== "false"
}

/**
 * Drops SYNTHETIC rows when the toggle is OFF. Deliberately narrower than
 * `isGenuine` — this only hides generated demo content, not real-but-
 * UNCLASSIFIED rows (that's a separate, unrelated trust axis).
 */
export function applySyntheticVisibility<T extends Classifiable>(jobs: T[], visible: boolean): T[] {
  return visible ? jobs : jobs.filter(j => classifyProvenance(j) !== "SYNTHETIC")
}
