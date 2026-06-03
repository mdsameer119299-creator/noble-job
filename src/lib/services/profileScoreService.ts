/**
 * profileScoreService.ts — AI Profile Score calculator
 *
 * Ported from the hardcoded 82/100 in the original cand-aiScoreChart.
 * Now calculates a REAL score based on profile completeness.
 *
 * Scoring weights (total = 100 points):
 *   Full name:           10 pts
 *   Email verified:       5 pts
 *   Phone verified:       5 pts
 *   Experience set:      10 pts
 *   Category set:        10 pts
 *   Expected salary:      5 pts
 *   Skills (≥3):         15 pts
 *   Resume uploaded:     20 pts
 *   Work experience:     10 pts (1 entry = 5, 2+ = 10)
 *   Education:           10 pts (1 entry = 5, 2+ = 10)
 *
 * Used in: GET /api/candidate/ai-score, AiScoreChart component.
 */

export interface CandidateProfile {
  first_name?:        string
  last_name?:         string
  email_verified?:    boolean
  phone_verified?:    boolean
  experience_years?:  number | null
  category?:          string | null
  expected_salary?:   number | null
  skills?:            string[]
  resume_url?:        string | null
  work_experience_count?: number
  education_count?:   number
}

export function calculateProfileScore(profile: CandidateProfile): number {
  let score = 0
  if (profile.first_name && profile.last_name) score += 10
  if (profile.email_verified)                   score += 5
  if (profile.phone_verified)                   score += 5
  if (profile.experience_years !== null)         score += 10
  if (profile.category)                          score += 10
  if (profile.expected_salary)                   score += 5
  const skillCount = profile.skills?.length ?? 0
  if (skillCount >= 3)       score += 15
  else if (skillCount >= 1)  score += 7
  if (profile.resume_url)    score += 20
  const expCount = profile.work_experience_count ?? 0
  if (expCount >= 2) score += 10
  else if (expCount === 1) score += 5
  const eduCount = profile.education_count ?? 0
  if (eduCount >= 2) score += 10
  else if (eduCount === 1) score += 5
  return Math.min(100, score)
}
