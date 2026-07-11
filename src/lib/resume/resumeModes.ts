/**
 * resumeModes.ts — the four post-Career-Report actions ("Resume AI launcher").
 *
 * Pure, dependency-free single source of truth for the CTA set shown after a
 * successful Career Report: their labels, copy, analytics `mode` value, and
 * destination. Kept free of React/Next imports so it is unit-testable with the
 * `tsx` harness and so the widget and the placeholder pages never drift apart.
 *
 * IMPORTANT (truthfulness): the three build/optimise modes are NOT implemented
 * yet — their destinations are honest "coming soon" placeholder pages. Nothing
 * here claims the Resume Intelligence engine exists.
 */

/** Analytics event fired once per launcher CTA click. Must also be present in
 *  AcqEvent (events.ts) and the /api/events allowlist, or it is silently dropped. */
export const RESUME_MODE_EVENT = "resume_mode_selected" as const

export type ResumeModeKey = "improve" | "build" | "tailor" | "report"

export interface ResumeModeCta {
  /** Stable analytics value + route segment (for the three future modes). */
  key: ResumeModeKey
  /** User-facing button label. */
  label: string
  /** One-line supporting copy. */
  desc: string
  /** Small leading glyph (matches the widget's existing emoji style). */
  emoji: string
  /**
   * Where the CTA goes. A string is an internal navigation to a placeholder
   * page; `null` means "act in place" — used by "View Career Report", which
   * must preserve the current anonymous report state and never navigate away.
   */
  href: string | null
}

export const RESUME_MODES: readonly ResumeModeCta[] = [
  {
    key: "improve",
    label: "Improve My Resume",
    desc: "AI fixes ATS, wording & gaps",
    emoji: "✨",
    href: "/resume/improve",
  },
  {
    key: "build",
    label: "Build Professional Resume",
    desc: "Create a strong resume from scratch",
    emoji: "🧱",
    href: "/resume/build",
  },
  {
    key: "tailor",
    label: "Tailor Resume for a Job",
    desc: "Match your resume to a vacancy",
    emoji: "🎯",
    href: "/resume/tailor",
  },
  {
    key: "report",
    label: "View Career Report",
    desc: "Review your full score & tips",
    emoji: "📊",
    href: null,
  },
] as const

/** Destination for a mode key, or `null` for the in-place "report" action.
 *  Returns `undefined` for an unknown key. Used by tests + navigation. */
export function resumeModeHref(key: string): string | null | undefined {
  return RESUME_MODES.find(m => m.key === key)?.href
}

/** The three modes that navigate to a placeholder page (excludes "report"). */
export const RESUME_PLACEHOLDER_MODES: readonly Exclude<ResumeModeKey, "report">[] = [
  "improve",
  "build",
  "tailor",
]
