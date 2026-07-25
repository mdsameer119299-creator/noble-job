import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { requireApiSupabase } from "@/lib/supabase/apiHelpers"
import { getApplicationsByEmployer } from "@/lib/services/applicationService"
import { getEmployerAnalytics } from "@/lib/services/analyticsService"
import { JOB_BOARD_TABLE, isEmployerJobBoard, type EmployerJobBoard } from "@/lib/services/jobLifecycle"

function boardFromParam(v: string | null): EmployerJobBoard {
  return isEmployerJobBoard(v) ? v : "private"
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const { params: p } = await params
  const api = await requireApiSupabase()
  if (api.error) return api.error
  const sb = api.sb
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { data: employer } = await sb.from("employers").select("*").eq("user_id", user.id).single()
  if (!employer) return NextResponse.json({ error: "Employer not found" }, { status: 404 })
  const eid = (employer as any).id
  const route = p?.join("/") || "dashboard"

  if (route === "dashboard" || route === "stats") {
    // Active jobs must be counted across all three employer-postable boards —
    // querying only `jobs` silently under-reported WFH/Abroad postings.
    const boards: EmployerJobBoard[] = ["private", "wfh", "abroad"]
    const [boardCounts, apps, interviews] = await Promise.all([
      Promise.all(
        boards.map(async board => {
          const table = JOB_BOARD_TABLE[board]
          const { count } = await sb.from(table).select("id", { count: "exact", head: true }).eq("employer_id", eid).eq("status", "active")
          return { board, count: count || 0 }
        })
      ),
      sb.from("applications").select("status").eq("employer_id", eid),
      sb.from("interviews").select("id", { count: "exact" }).eq("employer_id", eid).eq("status", "scheduled"),
    ])
    const appData = apps.data || []
    const byBoard = Object.fromEntries(boardCounts.map(b => [b.board, b.count])) as Record<EmployerJobBoard, number>
    return NextResponse.json({
      activeJobs: boardCounts.reduce((sum, b) => sum + b.count, 0),
      activeJobsByBoard: byBoard,
      applications: appData.length,
      shortlisted: appData.filter((a: any) => a.status === "shortlisted").length,
      interviews: interviews.count || 0,
      hired: appData.filter((a: any) => a.status === "hired").length,
    })
  }

  // Job list: GET /api/employer/jobs — all three boards unioned by default (each
  // row tagged with its board), or a single board via ?board=wfh|abroad|private.
  if (route === "jobs") {
    const boardParam = req.nextUrl.searchParams.get("board")
    const boards: EmployerJobBoard[] = isEmployerJobBoard(boardParam) ? [boardParam] : ["private", "wfh", "abroad"]
    const { getApplicationCountsByEmployer } = await import("@/lib/services/applicationService")
    const [results, applicationCounts] = await Promise.all([
      Promise.all(
        boards.map(async (board) => {
          const table = JOB_BOARD_TABLE[board]
          const { data } = await sb.from(table).select("*").eq("employer_id", eid).order("posted_at", { ascending: false })
          return (data || []).map((row) => ({ ...(row as Record<string, unknown>), board, id: (row as { id: string }).id }))
        })
      ),
      getApplicationCountsByEmployer(eid),
    ])
    const merged = results.flat()
      .map(row => ({ ...row, applications_count: applicationCounts[row.id] || 0 }))
      .sort(
        (a, b) => new Date((b as { posted_at?: string }).posted_at || 0).getTime() - new Date((a as { posted_at?: string }).posted_at || 0).getTime()
      )
    return NextResponse.json({ data: merged })
  }

  // Single owned job for the edit form: GET /api/employer/jobs/{id}?board=wfh
  if (p?.[0] === "jobs" && p?.[1]) {
    const board = boardFromParam(req.nextUrl.searchParams.get("board"))
    const table = JOB_BOARD_TABLE[board]
    const { data, error } = await sb.from(table).select("*").eq("id", p[1]).eq("employer_id", eid).single()
    if (error || !data) return NextResponse.json({ error: "Job not found" }, { status: 404 })
    return NextResponse.json({ data: { ...(data as object), board } })
  }

  if (route === "applications") {
    const status = req.nextUrl.searchParams.get("status") || "all"
    const apps = await getApplicationsByEmployer(eid, status === "all" ? undefined : status)
    return NextResponse.json({ data: apps })
  }

  if (route === "shortlisted") {
    const apps = await getApplicationsByEmployer(eid, "shortlisted")
    return NextResponse.json({ data: apps })
  }

  if (route === "interviews") {
    const { data } = await sb.from("interviews").select("*").eq("employer_id", eid).order("scheduled_at")
    return NextResponse.json({ data: data || [] })
  }

  if (route === "hired") {
    const apps = await getApplicationsByEmployer(eid, "hired")
    return NextResponse.json({ data: apps })
  }

  if (route === "analytics") {
    const analytics = await getEmployerAnalytics(eid)
    return NextResponse.json(analytics)
  }

  if (route === "profile") {
    return NextResponse.json({ data: employer })
  }

  if (route === "billing") {
    const { data } = await sb.from("employer_plans").select("*").eq("employer_id", eid).single()
    return NextResponse.json({ data: data || { plan_type: "free", jobs_limit: 3 } })
  }

  if (route === "settings") {
    const { data } = await sb.from("employer_settings").select("*").eq("employer_id", eid).single()
    return NextResponse.json({
      data: data || { notify_applications: true, notify_interviews: true, notify_messages: true },
    })
  }

  if (p?.[0] === "applications" && p?.[2] === "resume-url" && p?.[1]) {
    const { getEmployerResumeSignedUrlByApplication } = await import(
      "@/lib/storage/employerResumeAccess"
    )
    const url = await getEmployerResumeSignedUrlByApplication(sb, user.id, p[1])
    if (!url) {
      return NextResponse.json({ error: "Resume not available" }, { status: 404 })
    }
    return NextResponse.json({ url })
  }

  if (p?.[0] === "candidates" && p?.[2] === "resume-url" && p?.[1]) {
    const { getEmployerApplicantResumeSignedUrl } = await import(
      "@/lib/storage/employerResumeAccess"
    )
    const url = await getEmployerApplicantResumeSignedUrl(sb, user.id, p[1])
    if (!url) {
      return NextResponse.json({ error: "Resume not available" }, { status: 404 })
    }
    return NextResponse.json({ url })
  }

  if (route === "ai-search") {
    const sp = req.nextUrl.searchParams
    const skill = sp.get("skill") || ""
    const loc = sp.get("location") || ""
    let q = sb
      .from("candidates")
      .select("id, first_name, last_name, skills, city, experience_years, category, resume_url")
    if (skill) q = q.contains("skills", [skill])
    if (loc) q = q.ilike("city", `%${loc}%`)
    const { data, error: searchError } = await q.limit(20)
    if (searchError) {
      return NextResponse.json({ error: searchError.message }, { status: 400 })
    }
    const safe = (data ?? []).map((c) => ({
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      skills: c.skills,
      city: c.city,
      experience_years: c.experience_years,
      category: c.category,
      has_resume: Boolean(c.resume_url),
    }))
    return NextResponse.json({ data: safe })
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const api = await requireApiSupabase()
  if (api.error) return api.error
  const sb = api.sb
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { data: employer } = await sb.from("employers").select("id, company_name").eq("user_id", user.id).single()
  if (!employer) return NextResponse.json({ error: "Employer not found" }, { status: 404 })
  const { params: p } = await params
  const route = p?.join("/") || ""
  const body = await req.json()

  if (route === "jobs") {
    // Validate + WHITELIST. Never spread the raw body: that allowed mass-assignment
    // (a crafted request could set is_verified/is_featured/board/source/apply_url).
    // We accept only these fields, enforce the required ones server-side (can't be
    // bypassed by calling the API directly), and force ownership + the approval gate.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b = body as Record<string, any>
    const board: EmployerJobBoard = isEmployerJobBoard(b.board) ? b.board : "private"
    const eid = (employer as { id: string }).id
    const companyName = b.company ? String(b.company).slice(0, 160) : ((employer as { company_name?: string }).company_name ?? null)

    const title = String(b.title ?? "").trim()
    const description = b.description != null ? String(b.description) : ""
    const skills = (Array.isArray(b.skills)
      ? b.skills
      : typeof b.skills === "string"
        ? b.skills.split(",")
        : []
    ).map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 30)

    if (title.length < 5) return NextResponse.json({ error: "Job title must be at least 5 characters" }, { status: 400 })
    if (description.length < 50) return NextResponse.json({ error: "Description must be at least 50 characters" }, { status: 400 })

    // Employers may save a draft or submit for approval. Both stay behind the
    // admin gate — neither can produce an 'active' job (only admin approval does).
    const asDraft = b.saveAsDraft === true || b.status === "draft"
    // Provenance/status are decided here (server-side), never taken from the body:
    // an authenticated employer posting is genuine EMPLOYER content, always gated
    // behind admin approval regardless of board.
    const status = asDraft ? "draft" : "pending"

    let insertRow: Record<string, unknown>
    let table: "jobs" | "wfh_jobs" | "abroad_jobs"

    if (board === "private") {
      const location = String(b.location ?? "").trim()
      const category = b.category ? String(b.category).trim() : ""
      const jobType = String(b.job_type ?? b.jobType ?? "Full Time").trim()
      const ALLOWED_TYPES = new Set(["Full Time", "Part Time", "Contract", "Internship", "Remote", "Freelance"])
      const toInt = (v: unknown) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null)
      const salaryMin = toInt(b.salary_min ?? b.salaryMin)
      const salaryMax = toInt(b.salary_max ?? b.salaryMax)

      if (location.length < 2) return NextResponse.json({ error: "Location is required" }, { status: 400 })
      if (!category) return NextResponse.json({ error: "Category is required" }, { status: 400 })
      if (!ALLOWED_TYPES.has(jobType)) return NextResponse.json({ error: "Invalid job type" }, { status: 400 })
      if (salaryMin != null && salaryMax != null && salaryMax < salaryMin) {
        return NextResponse.json({ error: "Maximum salary cannot be less than minimum" }, { status: 400 })
      }

      table = "jobs"
      insertRow = {
        title, location, category, description, job_type: jobType, skills,
        salary_min: salaryMin, salary_max: salaryMax,
        experience_required: b.experience_required ? String(b.experience_required).slice(0, 120) : null,
        company: companyName,
        employer_id: eid, board: "private", status, source: "Employer", provenance: "EMPLOYER",
      }
    } else if (board === "wfh") {
      const category = b.category ? String(b.category).trim() : ""
      if (!category) return NextResponse.json({ error: "Category is required" }, { status: 400 })

      table = "wfh_jobs"
      insertRow = {
        id: randomUUID(),
        title, company: companyName,
        type: b.job_type ? String(b.job_type).trim() : "Full-Time Remote",
        experience: b.experience ? String(b.experience).trim().slice(0, 60) : null,
        salary: b.salary ? String(b.salary).trim().slice(0, 60) : null,
        cat: category,
        qualification: b.qualification ? String(b.qualification).trim().slice(0, 120) : null,
        skills, description,
        employer_id: eid, status, provenance: "EMPLOYER",
      }
    } else {
      const country = b.country ? String(b.country).trim() : ""
      if (!country) return NextResponse.json({ error: "Country is required" }, { status: 400 })
      const category = b.category ? String(b.category).trim() : ""
      if (!category) return NextResponse.json({ error: "Category is required" }, { status: 400 })

      table = "abroad_jobs"
      insertRow = {
        id: randomUUID(),
        title, company: companyName, country,
        location: b.location ? String(b.location).trim().slice(0, 160) : null,
        type: b.job_type ? String(b.job_type).trim() : "Full Time",
        salary: b.salary ? String(b.salary).trim().slice(0, 60) : null,
        experience: b.experience ? String(b.experience).trim().slice(0, 60) : null,
        category, description, skills,
        employer_id: eid, status, provenance: "EMPLOYER",
      }
    }

    const { error, data } = await sb.from(table).insert(insertRow as never).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    if (!asDraft) {
      const { alertAdmins } = await import("@/lib/services/adminNotifyService")
      await alertAdmins({
        type: "job_pending",
        title: "New job pending approval",
        message: `"${(data as { title?: string })?.title ?? "A job"}" was submitted and is awaiting approval.`,
        email: true,
      })
    }

    return NextResponse.json({ data: { ...(data as object), board } })
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const api = await requireApiSupabase()
  if (api.error) return api.error
  const sb = api.sb
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { data: employer } = await sb.from("employers").select("id").eq("user_id", user.id).single()
  const { params: p } = await params
  const route = p?.join("/") || ""
  const body = await req.json()

  if (route === "profile") {
    const { error } = await sb.from("employers").update(body).eq("id", (employer as any)?.id)
    return NextResponse.json({ success: !error })
  }

  if (route === "settings") {
    const { error } = await sb.from("employer_settings").upsert({ employer_id: (employer as any)?.id, ...body }, { onConflict: "employer_id" })
    return NextResponse.json({ success: !error })
  }

  // Update an employer's own job content: PUT /api/employer/jobs/{id}?board=wfh
  // Moderation/ownership fields (status, job_status, is_verified, board, …) are
  // stripped so a content edit can never bypass the admin approval gate.
  // Status changes go through PATCH /api/employer/jobs/{id}/status instead.
  if (p?.[0] === "jobs" && p?.[1]) {
    const eid = (employer as any)?.id
    const board = boardFromParam(req.nextUrl.searchParams.get("board"))
    const table = JOB_BOARD_TABLE[board]
    const { stripProtectedJobFields } = await import("@/lib/services/jobLifecycle")
    const safe = stripProtectedJobFields(body as Record<string, unknown>)
    const { error } = await sb.from(table).update(safe as never).eq("id", p[1]).eq("employer_id", eid)
    return NextResponse.json({ success: !error })
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const api = await requireApiSupabase()
  if (api.error) return api.error
  const sb = api.sb
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { data: employer } = await sb.from("employers").select("id").eq("user_id", user.id).single()
  if (!employer) return NextResponse.json({ error: "Employer not found" }, { status: 404 })
  const { params: p } = await params

  // Employer job status transition: PATCH /api/employer/jobs/{id}/status?board=wfh { status }
  if (p?.[0] === "jobs" && p?.[1] && p?.[2] === "status") {
    const eid = (employer as { id: string }).id
    const board = boardFromParam(req.nextUrl.searchParams.get("board"))
    const table = JOB_BOARD_TABLE[board]
    const body = (await req.json().catch(() => ({}))) as { status?: string }
    const target = String(body.status || "")
    const { canEmployerTransition } = await import("@/lib/services/jobLifecycle")

    const { data: job } = await sb
      .from(table)
      .select("status")
      .eq("id", p[1])
      .eq("employer_id", eid)
      .single()
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

    const current = String((job as { status: string }).status)
    if (!canEmployerTransition(current, target)) {
      return NextResponse.json(
        { error: `Cannot change status from '${current}' to '${target || "?"}'.` },
        { status: 400 }
      )
    }
    const { error } = await sb.from(table).update({ status: target }).eq("id", p[1]).eq("employer_id", eid)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true, status: target })
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const api = await requireApiSupabase()
  if (api.error) return api.error
  const sb = api.sb
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { data: employer } = await sb.from("employers").select("id").eq("user_id", user.id).single()
  if (!employer) return NextResponse.json({ error: "Employer not found" }, { status: 404 })
  const { params: p } = await params

  if (p?.[0] === "jobs" && p?.[1]) {
    const board = boardFromParam(req.nextUrl.searchParams.get("board"))
    const table = JOB_BOARD_TABLE[board]
    const { error } = await sb.from(table).delete().eq("id", p[1]).eq("employer_id", (employer as any).id)
    return NextResponse.json({ success: !error })
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 })
}
