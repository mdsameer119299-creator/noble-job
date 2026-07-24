import type { ServerSupabaseClient } from "@/lib/supabase/server"
import { resolveResumeSignedUrl } from "@/lib/storage/resumeStorage"

/**
 * Employer may access resume only when the candidate has applied to that
 * employer, AND that employer's account has been verified by Noble Job admin
 * — an unverified employer can have jobs live (job content review and
 * company identity verification are separate admin steps) but must not be
 * able to pull a candidate's resume until verified.
 */
export async function getEmployerApplicantResumeSignedUrl(
  sb: ServerSupabaseClient,
  employerUserId: string,
  candidateId: string
): Promise<string | null> {
  const { data: employer } = await sb
    .from("employers")
    .select("id, verified")
    .eq("user_id", employerUserId)
    .single()
  if (!employer) return null
  if (!(employer as { verified?: boolean }).verified) return null

  const { data: application } = await sb
    .from("applications")
    .select("id")
    .eq("employer_id", (employer as { id: string }).id)
    .eq("candidate_id", candidateId)
    .limit(1)
    .maybeSingle()
  if (!application) return null

  const { data: candidate } = await sb
    .from("candidates")
    .select("resume_url")
    .eq("id", candidateId)
    .single()
  if (!candidate) return null

  return resolveResumeSignedUrl(
    sb,
    candidateId,
    (candidate as { resume_url: string | null }).resume_url
  )
}

export async function getEmployerResumeSignedUrlByApplication(
  sb: ServerSupabaseClient,
  employerUserId: string,
  applicationId: string
): Promise<string | null> {
  const { data: employer } = await sb
    .from("employers")
    .select("id")
    .eq("user_id", employerUserId)
    .single()
  if (!employer) return null

  const { data: application } = await sb
    .from("applications")
    .select("candidate_id, employer_id")
    .eq("id", applicationId)
    .single()
  if (!application) return null
  if ((application as { employer_id: string }).employer_id !== (employer as { id: string }).id) {
    return null
  }

  return getEmployerApplicantResumeSignedUrl(
    sb,
    employerUserId,
    (application as { candidate_id: string }).candidate_id
  )
}
