/**
 * govtSources.ts — central configuration for automated government-job updates.
 *
 * Every auto-update source lives here so the daily scheduler (see
 * src/lib/services/govtAutoUpdate.ts and /api/cron/govt-jobs) can be managed
 * from one place. Add/disable a source by editing this list — no code changes
 * elsewhere are required.
 */
import type { GovtJobTab } from "@/types/govtJob"

export type GovtSourceKind = "rss" | "json" | "html" | "api"

export interface GovtSource {
  /** Stable identifier (used for de-duplication of ingested notifications). */
  id: string
  label: string
  kind: GovtSourceKind
  /** Endpoint / feed URL to poll. */
  url: string
  /** Which category newly-ingested jobs default into. */
  defaultTab: GovtJobTab
  /** Sector tags used for routing into Railway / Banking / SSC / etc. */
  sectors?: GovtJobTab[]
  enabled: boolean
  /** Cron-style hint; the scheduler currently runs daily. */
  schedule: "daily" | "hourly" | "weekly"
}

export const GOVT_SOURCES: GovtSource[] = [
  { id: "sarkari-result", label: "SarkariResult (Latest)", kind: "html", url: "https://www.sarkariresult.com/", defaultTab: "latest", enabled: true, schedule: "daily" },
  { id: "upsc-official", label: "UPSC Official", kind: "html", url: "https://upsc.gov.in/whats-new", defaultTab: "latest", sectors: ["upsc"], enabled: true, schedule: "daily" },
  { id: "ssc-official", label: "SSC Official", kind: "html", url: "https://ssc.gov.in/", defaultTab: "latest", sectors: ["ssc"], enabled: true, schedule: "daily" },
  { id: "rrb-cen", label: "Railway RRB CEN", kind: "html", url: "https://www.rrbcdg.gov.in/", defaultTab: "latest", sectors: ["railway"], enabled: true, schedule: "daily" },
  { id: "ibps", label: "IBPS Notifications", kind: "html", url: "https://www.ibps.in/", defaultTab: "latest", sectors: ["banking"], enabled: true, schedule: "daily" },
  { id: "nta-results", label: "NTA Results & Answer Keys", kind: "html", url: "https://nta.ac.in/", defaultTab: "results", enabled: true, schedule: "daily" },
  { id: "scholarships-nsp", label: "National Scholarship Portal", kind: "html", url: "https://scholarships.gov.in/", defaultTab: "scholarships", enabled: false, schedule: "weekly" },
]

export const SCHEDULER_CONFIG = {
  /** Run window the cron is expected to invoke /api/cron/govt-jobs. */
  cron: "0 6 * * *", // every day at 06:00 server time
  /** New notifications auto-publish immediately; set false to require admin review. */
  autoPublish: true,
  /** Max notifications ingested per source per run. */
  maxPerSourcePerRun: 50,
  /** Header value required to authorize the cron endpoint (set CRON_SECRET in env). */
  secretEnvVar: "CRON_SECRET",
}
