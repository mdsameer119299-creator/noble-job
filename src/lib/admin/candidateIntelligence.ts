/**
 * candidateIntelligence.ts — pure, dependency-free logic for the admin
 * Candidates intelligence view. No DB/Next imports so it is unit-testable and
 * so the truthfulness rules live in one place:
 *   • a candidate-selected category is NEVER overwritten (derivation only fills a
 *     genuinely missing one, from a real applied job);
 *   • a Career Score is only ever a real persisted number — a missing score is
 *     "Not Scored", never 0%.
 */

/** Raw application row (as needed for aggregation). */
export interface AppRow {
  candidate_id: string
  applied_at: string
  /** Joined job title when the application points at a real job. */
  jobs?: { title?: string | null; category?: string | null } | null
  /** JSON in `notes` for imported/ownerless applications (title lives here). */
  notes?: string | null
}

/** Latest persisted Career Score for a user (from analytics_events). */
export interface ScoreRow {
  user_id: string | null
  created_at: string
  props?: { score?: number | null } | null
}

export interface CandidateBase {
  id: string
  user_id: string
  first_name: string | null
  last_name: string | null
  category: string | null
  profile_score: number | null
  resume_url: string | null
  updated_at: string | null
  // Profile fields consumed by the admin Resume Bank filters.
  city?: string | null
  state?: string | null
  skills?: string[] | null
  experience_years?: string | null
  expected_salary?: number | null
  users?: { email?: string | null; status?: string | null } | null
}

export interface EnrichedCandidate {
  id: string
  user_id: string
  name: string
  email: string | null
  /** The candidate's own category, or one derived from a real applied job. */
  category: string | null
  categoryDerived: boolean
  applicationsCount: number
  latestAppliedJob: string | null
  resumeUploaded: boolean
  /** Real persisted score, or null → the UI shows "Not Scored" (never 0%). */
  careerScore: number | null
  profileCompletion: number
  lastActivity: string | null
  accountStatus: string | null
  // Profile passthrough for the admin Resume Bank filters. NOTE: the raw
  // `resume_url` storage path is deliberately NOT exposed — `resumeUploaded`
  // conveys presence, and access is only ever via a signed URL endpoint.
  city: string | null
  state: string | null
  skills: string[]
  experience_years: string | null
  expected_salary: number | null
}

/** Read a title from an imported application's `notes` JSON (best-effort). */
function importedTitle(notes: string | null | undefined): string | null {
  if (!notes) return null
  try {
    const t = (JSON.parse(notes) as { title?: string }).title
    return t ? String(t) : null
  } catch {
    return null
  }
}

/**
 * Never overwrite a candidate-selected category. Only when it is genuinely
 * empty do we surface one derived from the candidate's most recent real applied
 * job. Returns the value to show + whether it was derived.
 */
export function resolveCategory(
  ownCategory: string | null | undefined,
  derivedFromJob: string | null | undefined,
): { category: string | null; derived: boolean } {
  const own = (ownCategory ?? "").trim()
  if (own) return { category: own, derived: false }
  const d = (derivedFromJob ?? "").trim()
  return d ? { category: d, derived: true } : { category: null, derived: false }
}

/** A persisted numeric score is shown as-is; anything else is "Not Scored". */
export function formatCareerScore(score: number | null | undefined): string {
  if (typeof score === "number" && Number.isFinite(score)) return `${Math.round(score)}`
  return "Not Scored"
}

/** Latest ISO timestamp among the inputs (ignores empties). */
export function computeLastActivity(...times: Array<string | null | undefined>): string | null {
  const valid = times.filter((t): t is string => !!t && !Number.isNaN(Date.parse(t)))
  if (!valid.length) return null
  return valid.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b))
}

/** Aggregate applications per candidate → count, latest job title, latest job
 *  category, latest applied_at. */
export function aggregateApplications(apps: AppRow[]): Map<
  string,
  { count: number; latestTitle: string | null; latestCategory: string | null; latestAt: string | null }
> {
  const byCand = new Map<string, { count: number; latestTitle: string | null; latestCategory: string | null; latestAt: string | null }>()
  for (const a of apps) {
    const cur = byCand.get(a.candidate_id) || { count: 0, latestTitle: null, latestCategory: null, latestAt: null }
    cur.count += 1
    if (!cur.latestAt || Date.parse(a.applied_at) > Date.parse(cur.latestAt)) {
      cur.latestAt = a.applied_at
      cur.latestTitle = a.jobs?.title || importedTitle(a.notes)
      cur.latestCategory = a.jobs?.category || null
    }
    byCand.set(a.candidate_id, cur)
  }
  return byCand
}

/** Latest persisted Career Score per user_id (most recent event wins). */
export function latestScoreByUser(scores: ScoreRow[]): Map<string, number> {
  const seenAt = new Map<string, string>()
  const val = new Map<string, number>()
  for (const s of scores) {
    if (!s.user_id) continue
    const score = s.props?.score
    if (typeof score !== "number" || !Number.isFinite(score)) continue
    const prev = seenAt.get(s.user_id)
    if (!prev || Date.parse(s.created_at) > Date.parse(prev)) {
      seenAt.set(s.user_id, s.created_at)
      val.set(s.user_id, score)
    }
  }
  return val
}

/** Merge candidates with their aggregated applications + latest scores into the
 *  truthful admin-table rows. */
export function mergeCandidateRows(
  candidates: CandidateBase[],
  apps: AppRow[],
  scores: ScoreRow[],
): EnrichedCandidate[] {
  const appAgg = aggregateApplications(apps)
  const scoreByUser = latestScoreByUser(scores)
  const scoreAtByUser = new Map<string, string>()
  for (const s of scores) if (s.user_id && typeof s.props?.score === "number") {
    const prev = scoreAtByUser.get(s.user_id)
    if (!prev || Date.parse(s.created_at) > Date.parse(prev)) scoreAtByUser.set(s.user_id, s.created_at)
  }

  return candidates.map((c) => {
    const agg = appAgg.get(c.id)
    const { category, derived } = resolveCategory(c.category, agg?.latestCategory)
    const careerScore = scoreByUser.has(c.user_id) ? (scoreByUser.get(c.user_id) as number) : null
    return {
      id: c.id,
      user_id: c.user_id,
      name: [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "—",
      email: c.users?.email ?? null,
      category,
      categoryDerived: derived,
      applicationsCount: agg?.count ?? 0,
      latestAppliedJob: agg?.latestTitle ?? null,
      resumeUploaded: !!c.resume_url,
      careerScore,
      profileCompletion: typeof c.profile_score === "number" ? c.profile_score : 0,
      lastActivity: computeLastActivity(c.updated_at, agg?.latestAt, scoreAtByUser.get(c.user_id)),
      accountStatus: c.users?.status ?? null,
      city: c.city ?? null,
      state: c.state ?? null,
      skills: c.skills ?? [],
      experience_years: c.experience_years ?? null,
      expected_salary: c.expected_salary ?? null,
    }
  })
}
