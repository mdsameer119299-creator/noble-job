/**
 * Pure mapping from a 0–100 resume score to a display band + a coarse
 * "profile completion" ladder used by the public acquisition widget. No I/O,
 * safe to unit-test.
 */

export type ScoreBand = {
  label: "Excellent" | "Strong" | "Fair" | "Needs work"
  color: string
  /** Short, encouraging one-liner shown under the score. */
  blurb: string
}

export function resumeScoreBand(score: number): ScoreBand {
  const s = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0
  if (s >= 85) return { label: "Excellent", color: "#15803d", blurb: "Recruiter-ready — start applying today." }
  if (s >= 70) return { label: "Strong", color: "#1847d4", blurb: "Solid resume — a few tweaks will make it shine." }
  if (s >= 50) return { label: "Fair", color: "#b45309", blurb: "Good base — improve the flagged areas to stand out." }
  return { label: "Needs work", color: "#be123c", blurb: "Let's strengthen it — follow the tips below." }
}

/**
 * Coarse candidate profile-completion percentage for the anonymous parse-first
 * step: uploading + parsing a resume is the first ~40%; the rest is unlocked by
 * creating an account and completing the profile (surfaced post-signup).
 */
export function anonProfileCompletion(input: { hasResume: boolean; skillsCount: number; score: number }): number {
  let pct = 0
  if (input.hasResume) pct += 25 // resume uploaded + parsed
  if (input.skillsCount > 0) pct += 10 // skills detected
  if (input.score >= 50) pct += 5 // usable quality
  return Math.min(pct, 40) // account creation + details unlock the remaining 60%
}
