/**
 * candidateIntelligence.ts — server helpers for the Candidate Intelligence
 * Engine: activity logging + Career Score persistence.
 *
 * All writes are BEST-EFFORT: if the candidate_intelligence migration has not
 * been applied yet (new columns / table absent), writes fail silently and the
 * app keeps working — persistence simply turns on once the migration lands.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "@/types/supabase"
import { analyzeResume } from "@/lib/resume/atsScore"
import { extractResumeText } from "@/lib/resume/parse"
import {
  RESUME_BUCKET,
  normalizeResumeStoragePath,
  discoverResumeObjectPath,
} from "@/lib/storage/resumeStorage"

type AnyClient = SupabaseClient<Database>

/** Append a timeline event. Never throws. */
export async function logCandidateActivity(
  sb: AnyClient,
  candidateId: string,
  type: string,
  title: string,
  meta: Record<string, unknown> = {},
): Promise<void> {
  try {
    await sb.from("candidate_activity").insert({ candidate_id: candidateId, type, title, meta: meta as Json })
  } catch {
    /* table absent / RLS / offline → drop silently */
  }
}

export interface PersistedCareerScore {
  score: number
  extractedSkills: string[]
  mergedSkills: string[]
  /** True only when the career_score column was actually written (migration applied). */
  scorePersisted: boolean
  /** True when the score differs from the previously stored value. */
  changed: boolean
}

/**
 * Pure decision for Career Score persistence + activity logging.
 *  • scorePersisted   → the score column write succeeded (used to avoid
 *    reporting success when persistence failed).
 *  • shouldLogActivity → log a timeline event ONLY when the score persisted AND
 *    changed, so repeated identical recomputes are idempotent (no duplicates).
 */
export function careerScoreOutcome(prev: number | null, next: number, updateOk: boolean) {
  const scorePersisted = updateOk
  const changed = prev !== next
  return { scorePersisted, changed, shouldLogActivity: scorePersisted && changed }
}

function uniqueMerge(a: string[], b: string[], limit = 50): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of [...a, ...b]) {
    const key = s.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(s.trim())
    if (out.length >= limit) break
  }
  return out
}

/**
 * Download the candidate's stored resume, score it, and persist the Career
 * Score + merge extracted skills into the profile. Returns null when there is
 * no readable resume. Score/skill writes are best-effort.
 */
export async function persistCareerScore(
  sb: AnyClient,
  candidate: { id: string; resume_url?: string | null; skills?: string[] | null; career_score?: number | null },
): Promise<PersistedCareerScore | null> {
  const path =
    normalizeResumeStoragePath(candidate.resume_url ?? null, candidate.id) ??
    (await discoverResumeObjectPath(sb, candidate.id))
  if (!path) return null

  const { data: file, error } = await sb.storage.from(RESUME_BUCKET).download(path)
  if (error || !file) return null

  const ext = path.split(".").pop() || "pdf"
  const buf = Buffer.from(await file.arrayBuffer())
  const parsed = await extractResumeText(buf, ext)
  if (!parsed.text || parsed.text.length < 30) return null

  const result = analyzeResume({ text: parsed.text, parseWarning: parsed.warning })
  const score = Math.round(result.overallScore)
  const mergedSkills = uniqueMerge(candidate.skills ?? [], result.extractedSkills)
  const prev = typeof candidate.career_score === "number" ? candidate.career_score : null

  // Try the full update (needs the migration). On failure fall back to a
  // skills-only update so extracted skills still persist pre-migration.
  const { error: upErr } = await sb
    .from("candidates")
    .update({ career_score: score, career_score_updated_at: new Date().toISOString(), skills: mergedSkills })
    .eq("id", candidate.id)
  const { scorePersisted, changed, shouldLogActivity } = careerScoreOutcome(prev, score, !upErr)
  if (upErr) {
    await sb.from("candidates").update({ skills: mergedSkills }).eq("id", candidate.id)
  }

  if (shouldLogActivity) {
    await logCandidateActivity(sb, candidate.id, "career_score", `Career Score updated to ${score}`, { score })
  }

  return { score, extractedSkills: result.extractedSkills, mergedSkills, scorePersisted, changed }
}
