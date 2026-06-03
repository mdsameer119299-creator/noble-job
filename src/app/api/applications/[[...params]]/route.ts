import { NextRequest, NextResponse } from "next/server"
import { requireApiSupabase } from "@/lib/supabase/apiHelpers"
import { getApplicationsByCandidate, updateApplicationStatus } from "@/lib/services/applicationService"
import { applyJobSchema, updateApplicationStatusSchema } from "@/lib/validations/applicationSchema"
import { createNotification } from "@/lib/services/notificationService"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const api = await requireApiSupabase()
  if (api.error) return api.error
  const sb = api.sb
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { params: p } = await params
  const segment = p?.[0]

  if (segment === "employer") {
    const { data: employer } = await sb.from("employers").select("id").eq("user_id", user.id).single()
    if (!employer) return NextResponse.json({ data: [] })
    const status = req.nextUrl.searchParams.get("status") || "all"
    const { getApplicationsByEmployer } = await import("@/lib/services/applicationService")
    const apps = await getApplicationsByEmployer((employer as { id: string }).id, status === "all" ? undefined : status)
    return NextResponse.json({ data: apps })
  }

  const { data: candidate } = await sb.from("candidates").select("id").eq("user_id", user.id).single()
  if (!candidate) return NextResponse.json({ data: [] })
  const apps = await getApplicationsByCandidate((candidate as { id: string }).id)
  return NextResponse.json({ data: apps })
}

export async function POST(req: NextRequest) {
  const api = await requireApiSupabase()
  if (api.error) return api.error
  const sb = api.sb
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = applyJobSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid data" }, { status: 400 })
  }

  const { data: candidate } = await sb.from("candidates").select("id").eq("user_id", user.id).single()
  if (!candidate) return NextResponse.json({ error: "Candidate profile not found" }, { status: 404 })

  const d = parsed.data
  const isUuid = UUID_RE.test(d.jobId)
  let employerId: string | null = null

  if (isUuid) {
    const { data: job } = await sb.from("jobs").select("employer_id, title").eq("id", d.jobId).single()
    employerId = (job as { employer_id?: string })?.employer_id ?? null
  }

  const meta = {
    externalJobId: d.jobId,
    title: d.jobTitle,
    company: d.company,
    board: d.board,
  }

  const { error } = await sb.from("applications").insert({
    job_id: isUuid ? d.jobId : null,
    job_board: d.board,
    candidate_id: (candidate as { id: string }).id,
    employer_id: employerId,
    status: "new",
    notes: JSON.stringify(meta),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "You have already applied to this job" }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (employerId) {
    const { data: owner } = await sb.from("employers").select("user_id").eq("id", employerId).single()
    if ((owner as { user_id?: string })?.user_id) {
      await createNotification(
        (owner as { user_id: string }).user_id,
        "application",
        "New application",
        `A candidate applied for ${d.jobTitle || "your job"}`
      )
    }
  }

  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const api = await requireApiSupabase()
  if (api.error) return api.error
  const sb = api.sb
  const {
    data: { user },
  } = await sb.auth.getUser()
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
    .select("id, candidate_id, employer_id")
    .eq("id", appId)
    .single()

  if (!app || (app as { employer_id: string }).employer_id !== (employer as { id: string }).id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await updateApplicationStatus(appId, parsed.data.status)

  const { data: cand } = await sb
    .from("candidates")
    .select("user_id")
    .eq("id", (app as { candidate_id: string }).candidate_id)
    .single()

  if ((cand as { user_id?: string })?.user_id) {
    await createNotification(
      (cand as { user_id: string }).user_id,
      "application_status",
      "Application update",
      `Your application status is now: ${parsed.data.status}`
    )
  }

  return NextResponse.json({ success: true })
}
