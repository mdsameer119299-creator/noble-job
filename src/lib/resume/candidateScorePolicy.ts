import type { RateLimitPolicy } from "@/lib/security/distributedRateLimit"

/** Per-candidate limit for POST /api/candidate/resume-score (keyed by account, not IP). */
export const CANDIDATE_SCORE_RATE_POLICY: RateLimitPolicy = {
  scope: "candidate-resume-score",
  perClient: { max: 10, windowMs: 10 * 60_000 }, // 10 scorings / 10 min / candidate
  global: { max: 1200, windowMs: 60 * 60_000 }, //  1,200 / hour across all candidates
}

/**
 * Stricter budget for the AI recommendation call (an external provider call per request).
 * Over budget => the AI step is SKIPPED and the deterministic recommendations are returned (HTTP 200);
 * the request is not failed.
 */
export const CANDIDATE_SCORE_AI_RATE_POLICY: RateLimitPolicy = {
  scope: "candidate-resume-score-ai",
  perClient: { max: 4, windowMs: 10 * 60_000 }, //   4 AI calls / 10 min / candidate
  global: { max: 300, windowMs: 60 * 60_000 }, //  300 AI calls / hour across all candidates
}
