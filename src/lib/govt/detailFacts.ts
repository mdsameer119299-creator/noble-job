/**
 * detailFacts.ts — the text a government detail page derives from a record: page title, meta description, hero chips and
 * the "quick facts" grid. Pulled out of app/jobs/govt/[id]/page.tsx (behaviour unchanged) so it can be tested without the
 * Next runtime, and so that EVERY vacancy figure on the page goes through `displayVacancies` (govt/vacancyFigure.ts):
 * a figure the official notice does not support, and the "Not Specified" / "TBA" placeholders, are never printed.
 */
import { isRealDisplayValue } from "@/lib/jobs/renderable"
import { displayVacancies } from "@/lib/govt/vacancyFigure"
import type { GovtJob } from "@/types/govtJob"

type DetailJob = Pick<GovtJob, "id" | "title" | "org" | "post" | "vacancies" | "qualification" | "lastDate" | "location" | "ageRange" | "fee" | "salary">

/** Non-empty, non-placeholder ("undefined", "N/A", "TBA", …) text worth showing. */
const has = (v: unknown): boolean => isRealDisplayValue(v)

/** <title> text and meta description. Only real values are interpolated — never "undefined" / "TBA" placeholders. */
export function govtDetailMetaText(job: DetailJob): { title: string; description: string } {
  const vac = displayVacancies(job)
  const parts = [
    `${job.org} ${job.title}:`,
    vac ? `${vac} vacancies${has(job.post) ? ` for ${job.post}` : ""}.` : has(job.post) ? `Post: ${job.post}.` : "",
    has(job.qualification) ? `Qualification: ${job.qualification}.` : "",
    has(job.lastDate) ? `Last date: ${job.lastDate}.` : "",
    "Check eligibility, salary, age limit, fee & apply online.",
  ].filter(Boolean)
  return {
    title: vac ? `${job.title} — ${vac} Posts` : job.title,
    description: parts.join(" ").slice(0, 300),
  }
}

/** The chips under the H1. */
export function govtHeroChips(job: DetailJob): string[] {
  const vac = displayVacancies(job)
  return [
    vac ? `👤 ${vac} Vacancies` : "",
    has(job.lastDate) ? `📅 Last Date: ${job.lastDate}` : "",
    has(job.qualification) ? `🎓 ${job.qualification}` : "",
    has(job.location) ? `📍 ${job.location}` : "",
  ].filter(Boolean)
}

/** The Overview "quick facts" grid (label/value pairs with a real value). */
export function govtQuickFacts(job: DetailJob): { l: string; v: string | undefined }[] {
  return [
    { l: "Organisation", v: job.org },
    { l: "Post Name", v: job.post },
    { l: "Total Vacancies", v: displayVacancies(job) },
    { l: "Qualification", v: job.qualification },
    { l: "Age Limit", v: job.ageRange },
    { l: "Application Fee", v: job.fee && job.fee !== "0" ? `₹${job.fee.replace(/[^\d]/g, "")}` : "Nil / Exempted" },
    { l: "Salary", v: job.salary },
    { l: "Job Location", v: job.location },
    { l: "Last Date", v: job.lastDate },
  ].filter(f => has(f.v))
}

/** Whether the "Vacancy Details" section has anything honest to say: a break-up table, or a real total plus a real post. */
export function govtShowsVacancyDetails(job: DetailJob & { vacancyBreakup?: unknown[] }): boolean {
  return Boolean(job.vacancyBreakup?.length || (displayVacancies(job) && has(job.post)))
}
