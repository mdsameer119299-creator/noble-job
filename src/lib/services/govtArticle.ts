/**
 * govtArticle.ts — automatic article + SEO-section generation for govt jobs.
 *
 * Given a raw notification's structured fields, synthesises the full set of
 * detail-page sections (overview, eligibility, age limit, salary, selection
 * process, fee, exam pattern, important dates, FAQs and a long-form article).
 *
 * Used both at fallback-enrichment time and by the daily auto-update pipeline
 * so every newly-imported notification immediately has a complete SEO page.
 */
import type { GovtJob, GovtImportantDate, GovtFaq } from "@/types/govtJob"
import { resolveGovtJobLinks } from "@/lib/services/govtOfficialLinks"

function feeBreakup(fee: string): { category: string; amount: string }[] {
  const amt = (fee || "").replace(/[^\d]/g, "")
  if (!amt || amt === "0") {
    return [{ category: "All Categories", amount: "No Fee / Exempted" }]
  }
  return [
    { category: "General / OBC / EWS", amount: `₹${amt}` },
    { category: "SC / ST / PwBD", amount: "₹0 (Exempted)" },
    { category: "All Female Candidates", amount: "₹0 (Exempted)" },
  ]
}

function buildDates(job: Partial<GovtJob>): GovtImportantDate[] {
  const d: GovtImportantDate[] = []
  if (job.startDate) d.push({ label: "Application Start Date", date: job.startDate })
  d.push({ label: "Last Date to Apply", date: job.lastDate || "Refer Notification" })
  d.push({ label: "Last Date for Fee Payment", date: job.lastDate || "Refer Notification" })
  if (job.examDate) d.push({ label: "Exam Date", date: job.examDate })
  else d.push({ label: "Exam Date", date: "To be announced" })
  return d
}

function buildHowToApply(job: Partial<GovtJob>): string[] {
  const title = job.title || "this recruitment"
  const { applyUrl, officialUrl } = resolveGovtJobLinks(job)
  const feeNote =
    job.fee && job.fee !== "0"
      ? `Pay the application fee of ₹${job.fee.replace(/[^\d]/g, "")} online (SC/ST/PwBD and female candidates are usually exempted).`
      : "No application fee is required for eligible candidates (verify in the official notification)."

  return [
    `Visit the official recruitment portal: ${applyUrl}`,
    `On ${job.org || "the recruiting body"} website (${officialUrl}), open the active notification for ${title}.`,
    "Click on “New Registration” / “Apply Online” and create a login ID with a valid mobile number and email.",
    "Fill the application form carefully — personal details, educational qualification, category, and post preference.",
    "Upload scanned photograph, signature and required certificates in the prescribed format and size.",
    feeNote,
    `Submit the form before the last date (${job.lastDate || "mentioned in notification"}) and save / print the confirmation page.`,
    "Keep login credentials and application number safe for admit card, result and document verification stages.",
  ]
}

function buildFaqs(job: Partial<GovtJob>): GovtFaq[] {
  const title = job.title || "this recruitment"
  const { applyUrl } = resolveGovtJobLinks(job)
  return [
    { q: `What is the last date to apply for ${title}?`, a: `The last date to submit the online application for ${title} is ${job.lastDate || "mentioned in the official notification"}.` },
    { q: `How can I apply online for ${title}?`, a: `Apply on the official portal at ${applyUrl} before the last date. Follow the step-by-step “How to Apply” section on this page.` },
    { q: `How many vacancies are available?`, a: `A total of ${job.vacancies || "multiple"} vacancies are notified by ${job.org || "the recruiting body"}.` },
    { q: `What is the educational qualification required?`, a: `Candidates must possess ${job.qualification || "the qualification specified in the official notification"} from a recognised board/university.` },
    { q: `What is the application fee?`, a: `The application fee is ${job.fee && job.fee !== "0" ? `₹${job.fee.replace(/[^\d]/g, "")} for General/OBC candidates` : "nil / exempted"}. SC/ST/PwBD and female candidates are usually exempted.` },
    { q: `Is there an age limit?`, a: `Yes, the age limit is ${job.ageRange || "as specified in the notification"}. Age relaxation applies as per government rules.` },
  ]
}

export interface GeneratedArticle {
  overview: string
  eligibility: string
  ageLimit: string
  salaryDetails: string
  selectionProcess: string[]
  feeDetails: { category: string; amount: string }[]
  examPattern: string
  importantDates: GovtImportantDate[]
  faqs: GovtFaq[]
  howToApply: string[]
  article: string
}

/** How-to-apply steps for any job (enriched or raw). */
export function getGovtHowToApplySteps(job: Partial<GovtJob>): string[] {
  if (job.howToApply?.length) return job.howToApply
  return buildHowToApply(job)
}

export function generateGovtArticle(job: Partial<GovtJob>): GeneratedArticle {
  const org = job.org || "The recruiting organisation"
  const title = job.title || "Government Recruitment"
  const vac = job.vacancies || "various"
  const post = job.post || "various posts"
  const qual = job.qualification || "the prescribed qualification"

  const overview =
    `${org} has released an official notification for ${title}. ` +
    `A total of ${vac} vacancies are available for the post of ${post}. ` +
    `Eligible and interested candidates can apply online before ${job.lastDate || "the last date"}. ` +
    `Read the complete details on eligibility, age limit, application fee, selection process and important dates below before applying.`

  const eligibility =
    `Candidates applying for ${title} must have passed ${qual} from a recognised board or university. ` +
    `Please verify the exact eligibility criteria, including any additional requirements, in the official notification PDF.`

  const ageLimit =
    `The age limit for ${title} is ${job.ageRange || "as specified by the recruiting body"}. ` +
    `Upper age relaxation is applicable for SC/ST (5 years), OBC (3 years) and other reserved categories as per Government of India norms.`

  const salaryDetails =
    `Selected candidates for ${post} will receive a salary/pay scale of ${job.salary || "as per the applicable pay matrix"}, ` +
    `along with admissible allowances (DA, HRA, TA) as per government rules.`

  const selectionProcess = [
    "Written Examination / Computer Based Test (CBT)",
    "Skill Test / Physical Efficiency Test (where applicable)",
    "Document Verification",
    "Medical Examination",
  ]

  const examPattern =
    `The selection will be based on a written examination (objective type) followed by subsequent stages. ` +
    `The question paper generally covers General Awareness, Reasoning, Quantitative Aptitude and subject-specific topics. ` +
    `Negative marking may apply — refer to the official notification for the exact marking scheme.`

  return {
    overview,
    eligibility,
    ageLimit,
    salaryDetails,
    selectionProcess,
    feeDetails: feeBreakup(job.fee || ""),
    examPattern,
    importantDates: buildDates(job),
    faqs: buildFaqs(job),
    howToApply: buildHowToApply(job),
    article: `${overview}\n\n## Eligibility\n${eligibility}\n\n## Age Limit\n${ageLimit}\n\n## Salary\n${salaryDetails}\n\n## Exam Pattern\n${examPattern}`,
  }
}
