/** Shared types for the AI Resume Score feature. */

export interface AtsSubscores {
  /** Email + phone present. */
  contactInfo: number
  /** Standard resume sections detected (experience, education, skills, …). */
  sections: number
  /** Breadth of recognised skills. */
  skills: number
  /** ATS-friendly formatting signals (bullets, dates, plain structure). */
  formatting: number
  /** Overlap with the target job's keywords (or generic ATS terms). */
  keywords: number
  /** Length within the recommended range. */
  length: number
}

export interface ResumeScoreResult {
  /** Blended 0–100 quality score. */
  overallScore: number
  /** 0–100 ATS-compatibility score. */
  atsScore: number
  subscores: AtsSubscores
  /** Canonical skills detected in the resume. */
  extractedSkills: string[]
  /** Skills present in both resume and job description. */
  matchedSkills: string[]
  /** Job keywords missing from the resume. */
  missingKeywords: string[]
  /** 0–100 match vs the job description, or null when none was provided. */
  jobMatchScore: number | null
  /** Deterministic, rule-based improvement suggestions. */
  suggestions: string[]
  /** Recommendations — from the AI provider when configured, else heuristic. */
  recommendations: string[]
  recommendationsSource: "ai" | "heuristic"
  /** Whether an AI provider key is configured on the server. */
  aiConfigured: boolean
  wordCount: number
  /** Non-fatal parsing note (e.g. scanned PDF). */
  parseWarning?: string
}
