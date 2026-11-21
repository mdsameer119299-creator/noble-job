/**
 * candidateScoreHandler.ts — logic of POST /api/candidate/resume-score (dependencies injected so the
 * limits are testable without a live Supabase; the route file wires the real ones).
 *
 * Order matters: authenticate → rate-limit (per account) → candidate lookup → bounded body → work.
 *   401 not signed in · 404 no candidate profile · 429 over the per-candidate limit
 *   400 malformed/typed-wrong body · 408 body too slow · 413 text / job description / body too large
 */
import { NextResponse } from "next/server"
import type { AnalyzeInput } from "@/lib/resume/atsScore"
import type { ParsedResume } from "@/lib/resume/parse"
import type { ResumeScoreResult } from "@/lib/resume/types"
import type { RateLimitDecision, RateLimitPolicy } from "@/lib/security/distributedRateLimit"
import { extToKind } from "@/lib/resume/parse"
import { parserUnavailableResponse } from "@/lib/resume/parseFailure"
import { hasValidResumeSignature } from "@/lib/resume/fileSignature"
import { readBodyLimited } from "@/lib/security/boundedBody"
import {
  BODY_READ_TIMEOUT_MS,
  CANDIDATE_SCORE_BODY_MAX_BYTES,
  JOB_DESCRIPTION_MAX_CHARS,
  JOB_ID_MAX_CHARS,
  RESUME_MAX_TEXT_CHARS,
} from "@/lib/resume/limits"
import { CANDIDATE_SCORE_AI_RATE_POLICY, CANDIDATE_SCORE_RATE_POLICY } from "@/lib/resume/candidateScorePolicy"
import {
  RESUME_BUCKET,
  normalizeResumeStoragePath,
  discoverResumeObjectPath,
} from "@/lib/storage/resumeStorage"

const NO_STORE = { "Cache-Control": "no-store" }
const fail = (error: string, status: number, extra?: Record<string, string>) =>
  NextResponse.json({ error }, { status, headers: { ...NO_STORE, ...extra } })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any

export interface CandidateScoreDeps {
  requireApi: () => Promise<{ sb?: Sb; error?: Response }>
  analyze: (input: AnalyzeInput) => ResumeScoreResult
  enrich: (r: ResumeScoreResult, text: string, jd?: string) => Promise<ResumeScoreResult>
  extract: (buf: Buffer, ext: string) => Promise<ParsedResume>
  rateLimit: (req: Request, policy: RateLimitPolicy, opts?: { subject?: string }) => Promise<RateLimitDecision>
}

export interface CandidateScoreBody {
  jobId?: string
  jobDescription?: string
  text?: string
}

type BodyResult = { ok: true; value: CandidateScoreBody } | { ok: false; status: 400 | 408 | 413; error: string }

/** Read + validate the JSON body. Exported for unit tests. */
export async function readCandidateScoreBody(req: Request): Promise<BodyResult> {
  const read = await readBodyLimited(req, CANDIDATE_SCORE_BODY_MAX_BYTES, {
    requireContentLength: false, // the UI's fetch() always sends it; other clients are still capped by the stream limit
    timeoutMs: BODY_READ_TIMEOUT_MS,
  })
  if (!read.ok) {
    if (read.status === 413) return { ok: false, status: 413, error: "Request body is too large." }
    if (read.status === 408) return { ok: false, status: 408, error: read.error }
    return { ok: false, status: 400, error: "Could not read the request body." }
  }
  if (read.bytes.byteLength === 0) return { ok: true, value: {} }

  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder().decode(read.bytes))
  } catch {
    return { ok: false, status: 400, error: "Request body must be valid JSON." }
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, status: 400, error: "Request body must be a JSON object." }
  }
  const o = parsed as Record<string, unknown>
  const str = (k: string): string | undefined | "BAD" => {
    const v = o[k]
    if (v === undefined || v === null) return undefined
    return typeof v === "string" ? v : "BAD"
  }
  const jobId = str("jobId"), jobDescription = str("jobDescription"), text = str("text")
  if (jobId === "BAD" || jobDescription === "BAD" || text === "BAD") {
    return { ok: false, status: 400, error: "jobId, jobDescription and text must be strings." }
  }
  if (jobId !== undefined && jobId.length > JOB_ID_MAX_CHARS) {
    return { ok: false, status: 400, error: "jobId is invalid." }
  }
  if (text !== undefined && text.length > RESUME_MAX_TEXT_CHARS) {
    return { ok: false, status: 413, error: `Resume text is too long (maximum ${RESUME_MAX_TEXT_CHARS.toLocaleString("en-US")} characters).` }
  }
  if (jobDescription !== undefined && jobDescription.length > JOB_DESCRIPTION_MAX_CHARS) {
    return { ok: false, status: 413, error: `Job description is too long (maximum ${JOB_DESCRIPTION_MAX_CHARS.toLocaleString("en-US")} characters).` }
  }
  return { ok: true, value: { jobId, jobDescription, text } }
}

