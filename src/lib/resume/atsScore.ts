/**
 * resume/atsScore.ts — deterministic resume analysis + optional AI recommendations.
 *
 * `analyzeResume()` is pure and fully testable: it computes an ATS-compatibility
 * score, extracts skills, compares against a job description, and produces
 * rule-based suggestions. `enrichWithAiRecommendations()` upgrades the
 * `recommendations` field using the configured AI provider when available, and
 * otherwise leaves the deterministic suggestions in place (never fabricates).
 */
import { extractSkills, extractJobKeywords, tokenize } from "./skills"
import type { AtsSubscores, ResumeScoreResult } from "./types"
import { generateText, isAiConfigured } from "@/lib/ai/provider"
import { hasBulletLine, hasEmail, hasPhone } from "./linearScan"
import { JOB_DESCRIPTION_MAX_CHARS, RESUME_MAX_TEXT_CHARS, TEXT_TRUNCATED_WARNING } from "./limits"

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

const SECTION_PATTERNS: { key: string; re: RegExp }[] = [
  { key: "experience", re: /\b(experience|employment|work history|professional background)\b/i },
  { key: "education", re: /\b(education|academic|qualification|degree)\b/i },
  { key: "skills", re: /\b(skills|technical skills|competenc|proficienc)\b/i },
  { key: "summary", re: /\b(summary|objective|profile|about me)\b/i },
  { key: "projects", re: /\b(projects|portfolio|certification|achievements|awards)\b/i },
]

// NOTE: the email / phone / bullet checks are linear-time scanners (linearScan.ts), NOT regexes:
// the equivalent regexes (/[a-z0-9._%+-]+@…/, /\+?\d[\d\s().-]{7,}\d/, /(^|\n)\s*[•…]/) backtrack
// quadratically on long runs and froze the Node event loop for ~20 s on a 200k-character input.
const DATE_RE = /\b(19|20)\d{2}\b/

export interface AnalyzeInput {
  text: string
  jobDescription?: string
  parseWarning?: string
}

function scoreContact(text: string): number {
  return (hasEmail(text) ? 60 : 0) + (hasPhone(text) ? 40 : 0)
}

function scoreSections(text: string): { score: number; missing: string[] } {
  const missing: string[] = []
  let present = 0
  for (const s of SECTION_PATTERNS) {
    if (s.re.test(text)) present++
    else missing.push(s.key)
  }
  return { score: (present / SECTION_PATTERNS.length) * 100, missing }
}

function scoreSkills(count: number): number {
  // 0 → 0, 8+ recognised skills → 100.
  return clamp((count / 8) * 100)
}

function scoreFormatting(text: string): number {
  let s = 0
  if (hasBulletLine(text)) s += 40
  if (DATE_RE.test(text)) s += 25
  const words = text.split(/\s+/).length
  const lines = text.split(/\n/).filter((l) => l.trim()).length
  if (lines >= 5) s += 20 // has structure, not one blob
  // penalise heavy non-ascii / tabular noise that trips ATS parsers
  const weird = (text.match(/[^\x09\x0A\x0D\x20-\x7E]/g) || []).length
  if (words > 0 && weird / words < 0.15) s += 15
  return clamp(s)
}

function scoreLength(wordCount: number): number {
  if (wordCount >= 400 && wordCount <= 1000) return 100
  if (wordCount < 400) return clamp((wordCount / 400) * 100)
  // Over-long resumes lose a little ATS/readability score.
  return clamp(100 - (wordCount - 1000) / 20)
}

function buildSuggestions(
  sub: AtsSubscores,
  missingSections: string[],
  missingKeywords: string[],
  wordCount: number
): string[] {
  const out: string[] = []
  if (sub.contactInfo < 100) out.push("Add complete contact details — a professional email and a phone number near the top.")
  if (missingSections.includes("skills")) out.push('Add a dedicated "Skills" section listing your core tools and technologies.')
  if (missingSections.includes("experience")) out.push('Include a clear "Work Experience" section with roles, companies and dates.')
  if (missingSections.includes("education")) out.push('Add an "Education" section with your qualifications and years.')
  if (missingSections.includes("summary")) out.push("Open with a 2–3 line professional summary tailored to the role.")
  if (sub.formatting < 70) out.push("Use simple bullet points and include dates (e.g. 2021–2024); avoid tables, columns and images that ATS parsers mishandle.")
  if (wordCount < 400) out.push("Expand your resume — aim for 400–800 words with measurable achievements (numbers, %, outcomes).")
  if (wordCount > 1100) out.push("Trim to the most relevant 1–2 pages; ATS and recruiters favour concise resumes.")
  if (missingKeywords.length) out.push(`Weave in role keywords you are missing: ${missingKeywords.slice(0, 8).join(", ")}.`)
  if (sub.skills < 60) out.push("Name specific, in-demand skills relevant to your target roles rather than generic phrases.")
  if (!out.length) out.push("Strong resume — keep tailoring keywords to each job you apply for.")
  return out
}

