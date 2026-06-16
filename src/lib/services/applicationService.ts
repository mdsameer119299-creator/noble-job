import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import type { Application } from "@/types/application"

function mapApps(data: Record<string, unknown>[]): Application[] {
  return data.map(row => {
    const raw = row.candidates as Record<string, unknown> | null | undefined
    const candidate = raw
      ? {
          first_name: raw.first_name as string,
          last_name: raw.last_name as string,
          skills: (raw.skills as string[]) || [],
          has_resume: Boolean(raw.resume_url),
        }
      : undefined
    const { candidates: _omit, ...rest } = row
    return {
      ...rest,
      board: (row.board as string) || "private",
      candidate,
    }
  }) as unknown as Application[]
}

// Internal-only metadata that must never be returned to a candidate (esp. the
// original employer/source URL of imported jobs).
const CANDIDATE_HIDDEN_NOTE_KEYS = ["sourceUrl", "source", "managedBy", "outreach"]

function redactCandidateNotes(apps: Application[]): Application[] {
  return apps.map((a) => {
    const notes = (a as { notes?: string }).notes
    if (!notes) return a
    try {
      const meta = JSON.parse(notes) as Record<string, unknown>
      for (const k of CANDIDATE_HIDDEN_NOTE_KEYS) delete meta[k]
      return { ...a, notes: JSON.stringify(meta) }
    } catch {
      return a
    }
  })
}

export async function getApplicationsByCandidate(candidateId: string): Promise<Application[]> {
  if (!isSupabaseConfigured()) return []
  const sb = await createClient()
  if (!sb) return []
  const { data } = await sb
    .from("applications")
    .select("*, jobs(title,location)")
    .eq("candidate_id", candidateId)
    .order("applied_at", { ascending: false })
  return redactCandidateNotes(mapApps((data || []) as Record<string, unknown>[]))
}

export async function getApplicationsByEmployer(
  employerId: string,
  status?: string
): Promise<Application[]> {
  if (!isSupabaseConfigured()) return []
  const sb = await createClient()
  if (!sb) return []
  let q = sb
    .from("applications")
    .select("*, candidates(first_name,last_name,skills,resume_url)")
    .eq("employer_id", employerId)
  if (status && status !== "all") q = q.eq("status", status)
  q = q.order("applied_at", { ascending: false })
  const { data } = await q
  return mapApps((data || []) as Record<string, unknown>[])
}

export async function updateApplicationStatus(id: string, status: string) {
  if (!isSupabaseConfigured()) return { error: { message: "not configured" } }
  const sb = await createClient()
  if (!sb) return { error: { message: "not configured" } }
  return sb.from("applications").update({ status }).eq("id", id)
}
