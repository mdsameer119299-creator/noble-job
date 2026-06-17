import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { requireAdminApi } from "@/lib/auth/verifyAdminApi"
import { getAdminStats, approveJob, rejectJob, toggleEmployerStatus } from "@/lib/services/adminService"

export async function GET(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error
  const { params: p } = await params
  const route = p?.join("/") || "stats"

  // --- Admin candidate detail: GET /api/admin/candidates/{id} ---
  if (p?.[0] === "candidates" && p?.[1] && !p?.[2]) {
    const { data, error } = await supabaseAdmin
      .from("candidates")
      .select("*, users(email, status, created_at)")
      .eq("id", p[1])
      .single()
    if (error || !data) return NextResponse.json({ error: "Candidate not found" }, { status: 404 })
    return NextResponse.json({ data })
  }

  // --- Admin resume access (signed URL): GET /api/admin/candidates/{id}/resume-url ---
  if (p?.[0] === "candidates" && p?.[1] && p?.[2] === "resume-url") {
    const candidateId = p[1]
    const { data: candidate } = await supabaseAdmin
      .from("candidates")
      .select("resume_url")
      .eq("id", candidateId)
      .single()
    if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 })
    const { resolveResumeSignedUrl } = await import("@/lib/storage/resumeStorage")
    const url = await resolveResumeSignedUrl(
      // service-role client is runtime-compatible with the storage helpers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabaseAdmin as any,
      candidateId,
      (candidate as { resume_url?: string | null }).resume_url
    )
    if (!url) return NextResponse.json({ error: "Resume not available" }, { status: 404 })
    // Audit: which admin opened which candidate's resume.
    console.info(`[admin-resume-access] admin=${auth.user?.id} candidate=${candidateId}`)
    return NextResponse.json({ url })
  }

  // --- Admin applications list (filter + search): GET /api/admin/applications ---
  if (route === "applications") {
    const sp = req.nextUrl.searchParams
    const status = sp.get("status")
    const board = sp.get("board")
    const owner = sp.get("owner")
    const q = sp.get("q")?.trim()
    let query = supabaseAdmin
      .from("applications")
      .select(
        "*, candidates(first_name, last_name, users(email)), employers(company_name), jobs(title)"
      )
      .order("applied_at", { ascending: false })
      .limit(200)
    if (status && status !== "all") query = query.eq("status", status)
    if (board && board !== "all") query = query.eq("board", board)
    // Recruitment Queue: ownerless (imported) applications have no employer account.
    if (owner === "unassigned") query = query.is("employer_id", null)
    else if (owner === "employer") query = query.not("employer_id", "is", null)
    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    let rows = (data || []) as Record<string, unknown>[]
    if (q) {
      const needle = q.toLowerCase()
      rows = rows.filter((r) => {
        const c = r.candidates as { first_name?: string; last_name?: string; users?: { email?: string } } | null
        const j = r.jobs as { title?: string } | null
        const e = r.employers as { company_name?: string } | null
        const hay = [
          c?.first_name,
          c?.last_name,
          c?.users?.email,
          j?.title,
          e?.company_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        return hay.includes(needle)
      })
    }
    return NextResponse.json({ data: rows })
  }

  if (route === "stats") {
    const stats = await getAdminStats()
    return NextResponse.json(stats)
  }

  if (route === "trend") {
    const { getAdminTrendData } = await import("@/lib/services/adminAnalytics")
    const data = await getAdminTrendData()
    return NextResponse.json({ data })
  }

  if (route === "pending-jobs") {
    const { data } = await supabaseAdmin.from("jobs").select("*").eq("status", "pending").order("posted_at", { ascending: false })
    return NextResponse.json({ data: data || [] })
  }

  if (route === "jobs") {
    const board = req.nextUrl.searchParams.get("board")
    let q = supabaseAdmin.from("jobs").select("*")
    if (board) q = q.eq("board", board)
    const { data } = await q.order("posted_at", { ascending: false })
    return NextResponse.json({ data: data || [] })
  }

  if (route === "employers") {
    const { data } = await supabaseAdmin.from("employers").select("*, users(email, status, created_at)").order("created_at", { ascending: false })
    return NextResponse.json({ data: data || [] })
  }

  if (route === "candidates") {
    const { data } = await supabaseAdmin.from("candidates").select("*, users(email, status, created_at)").order("created_at", { ascending: false })
    return NextResponse.json({ data: data || [] })
  }

  if (route === "messages") {
    const { data } = await supabaseAdmin.from("contact_messages").select("*").order("created_at", { ascending: false })
    return NextResponse.json({ data: data || [] })
  }

  if (route === "govt-jobs") {
    const { data } = await supabaseAdmin.from("govt_jobs").select("*").order("sort_order")
    return NextResponse.json({ data: data || [] })
  }

  if (route === "abroad-jobs") {
    const { data } = await supabaseAdmin.from("abroad_jobs").select("*").order("posted_at", { ascending: false })
    return NextResponse.json({ data: data || [] })
  }

  // Single job for the admin edit form: GET /api/admin/jobs/{id}
  if (p?.[0] === "jobs" && p?.[1]) {
    const { data, error } = await supabaseAdmin.from("jobs").select("*").eq("id", p[1]).single()
    if (error || !data) return NextResponse.json({ error: "Job not found" }, { status: 404 })
    return NextResponse.json({ data })
  }

  // Employer detail + stats: GET /api/admin/employers/{id}
  if (p?.[0] === "employers" && p?.[1] && !p?.[2]) {
    const eid = p[1]
    const { data: emp, error } = await supabaseAdmin
      .from("employers")
      .select("*, users(email, status, created_at)")
      .eq("id", eid)
      .single()
    if (error || !emp) return NextResponse.json({ error: "Employer not found" }, { status: 404 })
    const [jobsCount, appsCount, apps] = await Promise.all([
      supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }).eq("employer_id", eid),
      supabaseAdmin.from("applications").select("id", { count: "exact", head: true }).eq("employer_id", eid),
      supabaseAdmin.from("applications").select("candidate_id").eq("employer_id", eid),
    ])
    const candidateCount = new Set((apps.data || []).map((a) => (a as { candidate_id: string }).candidate_id)).size
    return NextResponse.json({
      data: emp,
      stats: { jobs: jobsCount.count || 0, applications: appsCount.count || 0, candidates: candidateCount },
    })
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error
  const { params: p } = await params
  const route = p?.join("/") || ""

  if (route.includes("/approve")) {
    const id = p?.[0]; if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })
    await approveJob(id)
    return NextResponse.json({ success: true })
  }

  if (route.includes("/reject")) {
    const id = p?.[0]; if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })
    await rejectJob(id)
    return NextResponse.json({ success: true })
  }

  if (route === "jobs") {
    const body = await req.json()
    // Respect the requested status (draft → pending, publish → active, close → closed).
    const ALLOWED = new Set(["active", "pending", "closed"])
    const status = ALLOWED.has(body.status) ? body.status : "active"
    const { data, error } = await supabaseAdmin.from("jobs").insert({ ...body, status }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ data })
  }

  if (route === "reset") {
    // Safety: only truncate non-essential tables
    await supabaseAdmin.from("contact_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000")
    return NextResponse.json({ success: true, message: "Reset complete" })
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error
  const { params: p } = await params
  const route = p?.join("/") || ""
  const body = await req.json()

  if (route === "content") {
    const { updateSiteContent } = await import("@/lib/services/siteContentService")
    for (const [key, value] of Object.entries(body)) await updateSiteContent(key, value as string)
    return NextResponse.json({ success: true })
  }

  if (route === "settings") {
    const { updateAdminSetting } = await import("@/lib/services/siteContentService")
    for (const [key, value] of Object.entries(body)) await updateAdminSetting(key, String(value))
    return NextResponse.json({ success: true })
  }

  if (route.startsWith("jobs/")) {
    const id = p?.[1]
    const { error } = await supabaseAdmin.from("jobs").update(body).eq("id", id!)
    return NextResponse.json({ success: !error })
  }

  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error
  const { params: p } = await params
  const body = await req.json()

  if (p?.[0] === "employers" && p?.[2] === "status") {
    await toggleEmployerStatus(p[1], body.currentStatus)
    return NextResponse.json({ success: true })
  }

  if (p?.[0] === "candidates" && p?.[2] === "status") {
    const { toggleCandidateStatus } = await import("@/lib/services/adminService")
    await toggleCandidateStatus(p[1], body.currentStatus)
    return NextResponse.json({ success: true })
  }

  if (p?.[0] === "employers" && p?.[2] === "verify") {
    const { verifyEmployer } = await import("@/lib/services/adminService")
    await verifyEmployer(p[1])
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error
  const { params: p } = await params
  if (p?.[0] === "jobs" && p?.[1]) {
    const { error } = await supabaseAdmin.from("jobs").delete().eq("id", p[1])
    return NextResponse.json({ success: !error })
  }
  return NextResponse.json({ success: true })
}
