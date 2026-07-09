/**
 * recommendations.ts — pure, deterministic recommendation selectors.
 *
 * "Skills to learn" come from a curated, verified taxonomy per field (general
 * career knowledge, clearly framed as suggestions — not per-user fabricated
 * data). Job recommendations are NOT here: those are fetched from real jobs in
 * the API so we only ever recommend verified openings.
 */

/** Curated in-demand skills per broad field. Keys are matched case-insensitively. */
const SUGGESTED_SKILLS_BY_FIELD: { match: RegExp; skills: string[] }[] = [
  { match: /it|software|developer|engineer|tech/i, skills: ["JavaScript", "React", "Node.js", "Python", "SQL", "Git", "AWS", "REST APIs"] },
  { match: /data|analyt/i, skills: ["SQL", "Excel", "Python", "Power BI", "Tableau", "Statistics"] },
  { match: /sales|market/i, skills: ["CRM", "Lead Generation", "SEO", "Google Ads", "Negotiation", "Communication"] },
  { match: /bank|financ|account/i, skills: ["Accounting", "Tally", "MS Excel", "Financial Analysis", "GST", "Communication"] },
  { match: /content|writ/i, skills: ["Content Writing", "SEO", "Copywriting", "WordPress", "Research", "Editing"] },
  { match: /support|bpo|customer/i, skills: ["Communication", "CRM", "Problem Solving", "MS Office", "Typing"] },
  { match: /design/i, skills: ["Figma", "Adobe Photoshop", "UI/UX", "Illustrator", "Wireframing"] },
  { match: /hr|human/i, skills: ["Recruitment", "MS Excel", "Communication", "Payroll", "HRMS"] },
  { match: /teach|educat/i, skills: ["Communication", "Subject Expertise", "Classroom Management", "MS Office"] },
]

const GENERIC_SKILLS = ["Communication", "MS Office", "Teamwork", "Problem Solving", "Time Management"]

/**
 * Suggest up to `limit` in-demand skills for a candidate's field that they do
 * NOT already list. Returns generic professional skills when the field is
 * unknown, so the coach always has something useful to say.
 */
export function suggestSkills(category: string | null | undefined, have: string[] = [], limit = 6): string[] {
  const haveLc = new Set(have.map(s => s.toLowerCase()))
  const field = category ? SUGGESTED_SKILLS_BY_FIELD.find(f => f.match.test(category)) : undefined
  const pool = field ? field.skills : GENERIC_SKILLS
  const out = pool.filter(s => !haveLc.has(s.toLowerCase()))
  return out.slice(0, limit)
}

/** Static, always-available interview-prep recommendations (verified internal links). */
export const INTERVIEW_PREP_LINKS: { label: string; href: string }[] = [
  { label: "Practice common interview questions", href: "/candidate/interview-prep" },
  { label: "Take a free skill test", href: "/candidate/skill-tests" },
]
