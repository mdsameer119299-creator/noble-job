/**
 * jobMapper.ts — Himalayas API response → Noble Job job shape
 *
 * Ported from _mapCategory(), _mapSeniority(), _colorForCompany()
 * in the original js-live-jobs script. Now runs server-side.
 *
 * Used in: himalayasService.ts to normalise API responses.
 */

export function mapCategory(categories?: string[]): string {
  if (!categories?.length) return "IT / Software"
  const c = categories[0].toLowerCase().replace(/-/g, " ")
  if (c.match(/engineer|developer|software|programming/)) return "IT / Software"
  if (c.match(/design|ux|ui|graphic/))                    return "Design / Creative"
  if (c.match(/market|growth|seo|brand/))                 return "Sales / Marketing"
  if (c.match(/data|analyst|machine|ml|ai/))              return "Data / Analytics"
  if (c.match(/product/))                                  return "Product Management"
  if (c.match(/support|success|customer/))                 return "Customer Support"
  if (c.match(/finance|account|banking/))                  return "Finance / Accounts"
  if (c.match(/hr|recruit|people|talent/))                 return "HR / Recruitment"
  if (c.match(/sales|business|biz ?dev/))                  return "Sales / Marketing"
  if (c.match(/content|writ|copy|editor/))                 return "Content Writing"
  if (c.match(/devops|infra|cloud|sre|platform/))          return "DevOps / Cloud"
  if (c.match(/security|cyber/))                           return "Cybersecurity"
  return "IT / Software"
}

export function mapSeniority(seniority?: string[]): string {
  if (!seniority?.length) return "Any Experience"
  const v = seniority[0]
  if (v.includes("Entry") || v.includes("Junior"))          return "Fresher / 0-2 Yrs"
  if (v.includes("Mid"))                                     return "2-5 Yrs"
  if (v.includes("Senior"))                                  return "5+ Yrs"
  if (v.includes("Lead") || v.includes("Principal"))         return "8+ Yrs"
  if (v.includes("Executive") || v.includes("Director"))     return "Leadership"
  if (v.includes("Intern"))                                   return "Fresher / Intern"
  return v
}

const COLOR_PALETTE = [
  "#1847d4","#7c3aed","#059669","#f97316",
  "#dc2626","#0e7490","#a855f7","#16a34a",
]

export function colorForCompany(name: string): string {
  if (!name) return COLOR_PALETTE[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length]
}
