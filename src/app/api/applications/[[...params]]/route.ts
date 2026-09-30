import { NextRequest, NextResponse } from "next/server"
import { requireApiSupabase } from "@/lib/supabase/apiHelpers"
import { getApplicationsByCandidate, updateApplicationStatus } from "@/lib/services/applicationService"
import { applyJobSchema, updateApplicationStatusSchema } from "@/lib/validations/applicationSchema"
import { createNotification } from "@/lib/services/notificationService"
import { classifyProvenance } from "@/lib/jobs/provenance"
import { applicationTargetVerdict, type ApplicationTargetRow } from "@/lib/jobs/applicationTarget"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const api = await requireApiSupabase()
  if (api.error) return api.error
  const sb = api.sb
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { params: p } = await params
  if (p?.[0] === "employer") {
    const { data: employer } = await sb.from("employers").select("id").eq("user_id", user.id).single()
    if (!employer) return NextResponse.json({ data: [] })
    const status = req.nextUrl.searchParams.get("status") || "all"
    const board = req.nextUrl.searchParams.get("board") || "all"
    const { getApplicationsByEmployer } = await import("@/lib/services/applicationService")
    return NextResponse.json({
      data: await getApplicationsByEmployer(
        (employer as { id: string }).id,
        status === "all" ? undefined : status,
        board === "all" ? undefined : board
      ),
    })
  }

  const { data: candidate } = await sb.from("candidates").select("id").eq("user_id", user.id).single()
  if (!candidate) return NextResponse.json({ data: [] })
  return NextResponse.json({ data: await getApplicationsByCandidate((candidate as { id: string }).id) })
}

export async function POST(req: NextRequest) {
  const api = await requireApiSupabase()
  if (api.error) return api.error
  const sb = api.sb
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = applyJobSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid data" }, { status: 400 })
  const d = parsed.data

  // Government jobs are informational on Noble Job. Their application happens only
  // on the official government website; Noble Job does not create a candidate
  // application record for a government vacancy.
  if (d.board === "govt") {
    return NextResponse.json({ error: "Government jobs must be applied for on the official government website." }, { status: 422 })
  }

  if (classifyProvenance({ id: d.jobId, source: d.source }) === "SYNTHETIC") {
    return NextResponse.json({ error: "This is a sample listing and is not accepting applications." }, { status: 422 })
  }

  const isUuid = UUID_RE.test(d.jobId)
  let row: ApplicationTargetRow | null = null
  let jobExists = false
  let jobCategory: string | null = null

  if (isUuid) {
    if (d.board === "wfh") {
      const { data: job } = await sb.from("wfh_jobs").select("employer_id, status").eq("id", d.jobId).single()
      row = (job as ApplicationTargetRow | null) ?? null
    } else if (d.board === "abroad") {
      const { data: job } = await sb.from("abroad_jobs").select("employer_id, status").eq("id", d.jobId).single()
      row = (job as ApplicationTargetRow | null) ?? null
    } else {
      const { data: job } = await sb.from("jobs").select("employer_id, status, category").eq("id", d.jobId).single()
      if (job) {
        jobExists = true
        row = job as ApplicationTargetRow
        jobCategory = (job as { category?: string | null }).category ?? null
      }
    }
  }

  const verdict = applicationTargetVerdict({ board: d.board, sample: false, row })
  if (!verdict.ok) return NextResponse.json({ error: verdict.error, reason: verdict.reason }, { status: verdict.status })
  const employerId = verdict.employerId

  const { data: candidate } = await sb
    .from("candidates")
    .select("id, resume_url, category, first_name, last_name")
    .eq("user_id", user.id)
    .single()
  if (!candidate) return NextResponse.json({ error: "Candidate profile not found" }, { status: 404 })
  if (!(candidate as { resume_url?: string | null }).resume_url) {
    return NextResponse.json({ error: "Please upload your resume before applying" }, { status: 400 })
  }
  const candidateId = (candidate as { id: string }).id

  if (!jobExists) {
    const { data: existing } = await sb
      .from("applications")
      .select("id, notes")
      .eq("candidate_id", candidateId)
      .is("job_id", null)
    const dup = (existing || []).some((r) => {
      try {
        return (JSON.parse((r as { notes?: string }).notes || "{}") as { externalJobId?: string }).externalJobId === d.jobId
      } catch { return false }
    })
    if (dup) return NextResponse.json({ error: "You have already applied to this job" }, { status: 409 })
  }

  const meta = {
    externalJobId: d.jobId,
    title: d.jobTitle,
    company: d.company,
    board: d.board,
    coverNote: d.coverNote || null,
    managedBy: "noble_job_admin_review",
  }

  const { error } = await sb.from("applications").insert({
    job_id: jobExists ? d.jobId : null,
    board: d.board,
    candidate_id: candidateId,
    employer_id: employerId,
    status: "new",
    admin_review_status: "pending_review",
    notes: JSON.stringify(meta),
  })
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "You have already applied to this job" }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const ownCategory = ((candidate as { category?: string | null }).category ?? "").trim()
  if (!ownCategory && jobCategory && jobCategory.trim()) {
    const { error: catErr } = await sb.from("candidates").update({ category: jobCategory.trim() }).eq("id", candidateId).is("category", null)
    if (catErr) console.warn("[apply] category derivation skipped:", catErr.message)
  }

  // IMPORTANT: no employer notification, email or resume delivery occurs here.
  // The application is held entirely inside Noble Job until an admin approves it.
  const { notifyAdmins } = await import("@/lib/services/adminNotifyService")
  await notifyAdmins(
    "application_submitted",
    "New application awaiting review",
    `A candidate applied for ${d.jobTitle || "a job"}${d.company ? ` at ${d.company}` : ""}. Admin approval is required before employer access.`
  )

  return NextResponse.json({ success: true, adminReviewStatus: "pending_review" })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const api = await requireApiSupabase()
  if (api.error) return api.error
  const sb = api.sb
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { params: p } = await params
  const appId = p?.[0]
  if (!appId) return NextResponse.json({ error: "Application ID required" }, { status: 400 })
  const body = await req.json()
  const parsed = updateApplicationStatusSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 })

  const { data: employer } = await sb.from("employers").select("id").eq("user_id", user.id).single()
  if (!employer) return NextResponse.json({ error: "Employer only" }, { status: 403 })
  const { data: app } = await sb
    .from("applications")
    .select("id, candidate_id, employer_id, admin_review_status")
    .eq("id", appId)
    .single()
  if (!app || (app as { employer_id: string }).employer_id !== (employer as { id: string }).id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (!["approved", "shared"].includes((app as { admin_review_status?: string }).admin_review_status || "")) {
    return NextResponse.json({ error: "This application is awaiting Noble Job admin approval" }, { status: 403 })
  }

  await updateApplicationStatus(appId, parsed.data.status)
  const { data: cand } = await sb.from("candidates").select("user_id").eq("id", (app as { candidate_id: string }).candidate_id).single()
  if ((cand as { user_id?: string })?.user_id) {
    await createNotification((cand as { user_id: string }).user_id, "application_status", "Application update", `Your application status is now: ${parsed.data.status}`)
  }
  return NextResponse.json({ success: true })
}
