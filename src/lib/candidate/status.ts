/**
 * Candidate availability status — the signal a candidate shows recruiters.
 * Verified, self-declared data (no inference).
 */

export const CANDIDATE_STATUSES = [
  { value: "available", label: "Available now", color: "#15803d", hint: "Ready to start immediately" },
  { value: "looking", label: "Actively looking", color: "#1847d4", hint: "Open and applying" },
  { value: "open", label: "Open to offers", color: "#7c3aed", hint: "Employed but will consider roles" },
  { value: "interviewing", label: "Interviewing", color: "#b45309", hint: "In active interview processes" },
  { value: "hired", label: "Hired 🎉", color: "#0e7490", hint: "Recently placed" },
  { value: "not_looking", label: "Not looking", color: "#64748b", hint: "Paused — hidden from recruiters" },
] as const

export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number]["value"]

export const DEFAULT_CANDIDATE_STATUS: CandidateStatus = "looking"

const VALUES = new Set(CANDIDATE_STATUSES.map(s => s.value))

export function isCandidateStatus(v: unknown): v is CandidateStatus {
  return typeof v === "string" && VALUES.has(v as CandidateStatus)
}

export function statusMeta(v: string | null | undefined) {
  return CANDIDATE_STATUSES.find(s => s.value === v) ?? CANDIDATE_STATUSES.find(s => s.value === DEFAULT_CANDIDATE_STATUS)!
}
