/**
 * applicationTarget.ts — may an application submitted through NobleJob be ACCEPTED,
 * and to whom does it go? The server-side twin of the UI's apply state
 * (src/lib/jobs/applyRoute.ts): the API refuses exactly the applications the UI never
 * offers, so a direct POST cannot create a record that no employer will ever receive.
 *
 * An application is accepted only for a job that
 *   • is not a sample / demo listing,
 *   • is on a board with an on-site application flow (private, WFH, abroad — never govt),
 *   • exists in NobleJob's own job tables,
 *   • is OWNED by an employer (`employer_id`) — the one recipient the application reaches,
 *   • is currently `active` (not closed / paused / pending / rejected / expired).
 *
 * There is NO "ownerless" acceptance: a NobleJob-held application for a vacancy whose
 * employer never receives it is exactly the dishonest state this model removes. General
 * talent / resume registration is a separate feature (TALENT_REGISTRATION) and never
 * goes through this path.
 *
 * Pure and dependency-free so it is unit-tested directly; the route supplies the row.
 */
export type ApplicationBoard = "private" | "govt" | "wfh" | "abroad"

export type ApplicationRefusalReason = "sample" | "no-onsite-flow" | "unknown-job" | "no-employer" | "closed"

export interface ApplicationTargetRow {
  employer_id?: string | null
  status?: string | null
}

export type ApplicationTargetVerdict =
  | { ok: true; employerId: string }
  | { ok: false; reason: ApplicationRefusalReason; status: 422; error: string }

const refuse = (reason: ApplicationRefusalReason, error: string): ApplicationTargetVerdict => ({
  ok: false,
  reason,
  status: 422,
  error,
})

export const NO_EMPLOYER_MESSAGE =
  "This listing can't take applications through Noble Job because no employer here receives them. If the listing has its own application link, apply there instead."

export function applicationTargetVerdict(input: {
  board: ApplicationBoard
  /** true when the id/source is a generated demo listing. */
  sample: boolean
  /** The job's row in its own table, or null when it isn't there. */
  row: ApplicationTargetRow | null | undefined
}): ApplicationTargetVerdict {
  if (input.sample) return refuse("sample", "This is a sample listing and is not accepting applications.")
  if (input.board === "govt") {
    return refuse("no-onsite-flow", "Government jobs are applied for on the official recruiting website, not through Noble Job.")
  }
  if (!input.row) return refuse("unknown-job", NO_EMPLOYER_MESSAGE)
  const employerId = (input.row.employer_id ?? "").toString().trim()
  if (!employerId) return refuse("no-employer", NO_EMPLOYER_MESSAGE)
  const status = (input.row.status ?? "").toString().trim().toLowerCase()
  if (status && status !== "active") return refuse("closed", "This job is no longer accepting applications.")
  return { ok: true, employerId }
}
