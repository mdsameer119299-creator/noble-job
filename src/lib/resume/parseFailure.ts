import type { ParsedResume } from "@/lib/resume/parse"

/**
 * Shared mapping from a parser outcome to a "service temporarily unavailable" response.
 * "busy" (all PDF worker slots taken) and "unavailable" (PDF parsing disabled via
 * PDF_PARSING_ENABLED=false, or worker threads unusable) are SERVER-side conditions,
 * not a problem with the user's file, so they must be 503 + Retry-After, not 422.
 * Returns null for every other outcome (the caller keeps its own 422 handling).
 */
export function parserUnavailableResponse(parsed: Pick<ParsedResume, "code" | "warning">):
  | { status: 503; error: string; headers: Record<string, string> }
  | null {
  if (parsed.code === "busy" || parsed.code === "unavailable") {
    return {
      status: 503,
      error: parsed.warning || "Resume scoring is temporarily unavailable. Please try again shortly.",
      headers: { "Retry-After": "30" },
    }
  }
  return null
}
