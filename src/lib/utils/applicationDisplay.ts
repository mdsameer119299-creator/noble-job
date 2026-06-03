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
