import { supabaseAdmin } from "@/lib/supabase/admin"
import {
  mergeCandidateRows,
  type CandidateBase,
  type AppRow,
  type ScoreRow,
  type EnrichedCandidate,
} from "@/lib/admin/candidateIntelligence"

/**
 * candidateAdminService — assembles the truthful admin Candidates intelligence
 * view from real persisted data only. All reads use the service-role client.
 * Enrichment is batched by the current page's ids (never a full-table scan) and
 * is resilient to the OPTIONAL analytics_events table being absent (→ no
 * persisted Career Scores, shown as "Not Scored" — never fabricated).
 */

const CAND_SELECT =
  "id, user_id, first_name, last_name, category, profile_score, resume_url, updated_at, city, state, skills, experience_years, expected_salary, users(email, status, created_at)"

/** Latest `resume_score_generated` events for the given users. Never throws. */
async function fetchScores(userIds: string[]): Promise<ScoreRow[]> {
  if (!userIds.length) return []
  try {
    const { data, error } = await supabaseAdmin
      .from("analytics_events")
      .select("user_id, created_at, props")
      .eq("event", "resume_score_generated")
      .in("user_id", userIds)
      .order("created_at", { ascending: false })
      .limit(2000)
    if (error) return []
    return (data || []) as unknown as ScoreRow[]
  } catch {
    return []
  }
}

/** Applications for the given candidates, with joined job title/category. */
async function fetchApps(candidateIds: string[]): Promise<AppRow[]> {
  if (!candidateIds.length) return []
  const { data, error } = await supabaseAdmin
    .from("applications")
    .select("candidate_id, applied_at, notes, jobs(title, category)")
    .in("candidate_id", candidateIds)
  if (error) return []
  return (data || []) as unknown as AppRow[]
}

export interface EnrichedResult {
  data: EnrichedCandidate[]
  total: number
  error?: string
}

/** Paginated, enriched candidate rows for the admin table. */
export async function getEnrichedCandidates(opts: { limit: number; offset: number; q: string }): Promise<EnrichedResult> {
  const base = supabaseAdmin.from("candidates").select(CAND_SELECT, { count: "exact" }).order("created_at", { ascending: false })
  // When searching, scan a bounded window then filter; else page in the DB.
  const { data, error, count } = opts.q
    ? await base.limit(500)
    : await base.range(opts.offset, opts.offset + opts.limit - 1)
  if (error) return { data: [], total: 0, error: error.message }

  const cands = (data || []) as unknown as CandidateBase[]
  const candIds = cands.map((c) => c.id)
  const userIds = Array.from(new Set(cands.map((c) => c.user_id).filter(Boolean)))
  const [apps, scores] = await Promise.all([fetchApps(candIds), fetchScores(userIds)])
  const rows = mergeCandidateRows(cands, apps, scores)

  if (opts.q) {
    const needle = opts.q.toLowerCase()
    const filtered = rows.filter((r) =>
      [r.name, r.email, r.category].filter(Boolean).join(" ").toLowerCase().includes(needle),
    )
    return { data: filtered.slice(opts.offset, opts.offset + opts.limit), total: filtered.length }
  }
  return { data: rows, total: count ?? rows.length }
}

// ── Candidate detail intelligence ────────────────────────────────────────

export interface TimelineItem { at: string; kind: string; label: string }

/** Full detail for one candidate: profile, resume, applications history, saved
 *  jobs, job alerts, Career Score history + Resume AI usage, activity timeline.
 *  Returns null when the candidate does not exist. Uses only real persisted data. */
export async function getCandidateIntelligence(id: string) {
  const { data: candidate, error } = await supabaseAdmin
    .from("candidates")
    .select("*, users(email, status, created_at)")
    .eq("id", id)
    .single()
  if (error || !candidate) return null
  const c = candidate as unknown as CandidateBase & { user_id: string }
  const userId = c.user_id

  const [appsRes, savedRes, alertsRes, events] = await Promise.all([
    supabaseAdmin
      .from("applications")
      .select("id, status, board, applied_at, notes, jobs(title, category)")
      .eq("candidate_id", id)
      .order("applied_at", { ascending: false }),
    supabaseAdmin
      .from("saved_jobs")
      .select("id, job_id, board, saved_at")
      .eq("candidate_id", id)
      .order("saved_at", { ascending: false }),
    userId
      ? supabaseAdmin.from("job_alerts").select("id, keywords, category, location, job_type, board, frequency, is_active, created_at").eq("user_id", userId).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as unknown[] }),
    fetchResumeEvents(userId),
  ])

  const applications = (appsRes.data || []) as unknown as Array<{
    id: string; status: string; board: string; applied_at: string; notes: string | null; jobs?: { title?: string; category?: string } | null
  }>
  const savedJobs = (savedRes.data || []) as unknown as Array<{ id: string; job_id: string; board: string; saved_at: string }>
  const jobAlerts = ((alertsRes as { data?: unknown[] }).data || []) as Array<Record<string, unknown>>

  const scoreEvents = events.filter((e) => e.event === "resume_score_generated" && typeof e.props?.score === "number")
  const careerScore = scoreEvents[0]?.props?.score ?? null
  const scoreHistory = scoreEvents.map((e) => ({ at: e.created_at, score: e.props?.score as number, source: (e.props?.source as string) || null }))
  const resumeAiUsage = events.map((e) => ({ at: e.created_at, event: e.event, props: e.props || {} }))

  // Activity timeline: applications + resume-AI events + saved jobs, newest first.
  const timeline: TimelineItem[] = [
    ...applications.map((a) => ({ at: a.applied_at, kind: "application", label: `Applied to ${a.jobs?.title || safeTitle(a.notes) || "a job"}` })),
    ...savedJobs.map((s) => ({ at: s.saved_at, kind: "saved", label: `Saved a ${s.board} job` })),
    ...events.map((e) => ({ at: e.created_at, kind: "resume_ai", label: resumeEventLabel(e.event, e.props) })),
  ]
    .filter((t) => t.at)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 100)

  return {
    candidate: c,
    applications,
    savedJobs,
    jobAlerts,
    careerScore,
    scoreHistory,
    resumeAiUsage,
    timeline,
  }
}

interface ResumeEvent { event: string; created_at: string; props: { score?: number | null; source?: string; mode?: string } | null }

/** All resume_* analytics events for a user (Resume AI usage). Never throws. */
async function fetchResumeEvents(userId: string | null): Promise<ResumeEvent[]> {
  if (!userId) return []
  try {
    const { data, error } = await supabaseAdmin
      .from("analytics_events")
      .select("event, created_at, props")
      .like("event", "resume_%")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500)
    if (error) return []
    return (data || []) as unknown as ResumeEvent[]
  } catch {
    return []
  }
}

function safeTitle(notes: string | null): string | null {
  if (!notes) return null
  try { return (JSON.parse(notes) as { title?: string }).title || null } catch { return null }
}

function resumeEventLabel(event: string, props: ResumeEvent["props"]): string {
  switch (event) {
    case "resume_score_generated": return `Career Score generated${typeof props?.score === "number" ? ` (${Math.round(props.score)})` : ""}`
    case "resume_workspace_viewed": return `Opened Resume AI · ${props?.mode || ""}`.trim()
    case "resume_file_selected": return "Selected a resume in Resume AI"
    case "resume_mode_selected": return `Chose Resume AI mode · ${props?.mode || ""}`.trim()
    case "resume_upload": return "Uploaded a resume"
    case "resume_parsed": return "Resume parsed"
    default: return event.replace(/_/g, " ")
  }
}
