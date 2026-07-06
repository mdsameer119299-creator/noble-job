import { NextRequest, NextResponse } from "next/server"
import { requireApiSupabase } from "@/lib/supabase/apiHelpers"
import { analyzeResume, enrichWithAiRecommendations } from "@/lib/resume/atsScore"
import { extractResumeText } from "@/lib/resume/parse"
import {
  RESUME_BUCKET,
  normalizeResumeStoragePath,
  discoverResumeObjectPath,
} from "@/lib/storage/resumeStorage"

export const runtime = "nodejs"

/**
 * POST /api/candidate/resume-score
 * Body (all optional): { jobId?, jobDescription?, text? }
 *   • text        → analyse this text directly (skips file parsing).
 *   • jobId       → load that job's description for keyword matching.
 *   • jobDescription → inline JD (takes precedence over jobId).
 * Without `text`, the candidate's stored resume is downloaded and parsed.
 */
export async function POST(req: NextRequest) {
  const api = await requireApiSupabase()
  if (api.error) return api.error
  const sb = api.sb
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: candidate } = await sb
    .from("candidates")
    .select("id, resume_url")
    .eq("user_id", user.id)
    .single()
  if (!candidate) return NextResponse.json({ error: "Candidate profile not found" }, { status: 404 })

  const body = (await req.json().catch(() => ({}))) as {
    jobId?: string
    jobDescription?: string
    text?: string
  }

  // Resolve the job description (inline wins over jobId).
  let jobDescription = body.jobDescription?.trim() || undefined
  if (!jobDescription && body.jobId) {
    const { data: job } = await sb.from("jobs").select("description").eq("id", body.jobId).single()
    jobDescription = (job as { description?: string } | null)?.description?.trim() || undefined
  }

  // Resolve the resume text: explicit text, or parse the stored file.
  let text = body.text?.trim() || ""
  let parseWarning: string | undefined

  if (!text) {
    const candidateId = (candidate as { id: string }).id
    const storedPath = (candidate as { resume_url?: string | null }).resume_url
    const path =
      normalizeResumeStoragePath(storedPath, candidateId) ??
      (await discoverResumeObjectPath(sb, candidateId))
    if (!path) {
      return NextResponse.json(
        { error: "No resume on file. Upload a resume before scoring." },
        { status: 400 }
      )
    }
    const { data: file, error } = await sb.storage.from(RESUME_BUCKET).download(path)
    if (error || !file) {
      return NextResponse.json({ error: "Could not read your stored resume." }, { status: 500 })
    }
    const ext = path.split(".").pop() || "pdf"
    const buf = Buffer.from(await file.arrayBuffer())
    const parsed = await extractResumeText(buf, ext)
    text = parsed.text
    parseWarning = parsed.warning
    if (!text || text.length < 30) {
      return NextResponse.json(
        {
          error:
            parseWarning ||
            "Could not extract text from your resume. Try uploading a text-based PDF or DOCX.",
        },
        { status: 422 }
      )
    }
  }

  let result = analyzeResume({ text, jobDescription, parseWarning })
  result = await enrichWithAiRecommendations(result, text, jobDescription)

  return NextResponse.json({ data: result })
}
