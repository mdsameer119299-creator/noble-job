import type { ServerSupabaseClient } from "@/lib/supabase/server"
import { resolveResumeSignedUrl } from "@/lib/storage/resumeStorage"
import { logResumeAccess } from "@/lib/services/resumeAccessLog"

/** Employer may access a resume only after employer verification and admin approval of the candidate application. */
export async function getEmployerApplicantResumeSignedUrl(
  sb: ServerSupabaseClient,
  employerUserId: string,
  candidateId: string
): Promise<string | null> {
  const { data: employer } = await sb.from("employers").select("id, verified").eq("user_id", employerUserId).single()
  if (!employer || !(employer as { verified?: boolean }).verified) return null
  const employerId = (employer as { id: string }).id

  const { data: application } = await sb
    .from("applications")
    .select("id")
    .eq("employer_id", employerId)
    .eq("candidate_id", candidateId)
    .in("admin_review_status", ["approved", "shared"])
    .limit(1)
    .maybeSingle()
  if (!application) return null

  const { data: candidate } = await sb.from("candidates").select("resume_url").eq("id", candidateId).single()
  if (!candidate) return null

  const url = await resolveResumeSignedUrl(sb, candidateId, (candidate as { resume_url: string | null }).resume_url)
  if (url) {
    void logResumeAccess({ candidateId, accessedByUserId: employerUserId, accessorRole: "employer", employerId, applicationId: (application as { id: string }).id })
  }
  return url
}

export async function getEmployerResumeSignedUrlByApplication(
  sb: ServerSupabaseClient,
  employerUserId: string,
  applicationId: string
): Promise<string | null> {
  const { data: employer } = await sb.from("employers").select("id").eq("user_id", employerUserId).single()
  if (!employer) return null
  const employerId = (employer as { id: string }).id

  const { data: application } = await sb
    .from("applications")
    .select("candidate_id, employer_id, admin_review_status")
    .eq("id", applicationId)
    .single()
  if (!application || (application as { employer_id: string }).employer_id !== employerId) return null
  if (!["approved", "shared"].includes((application as { admin_review_status?: string }).admin_review_status || "")) return null

  return getEmployerApplicantResumeSignedUrl(sb, employerUserId, (application as { candidate_id: string }).candidate_id)
}
