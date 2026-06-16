import { supabaseAdmin } from "@/lib/supabase/admin"
import { generateAndSendOtp } from "@/lib/services/otpService"
import { alertAdmins } from "@/lib/services/adminNotifyService"
import {
  candidateRegisterStep1Schema,
  candidateRegisterStep2Schema,
  employerRegisterStep1Schema,
  employerRegisterStep2Schema,
} from "@/lib/validations/authSchema"
import { z } from "zod"

const candidateRegisterSchema = candidateRegisterStep1Schema.merge(
  candidateRegisterStep2Schema.extend({
    experienceYears: z.coerce.number().min(0).max(50),
  })
)

const employerRegisterSchema = employerRegisterStep1Schema.merge(employerRegisterStep2Schema)

export async function registerCandidate(body: unknown) {
  const parsed = candidateRegisterSchema.safeParse(body)
  if (!parsed.success) {
    return { ok: false as const, status: 400, error: parsed.error.errors[0]?.message ?? "Invalid input" }
  }
  const d = parsed.data

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: d.email,
    password: d.password,
    email_confirm: false,
    user_metadata: { role: "candidate", first_name: d.firstName, last_name: d.lastName },
  })

  if (error) {
    return { ok: false as const, status: 400, error: error.message }
  }
  if (!data.user) {
    return { ok: false as const, status: 500, error: "Failed to create user" }
  }

  const userId = data.user.id

  await supabaseAdmin.from("users").upsert({
    id: userId,
    email: d.email,
    role: "candidate",
    status: "pending",
    email_verified: false,
  })

  await supabaseAdmin.from("candidates").upsert(
    {
      user_id: userId,
      first_name: d.firstName,
      last_name: d.lastName,
      phone: d.phone,
      experience_years: d.experienceYears,
      category: d.category,
      expected_salary: d.expectedSalary ?? null,
      skills: d.skills,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    { onConflict: "user_id" }
  )

  await generateAndSendOtp(d.email, "email_verify")

  await alertAdmins({
    type: "candidate_registered",
    title: "New candidate registered",
    message: `${d.firstName} ${d.lastName} (${d.email}) created a candidate account.`,
    email: true,
  })

  return { ok: true as const, userId }
}

export async function registerEmployer(body: unknown) {
  const parsed = employerRegisterSchema.safeParse(body)
  if (!parsed.success) {
    return { ok: false as const, status: 400, error: parsed.error.errors[0]?.message ?? "Invalid input" }
  }
  const d = parsed.data

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: d.email,
    password: d.password,
    email_confirm: false,
    user_metadata: { role: "employer", first_name: d.firstName, last_name: d.lastName },
  })

  if (error) {
    return { ok: false as const, status: 400, error: error.message }
  }
  if (!data.user) {
    return { ok: false as const, status: 500, error: "Failed to create user" }
  }

  const userId = data.user.id

  await supabaseAdmin.from("users").upsert({
    id: userId,
    email: d.email,
    role: "employer",
    status: "pending",
    email_verified: false,
  })

  await supabaseAdmin.from("employers").upsert(
    {
      user_id: userId,
      company_name: d.companyName,
      website: d.website || null,
      city: d.city,
      industry: d.industry,
      company_size: d.companySize,
      designation: d.designation,
      status: "pending",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    { onConflict: "user_id" }
  )

  await generateAndSendOtp(d.email, "email_verify")

  await alertAdmins({
    type: "employer_registered",
    title: "New employer awaiting review",
    message: `${d.companyName} (${d.email}) registered as an employer.`,
    email: true,
  })

  return { ok: true as const, userId }
}
