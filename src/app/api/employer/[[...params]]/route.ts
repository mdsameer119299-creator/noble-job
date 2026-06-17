import { NextRequest, NextResponse } from "next/server"
import { requireApiSupabase } from "@/lib/supabase/apiHelpers"
import { getApplicationsByEmployer, updateApplicationStatus } from "@/lib/services/applicationService"
import { getEmployerAnalytics } from "@/lib/services/analyticsService"

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
    const [jobs, apps, interviews] = await Promise.all([
      sb.from("jobs").select("id", { count: "exact" }).eq("employer_id", eid).eq("status", "active"),
      sb.from("applications").select("status").eq("employer_id", eid),
      sb.from("interviews").select("id", { count: "exact" }).eq("employer_id", eid).eq("status", "scheduled"),
    ])
    const appData = apps.data || []
    return NextResponse.json({
      activeJobs: jobs.count || 0,
      applications: appData.length,
      shortlisted: appData.filter((a: any) => a.status === "shortlisted").length,
      interviews: interviews.count || 0,
      hired: appData.filter((a: any) => a.status === "hired").length,
    })
  }

  if (route === "jobs") {
    const { data } = await sb.from("jobs").select("*").eq("employer_id", eid).order("posted_at", { ascending: false })
    return NextResponse.json({ data: data || [] })
  }

  // Single owned job for the edit form: GET /api/employer/jobs/{id}
  if (p?.[0] === "jobs" && p?.[1]) {
    const { data, error } = await sb.from("jobs").select("*").eq("id", p[1]).eq("employer_id", eid).single()
    if (error || !data) return NextResponse.json({ error: "Job not found" }, { status: 404 })
    return NextResponse.json({ data })
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
  const { data: employer } = await sb.from("employers").select("id").eq("user_id", user.id).single()
  if (!employer) return NextResponse.json({ error: "Employer not found" }, { status: 404 })
  const { params: p } = await params
  const route = p?.join("/") || ""
  const body = await req.json()

  if (route === "jobs") {
    const { error, data } = await sb.from("jobs").insert({ ...body, employer_id: (employer as any).id, status: "pending" }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const { alertAdmins } = await import("@/lib/services/adminNotifyService")
    await alertAdmins({
      type: "job_pending",
      title: "New job pending approval",
      message: `"${(data as { title?: string })?.title ?? "A job"}" was submitted and is awaiting approval.`,
      email: true,
    })

    return NextResponse.json({ data })
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

  // Update an employer's own job: PUT /api/employer/jobs/{id}
  if (p?.[0] === "jobs" && p?.[1]) {
    const eid = (employer as any)?.id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { id: _omitId, employer_id: _omitEid, ...safe } = body as any
    const { error } = await sb.from("jobs").update(safe).eq("id", p[1]).eq("employer_id", eid)
    return NextResponse.json({ success: !error })
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
    const { error } = await sb.from("jobs").delete().eq("id", p[1]).eq("employer_id", (employer as any).id)
    return NextResponse.json({ success: !error })
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 })
}
