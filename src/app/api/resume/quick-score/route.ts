import { NextRequest, NextResponse } from "next/server"
import { analyzeResume } from "@/lib/resume/atsScore"
import { extractResumeText } from "@/lib/resume/parse"
import { validateResumeFile, RESUME_MAX_BYTES } from "@/lib/utils/resumeUpload"

export const runtime = "nodejs"

/**
 * POST /api/resume/quick-score — PUBLIC, parse-first, no auth, no persistence.
 *
 * The acquisition entry point: an anonymous visitor uploads a resume and gets an
 * instant AI ATS score + detected skills + improvement tips, WITHOUT creating an
 * account. Nothing is stored; the widget then invites the visitor to create a
 * free account to save it, apply internally, and get matched.
 *
 * Body: multipart/form-data with `file` (PDF/DOC/DOCX, ≤5 MB).
 */
export async function POST(req: NextRequest) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 })
  }

  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No resume file provided." }, { status: 400 })
  }
  if (file.size > RESUME_MAX_BYTES) {
    return NextResponse.json({ error: "File must be 5 MB or smaller." }, { status: 413 })
  }
  const valid = validateResumeFile(file)
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 415 })

  const buf = Buffer.from(await file.arrayBuffer())
  const parsed = await extractResumeText(buf, valid.ext)
  if (!parsed.text || parsed.text.length < 30) {
    return NextResponse.json(
      { error: parsed.warning || "Could not read your resume. Try a text-based PDF or DOCX." },
      { status: 422 },
    )
  }

  // Heuristic ATS analysis (no job description → generic score). Pure + fast.
  const result = analyzeResume({ text: parsed.text, parseWarning: parsed.warning })

  // Return only what the public widget needs — never the raw resume text.
  return NextResponse.json({
    data: {
      overallScore: result.overallScore,
      atsScore: result.atsScore,
      extractedSkills: result.extractedSkills.slice(0, 12),
      suggestions: result.suggestions.slice(0, 5),
      wordCount: result.wordCount,
      parseWarning: result.parseWarning ?? null,
    },
  })
}
