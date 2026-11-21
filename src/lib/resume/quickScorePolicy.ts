import type { RateLimitPolicy } from "@/lib/security/distributedRateLimit"

/** Abuse limits for the public POST /api/resume/quick-score endpoint (Next route files cannot export extras). */
export const QUICK_SCORE_RATE_POLICY: RateLimitPolicy = {
  scope: "resume-quick-score",
  perClient: { max: 5, windowMs: 10 * 60_000 }, // 5 uploads / 10 min / client
  global: { max: 600, windowMs: 60 * 60_000 }, //  600 uploads / hour across all clients
}
