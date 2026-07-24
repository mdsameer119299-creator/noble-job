import { isSupabaseConfigured } from "@/lib/supabase/config"

export interface ResumeAccessLogEntry {
  candidateId: string
  accessedByUserId?: string | null
  accessorRole: "admin" | "employer"
  employerId?: string | null
  applicationId?: string | null
}

/**
 * Best-effort audit trail for every resume signed-URL grant — never blocks
 * or fails the resume request itself; a logging hiccup must not deny a
 * legitimate, already-authorized access.
 */
export async function logResumeAccess(entry: ResumeAccessLogEntry): Promise<void> {
  if (!isSupabaseConfigured()) return
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin")
    await supabaseAdmin.from("resume_access_log").insert({
      candidate_id: entry.candidateId,
      accessed_by_user_id: entry.accessedByUserId || null,
      accessor_role: entry.accessorRole,
      employer_id: entry.employerId || null,
      application_id: entry.applicationId || null,
    } as never)
  } catch {
    // Non-critical — a missing/unmigrated table must never break resume access.
  }
}
