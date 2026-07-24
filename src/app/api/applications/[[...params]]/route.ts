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
    const board = req.nextUrl.searchParams.get("board") || "all"
    const { getApplicationsByEmployer } = await import("@/lib/services/applicationService")
    const apps = await getApplicationsByEmployer(
      (employer as { id: string }).id,
      status === "all" ? undefined : status,
      board === "all" ? undefined : board
    )
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

  const { data: candidate } = await sb
    .from("candidates")
    .select("id, resume_url, category, first_name, last_name")
    .eq("user_id", user.id)
    .single()
  if (!candidate) return NextResponse.json({ error: "Candidate profile not found" }, { status: 404 })

  const d = parsed.data

  // Resume is mandatory for the internal application flow (private + wfh) —
  // enforced server-side so the rule can't be bypassed by calling the API directly.
  const INTERNAL_FLOW_BOARDS = new Set(["private", "wfh"])
  if (INTERNAL_FLOW_BOARDS.has(d.board) && !(candidate as { resume_url?: string | null }).resume_url) {
    return NextResponse.json({ error: "Please upload your resume before applying" }, { status: 400 })
  }

  const isUuid = UUID_RE.test(d.jobId)
  const candidateId = (candidate as { id: string }).id
  let employerId: string | null = null
  // Only set applications.job_id when the job actually exists in the `jobs` table —
  // the job_id -> jobs(id) foreign key can't reference wfh_jobs/abroad_jobs. Live/
  // imported jobs (e.g. Himalayas) can have UUID-shaped ids that are NOT in `jobs`
  // either. Such applications are stored as ownerless imported records (job_id =
  // NULL + metadata) UNLESS the job is a real employer-owned WFH/Abroad posting,
  // in which case job_id stays NULL (FK constraint) but employer_id is still
  // resolved so the application correctly reaches that employer.
  let jobExists = false
  let jobCategory: string | null = null

  if (isUuid) {
    if (d.board === "wfh") {
      const { data: job } = await sb.from("wfh_jobs").select("employer_id").eq("id", d.jobId).single()
      employerId = (job as { employer_id?: string | null } | null)?.employer_id ?? null
    } else if (d.board === "abroad") {
      const { data: job } = await sb.from("abroad_jobs").select("employer_id").eq("id", d.jobId).single()
      employerId = (job as { employer_id?: string | null } | null)?.employer_id ?? null
    } else {
      const { data: job } = await sb.from("jobs").select("employer_id, title, category").eq("id", d.jobId).single()
      if (job) {
        jobExists = true
        employerId = (job as { employer_id?: string })?.employer_id ?? null
        jobCategory = (job as { category?: string | null })?.category ?? null
      }
    }
  }

  // Imported jobs insert job_id = NULL, so the UNIQUE(job_id, candidate_id)
  // constraint can't catch duplicates — dedupe by externalJobId in metadata.
  if (!jobExists) {
    const { data: existing } = await sb
      .from("applications")
      .select("id, notes")
      .eq("candidate_id", candidateId)
      .is("job_id", null)
    const dup = (existing || []).some((row) => {
      try {
        return (JSON.parse((row as { notes?: string }).notes || "{}") as { externalJobId?: string }).externalJobId === d.jobId
      } catch {
        return false
      }
    })
    if (dup) {
      return NextResponse.json({ error: "You have already applied to this job" }, { status: 409 })
    }
  }

  // Ownerless (imported) applications belong to the Admin Recruitment Queue:
  // they are retained, visible to admins, and flagged as awaiting employer outreach.
  const meta = {
    externalJobId: d.jobId,
    title: d.jobTitle,
    company: d.company,
    board: d.board,
    source: d.source || null,
    sourceUrl: d.sourceUrl || null, // metadata only — never exposed to candidates
    coverNote: d.coverNote || null,
    managedBy: employerId ? "employer" : "noblejob",
    outreach: employerId ? null : "pending",
  }

  const { error } = await sb.from("applications").insert({
    job_id: jobExists ? d.jobId : null,
    board: d.board,
    candidate_id: candidateId,
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

  // Derive the candidate's category from the genuine applied job when their
  // profile category is missing. The `.is("category", null)` guard means a
  // candidate-selected category is NEVER overwritten. Best-effort — a failure
  // here must not affect the already-successful application.
  const ownCategory = ((candidate as { category?: string | null }).category ?? "").trim()
  if (!ownCategory && jobCategory && jobCategory.trim()) {
    const { error: catErr } = await sb
      .from("candidates")
      .update({ category: jobCategory.trim() })
      .eq("id", candidateId)
      .is("category", null)
    if (catErr) console.warn("[apply] category derivation skipped:", catErr.message)
  }

  // A real employer's resume/application must actually reach them — not just an
  // in-app notification. Gated on the identical `employerId` condition used for
  // the notification above: this is only ever non-null for a genuine EMPLOYER-
  // owned job (jobs/wfh_jobs/abroad_jobs with employer_id set), so a synthetic or
  // curated listing's "Apply Now" can never trigger this — no employer_id, no email.
  if (employerId) {
    const { data: owner } = await sb.from("employers").select("user_id, users(email)").eq("id", employerId).single()
    const ownerRow = owner as { user_id?: string; users?: { email?: string } | null } | null
    if (ownerRow?.user_id) {
      await createNotification(
        ownerRow.user_id,
        "application",
        "New application",
        `A candidate applied for ${d.jobTitle || "your job"}`
      )
    }
    const employerEmail = ownerRow?.users?.email
    if (employerEmail) {
      try {
        const cand = candidate as { resume_url?: string | null; first_name?: string | null; last_name?: string | null }
        const { resolveResumeSignedUrl } = await import("@/lib/storage/resumeStorage")
        const resumeUrl = await resolveResumeSignedUrl(sb, candidateId, cand.resume_url)
        const { sendApplicationEmail } = await import("@/lib/services/emailService")
        await sendApplicationEmail(employerEmail, {
          jobTitle: d.jobTitle || "your job",
          candidateName: [cand.first_name, cand.last_name].filter(Boolean).join(" ") || undefined,
          resumeUrl,
        })
      } catch (e) {
        // Best-effort — the application itself already succeeded above; a failed
        // email must never surface as a failed application submission.
        console.warn("[apply] employer email failed:", e instanceof Error ? e.message : e)
      }
    }
  }

  const { notifyAdmins } = await import("@/lib/services/adminNotifyService")
  await notifyAdmins(
    "application_submitted",
    "New application submitted",
    `A candidate applied for ${d.jobTitle || "a job"}${d.company ? ` at ${d.company}` : ""}.`
  )

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