export function createCandidateScoreHandler(deps: CandidateScoreDeps) {
  return async function POST(req: Request): Promise<Response> {
    try {
      const api = await deps.requireApi()
      if (api.error) return api.error
      const sb = api.sb as Sb
      const {
        data: { user },
      } = await sb.auth.getUser()
      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

      // Per-ACCOUNT limit, before any further database or CPU work.
      const decision = await deps.rateLimit(req, CANDIDATE_SCORE_RATE_POLICY, { subject: user.id })
      if (!decision.allowed) {
        return fail("Too many resume scorings. Please try again later.", 429, { "Retry-After": String(decision.retryAfterSec) })
      }

      const { data: candidate } = await sb.from("candidates").select("id, resume_url").eq("user_id", user.id).single()
      if (!candidate) return NextResponse.json({ error: "Candidate profile not found" }, { status: 404 })

      const body = await readCandidateScoreBody(req)
      if (!body.ok) return fail(body.error, body.status)

      // Resolve the job description (inline wins over jobId).
      let jobDescription = body.value.jobDescription?.trim() || undefined
      if (!jobDescription && body.value.jobId) {
        const { data: job } = await sb.from("jobs").select("description").eq("id", body.value.jobId).single()
        jobDescription = (job as { description?: string } | null)?.description?.trim()?.slice(0, JOB_DESCRIPTION_MAX_CHARS) || undefined
      }

      // Resolve the resume text: explicit text, or parse the stored file.
      let text = body.value.text?.trim() || ""
      let parseWarning: string | undefined

      if (!text) {
        const candidateId = (candidate as { id: string }).id
        const storedPath = (candidate as { resume_url?: string | null }).resume_url
        const path = normalizeResumeStoragePath(storedPath, candidateId) ?? (await discoverResumeObjectPath(sb, candidateId))
        if (!path) {
          return NextResponse.json({ error: "No resume on file. Upload a resume before scoring." }, { status: 400 })
        }
        const { data: file, error } = await sb.storage.from(RESUME_BUCKET).download(path)
        if (error || !file) {
          return NextResponse.json({ error: "Could not read your stored resume." }, { status: 500 })
        }
        const ext = path.split(".").pop() || "pdf"
        const buf = Buffer.from(await file.arrayBuffer())
        const kind = extToKind(ext)
        if (!kind || !hasValidResumeSignature(buf, kind)) {
          return NextResponse.json({ error: "Your stored resume is not a valid PDF, DOC or DOCX file." }, { status: 422 })
        }
        const parsed = await deps.extract(buf, ext)
        text = parsed.text
        parseWarning = parsed.warning
        const unavailable = parserUnavailableResponse(parsed)
        if (unavailable) {
          // PDF parsing disabled/busy: a server-side condition, not a bad file → 503, retryable.
          return NextResponse.json({ error: unavailable.error }, { status: unavailable.status, headers: unavailable.headers })
        }
        if (!text || text.length < 30) {
          return NextResponse.json(
            { error: parseWarning || "Could not extract text from your resume. Try uploading a text-based PDF or DOCX." },
            { status: 422 },
          )
        }
      }

      let result = deps.analyze({ text, jobDescription, parseWarning })

      // The AI recommendation is an external provider call: give it its own, stricter per-account budget.
      // Over budget (or AI not configured) → keep the deterministic recommendations; never fail the request.
      if (result.aiConfigured) {
        const ai = await deps.rateLimit(req, CANDIDATE_SCORE_AI_RATE_POLICY, { subject: user.id })
        if (ai.allowed) result = await deps.enrich(result, text, jobDescription)
      }

      return NextResponse.json({ data: result }, { headers: NO_STORE })
    } catch (e) {
      // Never log message/stack: they can embed resume fragments.
      console.error("[candidate/resume-score] unexpected failure:", e instanceof Error ? e.name : "unknown")
      return fail("Could not score your resume. Please try again.", 500)
    }
  }
}
