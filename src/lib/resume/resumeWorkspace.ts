/**
 * resumeWorkspace.ts — centralized configuration for the Noble Resume AI
 * workspace shell (PR-Resume-02). Pure and dependency-free so it is
 * unit-testable and so the shell, entry flows, route pages and tests share one
 * source of truth for mode identity, copy, steps and route paths.
 *
 * SCOPE BOUNDARY: this PR ships only the workspace *shell* and truthful *entry
 * flows* (pre-engine state). It does NOT implement the Resume Intelligence
 * Engine, Career Graph, fact ledger, AI audit, billing, credits or schema.
 * `futureNote` copy states, honestly, what a later engine PR will add — nothing
 * here claims an AI capability that does not yet exist.
 *
 * FUTURE ENGINE INTEGRATION BOUNDARY: each entry flow ends in an explicit
 * "pre-engine" state (a clear, non-fabricated hand-off). A later PR replaces
 * only those pre-engine states; the shell, config and step model stay put.
 */

export type ResumeWorkspaceModeKey = "improve" | "build" | "tailor"

export interface ResumeWorkspaceMode {
  key: ResumeWorkspaceModeKey
  /** Public URL (unchanged from PR-Resume-01; kept noindex,nofollow). */
  path: string
  /** Small leading glyph, matches the existing widget's emoji style. */
  emoji: string
  /** Product-line eyebrow shown above every mode. */
  eyebrow: string
  title: string
  tagline: string
  /** Plain-language explanation of what this mode is for. */
  explanation: string
  /** Step-indicator labels. In this PR the user sits on step 1 (the entry
   *  flow); later steps are shown as upcoming ("soon") until the engine ships. */
  steps: readonly string[]
  /** Which entry-flow primitive the shell renders for this mode. */
  entryFlow: ResumeWorkspaceModeKey
  /** Contextual privacy + truthfulness message for this mode. */
  truthfulness: string
  /** Honest pre-engine boundary copy: what a future engine PR will add. */
  futureNote: string
}

export const RESUME_WORKSPACE_MODES: Readonly<Record<ResumeWorkspaceModeKey, ResumeWorkspaceMode>> = {
  improve: {
    key: "improve",
    path: "/resume/improve",
    emoji: "✨",
    eyebrow: "Noble Resume AI",
    title: "Improve My Resume",
    tagline: "Audit and rebuild an existing resume — truthfully.",
    explanation:
      "Add the resume you want to strengthen. Noble Resume AI will review it for ATS readability, structure, wording, gaps and missing sections, then help you rebuild it — using only what is genuinely in your resume.",
    steps: ["Add your resume", "AI audit", "Review & rebuild", "Export"],
    entryFlow: "improve",
    truthfulness:
      "Your file is analysed in your browser session only and is never stored while you are signed out. Noble Resume AI never invents experience, dates or qualifications — if something is unclear, it asks.",
    futureNote:
      "The full AI audit and rebuild engine arrives in an upcoming release. For now you can add and check your resume and get an instant Career Score — no AI audit has been performed yet.",
  },
  build: {
    key: "build",
    path: "/resume/build",
    emoji: "🧱",
    eyebrow: "Noble Resume AI",
    title: "Build a Professional Resume",
    tagline: "Start a clean, recruiter-ready resume from your real details.",
    explanation:
      "Choose how you would like to begin. Noble Resume AI will guide you through each section and assemble a professional, ATS-friendly resume from the details you confirm.",
    steps: ["Choose a start", "Add your details", "AI drafting", "Review & export"],
    entryFlow: "build",
    truthfulness:
      "You stay in control of every detail. Noble Resume AI only uses information you enter or confirm — it never fabricates employers, titles, dates or achievements.",
    futureNote:
      "The guided builder and AI drafting arrive in an upcoming release. This step lets you choose a starting method; nothing is drafted or saved yet.",
  },
  tailor: {
    key: "tailor",
    path: "/resume/tailor",
    emoji: "🎯",
    eyebrow: "Noble Resume AI",
    title: "Tailor Your Resume for a Job",
    tagline: "Align your resume to a specific role — honestly.",
    explanation:
      "Add your resume and the job you are targeting. Noble Resume AI will compare the role's requirements against your real experience and help you emphasise genuine, matching strengths.",
    steps: ["Add resume & target", "Match & tailor", "Review & export"],
    entryFlow: "tailor",
    truthfulness:
      "Tailoring uses only your verified facts. Noble Resume AI never invents experience or qualifications to fit a job — it highlights the real strengths you already have.",
    futureNote:
      "The matching and tailoring engine arrives in an upcoming release. For now you can add your resume and paste the job description; no tailored resume is generated yet.",
  },
}

export const RESUME_WORKSPACE_MODE_KEYS: readonly ResumeWorkspaceModeKey[] = [
  "improve",
  "build",
  "tailor",
]

export function getResumeWorkspaceMode(key: string): ResumeWorkspaceMode | undefined {
  return (RESUME_WORKSPACE_MODES as Record<string, ResumeWorkspaceMode>)[key]
}

/** Planned resume sections shown in the Build entry flow (display-only in this PR). */
export const RESUME_BUILD_SECTIONS: readonly string[] = [
  "Personal Details",
  "Experience",
  "Education",
  "Skills",
  "Projects",
  "Achievements",
  "Certifications",
]

/** Max characters accepted for a pasted job description (Tailor validation). */
export const JOB_DESCRIPTION_MAX_CHARS = 20000

export type JobDescriptionValidation =
  | { ok: true; length: number }
  | { ok: false; reason: 'empty' | 'too_long'; length: number }

/**
 * Validate a pasted job description for the Tailor flow. Pure so it is
 * unit-testable and shared by the UI. Rejects empty/whitespace-only input and
 * input longer than JOB_DESCRIPTION_MAX_CHARS. Does NOT fetch anything.
 */
export function validateJobDescription(text: string): JobDescriptionValidation {
  const raw = text ?? ''
  const trimmedLen = raw.trim().length
  if (trimmedLen === 0) return { ok: false, reason: 'empty', length: 0 }
  if (raw.length > JOB_DESCRIPTION_MAX_CHARS) return { ok: false, reason: 'too_long', length: raw.length }
  return { ok: true, length: trimmedLen }
}
