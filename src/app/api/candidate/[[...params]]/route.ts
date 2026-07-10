import { NextRequest, NextResponse } from "next/server"
import { requireApiSupabase } from "@/lib/supabase/apiHelpers"
import { calculateProfileScore } from "@/lib/services/profileScoreService"
import { profileCompletion } from "@/lib/candidate/profileCompletion"
import { suggestSkills, INTERVIEW_PREP_LINKS } from "@/lib/candidate/recommendations"
import { isCandidateStatus, statusMeta, DEFAULT_CANDIDATE_STATUS } from "@/lib/candidate/status"
import { persistCareerScore, logCandidateActivity } from "@/lib/services/candidateIntelligence"
import { isGenuine, jobDetailHref } from "@/lib/jobs/provenance"
import { ALL_ARTICLES } from "@/lib/seo/articles"

export const runtime = "nodejs"

/** Up to 3 verified career guides relevant to a candidate's field. */
function guidesForCategory(category?: string | null): { label: string; href: string }[] {
  const cat = (category || "").toLowerCase()
  const tokens = cat.split(/[^a-z]+/).filter(t => t.length >= 3)
  const scored = ALL_ARTICLES.map(a => {
    const hay = `${a.title} ${a.keywords.join(" ")} ${a.cluster}`.toLowerCase()
    const score = tokens.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0)
    return { a, score }
  })
  const ranked = scored.filter(s => s.score > 0).sort((x, y) => y.score - x.score)
  const chosen = (ranked.length ? ranked : scored.slice(0, 3).map(s => ({ ...s, score: 0 }))).slice(0, 3)
  return chosen.map(({ a }) => ({ label: a.title, href: `/guides/${a.slug}` }))
}

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

  // Consolidated Candidate Intelligence payload for the AI dashboard.
  if (route === "intelligence") {
    const c = candidate as any

    const completion = profileCompletion({
      first_name: c.first_name, last_name: c.last_name, phone: c.phone, city: c.city,
      category: c.category, experience_years: c.experience_years, skills: c.skills,
      resume_url: c.resume_url, availability_status: c.availability_status,
    })

    // VERIFIED job recommendations only — genuine + linkable active jobs.
    let jobs: { id: string; title: string; company: string; location: string; href: string }[] = []
    try {
      let jq = sb.from("jobs").select("*").eq("status", "active")
      if (c.category) jq = jq.eq("category", c.category)
      const { data } = await jq.order("posted_at", { ascending: false }).limit(15)
      jobs = (data || [])
        .map((j: any) => {
          const href = jobDetailHref("private", { ...j, board: "private" })
          return isGenuine({ ...j, board: "private" }) && href
            ? { id: String(j.id), title: String(j.title), company: String(j.company || ""), location: String(j.location || ""), href }
            : null
        })
        .filter(Boolean)
        .slice(0, 5) as typeof jobs
    } catch { jobs = [] }

    // Activity: stored events + a derived "joined" event so it is never empty.
    let activity: { type: string; title: string; meta: unknown; created_at: string }[] = []
    try {
      const { data } = await sb
        .from("candidate_activity")
        .select("type,title,meta,created_at")
        .eq("candidate_id", c.id)
        .order("created_at", { ascending: false })
        .limit(20)
      activity = (data as any[]) || []
    } catch { activity = [] }
    activity = [...activity, { type: "joined", title: "Joined Noble Job", meta: {}, created_at: c.created_at }]

    return NextResponse.json({
      profile: { first_name: c.first_name, category: c.category, city: c.city },
      careerScore: { value: c.career_score ?? null, updatedAt: c.career_score_updated_at ?? null },
      profileScore: c.profile_score ?? calculateProfileScore(c),
      status: isCandidateStatus(c.availability_status) ? c.availability_status : DEFAULT_CANDIDATE_STATUS,
      completion,
      recommendations: {
        skills: suggestSkills(c.category, c.skills || []),
        jobs,
        guides: guidesForCategory(c.category),
        interviewPrep: INTERVIEW_PREP_LINKS,
        salary: null, // Coming soon — no verified salary dataset yet
      },
      activity,
    })
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

  if (route === "resources") {
    // career_resources is not in the generated Database types; cast to decouple.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (sb as any)
      .from("career_resources")
      .select("*")
      .order("order_index", { ascending: true })
    return NextResponse.json({ data: data || [] })
  }

  if (route === "interview-prep") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (sb as any)
      .from("interview_modules")
      .select("*")
      .order("order_index", { ascending: true })
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
    // Profile is candidate data — surface a real error if the write fails
    // (never report success on a failed persist).
    const { error } = await sb.from("candidates").update(body).eq("user_id", user.id)
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (route === "status") {
    // Availability is CANDIDATE-CONTROLLED and explicit — never inferred.
    if (!isCandidateStatus(body?.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }
    const { data: cand } = await sb.from("candidates").select("id").eq("user_id", user.id).single()
    const cid = (cand as { id: string } | null)?.id
    const { error } = await sb.from("candidates").update({ availability_status: body.status }).eq("user_id", user.id)
    if (error) {
      // Must NOT silently succeed when persistence failed (e.g. migration not applied).
      return NextResponse.json(
        { success: false, error: "Could not save your status. Please try again." },
        { status: 500 },
      )
    }
    // Activity logging is best-effort (analytics-like) — may fail silently.
    if (cid) await logCandidateActivity(sb, cid, "status", `Status set to ${statusMeta(body.status).label}`, { status: body.status })
    return NextResponse.json({ success: true })
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

    // Persist Career Score + merge extracted skills + log activity (best-effort;
    // never blocks the upload response on failure).
    try {
      const { data: fresh } = await sb
        .from("candidates")
        .select("id, resume_url, skills, career_score")
        .eq("user_id", user.id)
        .single()
      if (fresh) {
        await logCandidateActivity(sb, (fresh as { id: string }).id, "resume", "Uploaded a new resume")
        await persistCareerScore(sb, fresh as { id: string; resume_url?: string | null; skills?: string[] | null; career_score?: number | null })
      }
    } catch {
      /* on upload, score/skills persistence is best-effort — the upload itself succeeded */
    }

    const url = await createResumeSignedUrl(sb, path)
    return NextResponse.json({ url, path })
  }

  if (route === "career-score") {
    const { data: cand } = await sb
      .from("candidates")
      .select("id, resume_url, skills, career_score")
      .eq("user_id", user.id)
      .single()
    if (!cand) return NextResponse.json({ error: "Candidate not found" }, { status: 404 })
    const result = await persistCareerScore(sb, cand as { id: string; resume_url?: string | null; skills?: string[] | null; career_score?: number | null })
    if (!result) {
      return NextResponse.json({ error: "No readable resume on file. Upload a resume first." }, { status: 400 })
    }
    // The Career Score is candidate data — do NOT report success if it did not
    // actually persist (e.g. the candidate_intelligence migration is not applied).
    if (!result.scorePersisted) {
      return NextResponse.json(
        { error: "Could not save your Career Score. Please try again later." },
        { status: 500 },
      )
    }
    return NextResponse.json({ data: { score: result.score, skills: result.mergedSkills } })
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 })
}
