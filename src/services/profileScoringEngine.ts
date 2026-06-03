import { calculateProfileScore } from "@/lib/services/profileScoreService"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function recalculateScore(candidateId: string): Promise<number> {
  const { data: profile } = await supabaseAdmin.from("candidates")
    .select("first_name, last_name, experience_years, category, expected_salary, skills, resume_url")
    .eq("id", candidateId).single()

  const { data: user } = await supabaseAdmin.from("users")
    .select("email_verified, phone_verified")
    .eq("id", (profile as any)?.user_id).single()

  const { count: expCount } = await supabaseAdmin.from("candidate_experience")
    .select("id", { count: "exact" }).eq("candidate_id", candidateId)

  const { count: eduCount } = await supabaseAdmin.from("candidate_education")
    .select("id", { count: "exact" }).eq("candidate_id", candidateId)

  const score = calculateProfileScore({
    first_name: (profile as any)?.first_name, last_name: (profile as any)?.last_name,
    email_verified: (user as any)?.email_verified, phone_verified: (user as any)?.phone_verified,
    experience_years: (profile as any)?.experience_years, category: (profile as any)?.category,
    expected_salary: (profile as any)?.expected_salary, skills: (profile as any)?.skills || [],
    resume_url: (profile as any)?.resume_url,
    work_experience_count: expCount || 0, education_count: eduCount || 0,
  })

  await supabaseAdmin.from("candidates").update({ profile_score: score }).eq("id", candidateId)
  return score
}
