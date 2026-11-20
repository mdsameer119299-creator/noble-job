import { NextRequest, NextResponse } from "next/server"
import { analyzeResume } from "@/lib/resume/atsScore"
import { extractResumeText, extToKind } from "@/lib/resume/parse"
import { hasValidResumeSignature } from "@/lib/resume/fileSignature"
import { validateResumeFile, RESUME_MAX_BYTES } from "@/lib/utils/resumeUpload"
import { readBodyLimited } from "@/lib/security/boundedBody"
import { checkRateLimit } from "@/lib/security/distributedRateLimit"
import { QUICK_SCORE_RATE_POLICY } from "@/lib/resume/quickScorePolicy"

export const runtime = "nodejs"

/** multipart framing overhead allowed on top of the file itself */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024


const NO_STORE = { "Cache-Control": "no-store" }
function fail(error: string, status: number, extra?: Record<string, string>) {
  return NextResponse.json({ error }, { status, headers: { ...NO_STORE, ...extra } })
}

/**
 * POST /api/resume/quick-score — PUBLIC by design, parse-first, no persistence.
 *
 * WHY PUBLIC: this is the acquisition entry point — an anonymous visitor gets an
 * instant ATS score BEFORE creating an account (see ResumeUploadWidget / ImproveFlow).
 * Requiring login would remove that funnel. Instead the endpoint is protected by:
 *   1. a cross-instance rate limit (per client + global, durable store, no paid service),
 *   2. Content-Length checked BEFORE any body byte is read, plus a streaming byte cap,
 *   3. real file-signature validation (extension/MIME alone are not trusted),
 *   4. bounded parsing (DOCX inflate cap, PDF page + time caps — see lib/resume/parse),
 *   5. generic errors only; uploaded content / extracted text is never logged or echoed.
 *
 * Body: multipart/form-data with `file` (PDF/DOC/DOCX, ≤5 MB).
 */
export async function POST(req: NextRequest) {
  try {
    const decision = await checkRateLimit(req, QUICK_SCORE_RATE_POLICY)
    if (!decision.allowed) {
      return fail("Too many resume checks. Please try again later.", 429, {
        "Retry-After": String(decision.retryAfterSec),
      })
    }

    const contentType = req.headers.get("content-type") || ""
    if (!/^multipart\/form-data;/i.test(contentType)) {
      return fail("Expected a file upload.", 415)
    }

    const body = await readBodyLimited(req, RESUME_MAX_BYTES + MULTIPART_OVERHEAD_BYTES)
    if (!body.ok) return fail(body.error, body.status)

    let form: FormData
    try {
      form = await new Response(body.bytes as BodyInit, { headers: { "content-type": contentType } }).formData()
    } catch {
      return fail("Expected a file upload.", 400)
    }

    const file = form.get("file")
    if (!(file instanceof File)) return fail("No resume file provided.", 400)
    if (file.size > RESUME_MAX_BYTES) return fail("File must be 5 MB or smaller.", 413)
    const valid = validateResumeFile(file)
    if (!valid.ok) return fail(valid.error, 415)

    const kind = extToKind(valid.ext)
    const buf = Buffer.from(await file.arrayBuffer())
    if (!kind || !hasValidResumeSignature(buf, kind)) {
      return fail("The file content does not match a PDF, DOC or DOCX resume.", 415)
    }

    const parsed = await extractResumeText(buf, valid.ext)
    if (!parsed.text || parsed.text.length < 30) {
      return fail(parsed.warning || "Could not read your resume. Try a text-based PDF or DOCX.", 422)
    }

    // Heuristic ATS analysis (no job description → generic score). Pure + fast.
    const result = analyzeResume({ text: parsed.text, parseWarning: parsed.warning })

    // Return only what the public widget needs — never the raw resume text.
    return NextResponse.json(
      {
        data: {
          overallScore: result.overallScore,
          atsScore: result.atsScore,
          extractedSkills: result.extractedSkills.slice(0, 12),
          suggestions: result.suggestions.slice(0, 5),
          wordCount: result.wordCount,
          parseWarning: result.parseWarning ?? null,
        },
      },
      { headers: NO_STORE },
    )
  } catch (e) {
    // Never log message/stack: they can embed parser internals or file fragments.
    console.error("[resume/quick-score] unexpected failure:", e instanceof Error ? e.name : "unknown")
    return fail("Could not process your resume. Please try again.", 500)
  }
}
