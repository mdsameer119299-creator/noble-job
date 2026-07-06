/**
 * govtProvenance.ts — adapt a GovtJob to the provenance classifier.
 *
 * The `govt_jobs` table has no `provenance` column, so government rows are
 * classified from evidence at runtime. A row is only OFFICIAL (and therefore
 * genuine / indexable / schema-eligible) when it carries a REAL official or
 * notification URL — never merely because it is on the government board.
 */
import type { GovtJob } from "@/types/govtJob"
import { type Classifiable, isSchemaEligible, isIndexable, classifyProvenance } from "./provenance"

export function govtClassifiable(job: GovtJob): Classifiable {
  return {
    id: job.id,
    board: "govt",
    // No stored provenance for govt rows — force evidence-based classification.
    provenance: undefined,
    jobStatus: job.jobStatus,
    officialUrl: job.officialUrl,
    official_url: job.official_url,
    notificationUrl: job.notificationUrl,
    notification_url: job.notification_url,
    notificationPdf: job.notificationPdf,
    applyUrl: job.applyUrl,
  }
}

export { isSchemaEligible, isIndexable, classifyProvenance }
