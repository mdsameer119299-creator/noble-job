/**
 * savedJobsResolver.ts — a saved job is a REFERENCE (job_id + board). It is only ever
 * shown to a candidate (or accepted as a new save) when it still resolves to a
 * renderable job through the same by-id services the detail pages use. A reference to
 * a job that is gone, incomplete, hidden by the synthetic switch, or a bogus id
 * ("undefined", path-like text) is dropped — never a "View job <id>" link to a 404.
 * The stored row itself is left alone (nothing is deleted).
 *
 * Server-only.
 */
import { getJobById } from "@/lib/services/jobService"
import { getWfhJobById } from "@/lib/services/wfhJobService"
import { getAbroadJobById } from "@/lib/services/abroadJobService"
import { getGovtJobById } from "@/lib/services/govtJobService"
import { isValidJobId } from "@/lib/jobs/renderable"

export const SAVED_JOB_BOARDS = ["private", "wfh", "abroad", "govt"] as const
export type SavedJobBoard = (typeof SAVED_JOB_BOARDS)[number]

export interface ResolvedSavedJob {
  job_id: string
  board: SavedJobBoard
  title: string
  company: string
  location: string
}

export function normalizeSavedBoard(board: unknown): SavedJobBoard | null {
  const b = typeof board === "string" ? board.trim().toLowerCase() : "private"
  return (SAVED_JOB_BOARDS as readonly string[]).includes(b) ? (b as SavedJobBoard) : null
}

/** Resolve one saved reference; null when it is not a renderable job today. */
export async function resolveSavedJob(jobId: unknown, board: unknown): Promise<ResolvedSavedJob | null> {
  const b = normalizeSavedBoard(board)
  if (!b || typeof jobId !== "string" || !isValidJobId(jobId)) return null
  try {
    if (b === "govt") {
      const g = await getGovtJobById(jobId)
      return g ? { job_id: jobId, board: b, title: g.title, company: g.org ?? "", location: g.location ?? "" } : null
    }
    const j = b === "private" ? await getJobById(jobId) : b === "wfh" ? await getWfhJobById(jobId) : await getAbroadJobById(jobId)
    return j ? { job_id: jobId, board: b, title: j.title, company: j.company, location: ("location" in j ? j.location : "") ?? "" } : null
  } catch {
    return null
  }
}
