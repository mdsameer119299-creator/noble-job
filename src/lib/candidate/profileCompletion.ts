/**
 * profileCompletion.ts — detailed, benefit-driven profile completion.
 *
 * Pure and deterministic (unit-testable). Each item states the concrete benefit
 * of completing it, so guidance reads like a career coach, not a nag. Uses only
 * verified, self-declared candidate fields — nothing inferred or fabricated.
 */

export interface CompletionInput {
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  city?: string | null
  category?: string | null
  experience_years?: string | number | null
  skills?: string[] | null
  resume_url?: string | null
  availability_status?: string | null
}

export interface CompletionItem {
  key: string
  label: string
  /** Why it matters — the payoff for the candidate. */
  benefit: string
  done: boolean
  points: number
  /** Where to go to complete it. */
  href: string
}

export interface CompletionResult {
  items: CompletionItem[]
  percent: number
  completed: number
  total: number
  /** The highest-impact incomplete item to nudge next (or null when done). */
  nextBest: CompletionItem | null
}

function has(v: unknown): boolean {
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === "number") return Number.isFinite(v) && v > 0
  return typeof v === "string" ? v.trim().length > 0 : Boolean(v)
}

export function profileCompletion(c: CompletionInput): CompletionResult {
  // Each item's href points at the screen that can actually complete it:
  //  • resume + skills → /candidate/resume (skills are auto-detected on upload;
  //    there is no manual skills form yet, so the resume is the real path)
  //  • name/category/city/experience/phone → /candidate/profile (PersonalInfoForm)
  //  • status → /candidate/dashboard (the availability control lives there)
  const skills = c.skills ?? []
  const items: CompletionItem[] = [
    { key: "resume", label: "Upload your resume", benefit: "Unlocks your Career Score and one-click apply", done: has(c.resume_url), points: 25, href: "/candidate/resume" },
    { key: "skills", label: "Add 3+ skills (auto-detected from your resume)", benefit: "Powers job matching and skill recommendations", done: skills.length >= 3, points: 15, href: "/candidate/resume" },
    { key: "name", label: "Add your full name", benefit: "Employers see who they're considering", done: has(c.first_name) && has(c.last_name), points: 10, href: "/candidate/profile" },
    { key: "category", label: "Choose your job category", benefit: "See roles tailored to your field", done: has(c.category), points: 10, href: "/candidate/profile" },
    { key: "location", label: "Add your city", benefit: "Find jobs near you", done: has(c.city), points: 10, href: "/candidate/profile" },
    { key: "experience", label: "Set your experience level", benefit: "Match roles at your level", done: has(c.experience_years), points: 10, href: "/candidate/profile" },
    { key: "phone", label: "Add your phone number", benefit: "Let recruiters reach you fast", done: has(c.phone), points: 5, href: "/candidate/profile" },
    { key: "status", label: "Set your availability", benefit: "Signal recruiters that you're open", done: has(c.availability_status), points: 5, href: "/candidate/dashboard" },
  ]

  const total = items.reduce((s, i) => s + i.points, 0)
  const earned = items.reduce((s, i) => s + (i.done ? i.points : 0), 0)
  const percent = total ? Math.round((earned / total) * 100) : 0
  const completed = items.filter(i => i.done).length
  const nextBest = items.filter(i => !i.done).sort((a, b) => b.points - a.points)[0] ?? null

  return { items, percent, completed, total: items.length, nextBest }
}
