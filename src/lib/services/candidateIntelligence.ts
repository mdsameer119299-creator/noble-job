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
  candidate: { id: string; resume_url?: string | null; skills?: string[] | null },
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

  // Try the full update (needs the migration). Fall back to skills-only so
  // extracted skills still persist on a pre-migration database.
  try {
    const { error: upErr } = await sb
      .from("candidates")
      .update({ career_score: score, career_score_updated_at: new Date().toISOString(), skills: mergedSkills })
      .eq("id", candidate.id)
    if (upErr) throw upErr
  } catch {
    try {
      await sb.from("candidates").update({ skills: mergedSkills }).eq("id", candidate.id)
    } catch {
      /* ignore */
    }
  }

  await logCandidateActivity(sb, candidate.id, "career_score", `Career Score updated to ${score}`, { score })
  return { score, extractedSkills: result.extractedSkills, mergedSkills }
}
