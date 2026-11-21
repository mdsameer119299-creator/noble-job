import { requireApiSupabase } from "@/lib/supabase/apiHelpers"
import { analyzeResume, enrichWithAiRecommendations } from "@/lib/resume/atsScore"
import { extractResumeText } from "@/lib/resume/parse"
import { checkRateLimit } from "@/lib/security/distributedRateLimit"
import { createCandidateScoreHandler } from "@/lib/resume/candidateScoreHandler"

export const runtime = "nodejs"

/**
 * POST /api/candidate/resume-score — authenticated candidates only.
 * Body (all optional, ≤ 512 KB): { jobId?, jobDescription?, text? }
 *   • text           → analyse this text directly (skips file parsing); ≤ 100,000 characters.
 *   • jobId          → load that job's description for keyword matching.
 *   • jobDescription → inline JD (takes precedence over jobId); ≤ 20,000 characters.
 * Without `text`, the candidate's stored resume is downloaded and parsed.
 * Limits, status codes and ordering: see lib/resume/candidateScoreHandler.ts.
 */
export const POST = createCandidateScoreHandler({
  requireApi: requireApiSupabase,
  analyze: analyzeResume,
  enrich: enrichWithAiRecommendations,
  extract: extractResumeText,
  rateLimit: checkRateLimit,
})
