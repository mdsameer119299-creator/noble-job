import { NextRequest, NextResponse } from "next/server"
import { requireApiSupabase } from "@/lib/supabase/apiHelpers"
import { calculateProfileScore } from "@/lib/services/profileScoreService"

export async function GET(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const api = await requireApiSupabase()
  if (api.error) return api.error
  const sb = api.sb
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { data: candidate } = await sb.from("candidates").select("*").eq("user_id", user.id).single()
  if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 })
  const { params: p } = await params
  const route = p?.join("/") || "dashboard"

  if (route === "dashboard") {
    const { data: apps } = await sb.from("applications").select("status").eq("candidate_id", (candidate as any).id)
    const appData = apps || []
    return NextResponse.json({
      profile: candidate,
      applicationStats: {
        total: appData.length,
        shortlisted: appData.filter((a: any) => a.status === "shortlisted").length,
        interviews: appData.filter((a: any) => a.status === "interview").length,
        hired: appData.filter((a: any) => a.status === "hired").length,
      }
    })
  }

  if (route === "profile") return NextResponse.json({ data: candidate })

  if (route === "ai-score") {
    const score = (candidate as any).profile_score || calculateProfileScore(candidate as any)
    return NextResponse.json({ score, breakdown: [] })
  }

  if (route === "recommended") {
    const category = (candidate as any).category
    let q = sb.from("jobs").select("*").eq("status", "active")
    if (category) q = q.eq("category", category)
    const { data } = await q.order("posted_at", { ascending: false }).limit(20)
    return NextResponse.json({ data: data || [] })
  }

  if (route === "resume-url") {
    const { getResumeUrlWithClient } = await import("@/lib/services/storageService")
    const url = await getResumeUrlWithClient(
      sb,
      (candidate as { id: string }).id,
      (candidate as { resume_url?: string | null }).resume_url
    )
    return NextResponse.json({ url })
  }

  if (route === "bookmarks") {
    const { data } = await sb.from("bookmarks").select("*").eq("user_id", user.id)
    return NextResponse.json({ data: data || [] })
  }

  if (route === "alerts") {
    const { data } = await sb.from("job_alerts").select("*").eq("user_id", user.id).eq("is_active", true)
    return NextResponse.json({ data: data || [] })
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const api = await requireApiSupabase()
  if (api.error) return api.error
  const sb = api.sb
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const { params: p } = await params
  const route = p?.join("/") || "profile"

  if (route === "profile") {
    const { error } = await sb.from("candidates").update(body).eq("user_id", user.id)
    return NextResponse.json({ success: !error })
  }

  return NextResponse.json({ success: true })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const api = await requireApiSupabase()
  if (api.error) return api.error
  const sb = api.sb
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { params: p } = await params
  const route = p?.join("/") || ""

  if (route === "resume") {
    const formData = await req.formData()
    const file = formData.get("file") as File
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

    const { validateResumeFile } = await import("@/lib/utils/resumeUpload")
    const validation = validateResumeFile(file)
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { data: candidate } = await sb
      .from("candidates")
      .select("id, first_name, last_name")
      .eq("user_id", user.id)
      .single()
    if (!candidate) return NextResponse.json({ error: "Candidate profile not found" }, { status: 404 })

    const { resumeObjectPath, createResumeSignedUrl, RESUME_BUCKET } = await import(
      "@/lib/storage/resumeStorage"
    )
    const candidateId = (candidate as { id: string }).id
    const path = resumeObjectPath(candidateId, validation.ext)
    const { error } = await sb.storage.from(RESUME_BUCKET).upload(path, file, { upsert: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await sb.from("candidates").update({ resume_url: path }).eq("user_id", user.id)

    const c = candidate as { first_name?: string; last_name?: string }
    const { alertAdmins } = await import("@/lib/services/adminNotifyService")
    await alertAdmins({
      type: "resume_uploaded",
      title: "Resume uploaded",
      message: `${c.first_name ?? ""} ${c.last_name ?? ""} (${user.email}) uploaded a resume.`.trim(),
      email: true,
    })

    const url = await createResumeSignedUrl(sb, path)
    return NextResponse.json({ url, path })
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 })
}
