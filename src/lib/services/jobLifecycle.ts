/**
 * jobLifecycle.ts — job status lifecycle rules shared by API + UI.
 *
 * Statuses: draft → pending → active(Approved) → paused ⇄ active → closed →
 * archived; rejected is an admin outcome. Employers may move their own jobs
 * along the safe transitions below but can NEVER set 'active'/'rejected'
 * directly — approval is the admin's job. `pending`/`draft` both sit behind the
 * admin approval gate.
 */

export type JobLifecycleStatus =
  | "draft"
  | "pending"
  | "active"
  | "paused"
  | "rejected"
  | "closed"
  | "archived"

/**
 * Fields an employer must never set/modify on their own jobs (moderation &
 * ownership). Stripped from any employer-supplied job payload server-side.
 */
export const EMPLOYER_PROTECTED_JOB_FIELDS = [
  "id",
  "employer_id",
  "status",
  "job_status",
  "is_verified",
  "verified",
  "is_featured",
  "board",
  "source",
  "posted_at",
  "created_at",
  "approved_at",
] as const

/** Remove protected fields from an employer-supplied job update. */
export function stripProtectedJobFields<T extends Record<string, unknown>>(body: T): Partial<T> {
  const out: Record<string, unknown> = {}
  const blocked = new Set<string>(EMPLOYER_PROTECTED_JOB_FIELDS)
  for (const [k, v] of Object.entries(body)) if (!blocked.has(k)) out[k] = v
  return out as Partial<T>
}

/** Allowed self-service transitions for an employer, keyed by current status. */
export const EMPLOYER_TRANSITIONS: Record<JobLifecycleStatus, JobLifecycleStatus[]> = {
  draft: ["pending", "archived"], // submit for approval / discard
  pending: ["draft", "archived"], // withdraw a pending submission
  active: ["paused", "closed", "archived"], // pause/close an approved job
  paused: ["active", "closed", "archived"], // resume without re-approval
  closed: ["active", "archived"], // reopen a previously approved job
  rejected: ["draft", "archived"], // revise & resubmit via draft
  archived: [], // terminal for employers (admin can restore)
}

export function canEmployerTransition(from: string, to: string): boolean {
  const allowed = EMPLOYER_TRANSITIONS[from as JobLifecycleStatus]
  return Array.isArray(allowed) && allowed.includes(to as JobLifecycleStatus)
}

/** UI badge colour per status. */
export const JOB_STATUS_COLOR: Record<string, string> = {
  draft: "#64748b",
  pending: "#f07020",
  active: "#15803d",
  paused: "#9333ea",
  rejected: "#dc2626",
  closed: "#64748b",
  archived: "#475569",
}