/** Pure, deterministic resume analysis. Safe to unit-test without any I/O. */
export function analyzeResume(input: AnalyzeInput): ResumeScoreResult {
  // Bound the work BEFORE any scoring step runs (second layer behind the linear-time scanners).
  const raw = (input.text || "").trim()
  const truncated = raw.length > RESUME_MAX_TEXT_CHARS
  const text = truncated ? raw.slice(0, RESUME_MAX_TEXT_CHARS) : raw
  const jobDescription = input.jobDescription ? input.jobDescription.slice(0, JOB_DESCRIPTION_MAX_CHARS) : input.jobDescription
  const parseWarning = truncated
    ? [input.parseWarning, TEXT_TRUNCATED_WARNING].filter(Boolean).join(" ")
    : input.parseWarning
  const wordCount = text ? text.split(/\s+/).length : 0

  const extractedSkills = extractSkills(text)
  const { score: sectionScore, missing: missingSections } = scoreSections(text)

  let keywordScore: number
  let jobMatchScore: number | null = null
  let matchedSkills: string[] = []
  let missingKeywords: string[] = []

  if (jobDescription && jobDescription.trim()) {
    const jdKeywords = extractJobKeywords(jobDescription)
    const resumeTokens = new Set(tokenize(text))
    const resumeSkillsLc = new Set(extractedSkills.map((s) => s.toLowerCase()))
    const present = jdKeywords.filter((k) => resumeTokens.has(k) || resumeSkillsLc.has(k))
    missingKeywords = jdKeywords.filter((k) => !resumeTokens.has(k) && !resumeSkillsLc.has(k))
    keywordScore = jdKeywords.length ? (present.length / jdKeywords.length) * 100 : 50
    jobMatchScore = clamp(keywordScore)

    const jdSkills = extractSkills(jobDescription)
    matchedSkills = jdSkills.filter((s) => resumeSkillsLc.has(s.toLowerCase()))
    missingKeywords = [
      ...jdSkills.filter((s) => !resumeSkillsLc.has(s.toLowerCase())).map((s) => s.toLowerCase()),
      ...missingKeywords.filter((k) => !jdSkills.some((s) => s.toLowerCase() === k)),
    ].slice(0, 15)
  } else {
    // No JD → score generic ATS keyword presence (skills breadth as proxy).
    keywordScore = scoreSkills(extractedSkills.length)
  }

  const subscores: AtsSubscores = {
    contactInfo: clamp(scoreContact(text)),
    sections: clamp(sectionScore),
    skills: scoreSkills(extractedSkills.length),
    formatting: scoreFormatting(text),
    keywords: clamp(keywordScore),
    length: scoreLength(wordCount),
  }

  // ATS score weights the signals parsers actually rely on.
  const atsScore = clamp(
    subscores.contactInfo * 0.15 +
      subscores.sections * 0.25 +
      subscores.skills * 0.2 +
      subscores.formatting * 0.2 +
      subscores.keywords * 0.15 +
      subscores.length * 0.05
  )

  // Overall quality blends ATS with job match when available.
  const overallScore = clamp(jobMatchScore !== null ? atsScore * 0.6 + jobMatchScore * 0.4 : atsScore)

  const suggestions = buildSuggestions(subscores, missingSections, missingKeywords, wordCount)

  return {
    overallScore,
    atsScore,
    subscores,
    extractedSkills,
    matchedSkills,
    missingKeywords,
    jobMatchScore,
    suggestions,
    recommendations: suggestions,
    recommendationsSource: "heuristic",
    aiConfigured: isAiConfigured(),
    wordCount,
    ...(parseWarning ? { parseWarning } : {}),
  }
}

/**
 * Upgrade `recommendations` with AI when a provider is configured. Falls back to
 * the deterministic suggestions on any failure — never fabricates output.
 */
export async function enrichWithAiRecommendations(
  result: ResumeScoreResult,
  resumeText: string,
  jobDescription?: string
): Promise<ResumeScoreResult> {
  if (!result.aiConfigured) return result

  const system =
    "You are an expert technical recruiter and ATS specialist. Give specific, actionable resume feedback. Return ONLY a JSON array of 4-6 short suggestion strings, no prose."
  const prompt = [
    `ATS score: ${result.atsScore}. Detected skills: ${result.extractedSkills.join(", ") || "none"}.`,
    result.missingKeywords.length ? `Missing keywords: ${result.missingKeywords.join(", ")}.` : "",
    jobDescription ? `Target job description:\n${jobDescription.slice(0, 2000)}` : "",
    `Resume text:\n${resumeText.slice(0, 6000)}`,
  ]
    .filter(Boolean)
    .join("\n\n")

  const raw = await generateText(prompt, { system, maxTokens: 500 })
  if (!raw) return result

  try {
    const match = raw.match(/\[[\s\S]*\]/)
    const parsed = JSON.parse(match ? match[0] : raw) as unknown
    if (Array.isArray(parsed)) {
      const recs = parsed.map((x) => String(x).trim()).filter(Boolean).slice(0, 6)
      if (recs.length) return { ...result, recommendations: recs, recommendationsSource: "ai" }
    }
  } catch {
    /* keep heuristic recommendations */
  }
  return result
}
