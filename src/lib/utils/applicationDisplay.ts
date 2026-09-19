import type { Application } from "@/types/application"

export function applicationJobTitle(app: Application): string {
  if (app.job?.title) return app.job.title
  if (!app.notes) return "Job application"
  try {
    const meta = JSON.parse(app.notes)
    return meta.title || meta.externalJobId || "Job application"
  } catch {
    return app.notes.slice(0, 80)
  }
}

export function applicationCompany(app: Application): string {
  if ((app.job as { company?: string })?.company) return (app.job as { company: string }).company
  if (!app.notes) return ""
  try {
    const meta = JSON.parse(app.notes)
    return meta.company || ""
  } catch {
    return ""
  }
}

/**
 * Was this application actually DELIVERED to an employer? Every application created
 * today has an owning employer. Older records were stored "ownerless" (no employer
 * received them) — they are kept, but shown honestly instead of as a pending
 * application that no one will ever read.
 */
export const NOT_SENT_NOTE =
  "Not sent to an employer — no employer on Noble Job received this application. If the original listing has its own application link, apply there."

export function isDeliveredToEmployer(app: Pick<Application, "employer_id">): boolean {
  return Boolean(app.employer_id)
}
