import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { requireAdminApi } from "@/lib/auth/verifyAdminApi"
import { getAdminStats, approveJob, rejectJob, toggleEmployerStatus } from "@/lib/services/adminService"
import { hasRealApplyUrl } from "@/lib/jobs/provenance"
import {
  validateKeyValueBody,
  parsePagination,
  parseJobIds,
  isUuid,
  ADMIN_LIST_MAX_LIMIT,
} from "@/lib/validation/adminValidation"

/** Standard failure helpers — a real DB error is never hidden as an empty list
 *  and a failed mutation never reports success. */
function dbError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 })
}
function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

/** In-memory needle match over selected string fields (safe: no user input is
 *  ever interpolated into a PostgREST filter grammar). */
function matches(row: Record<string, unknown>, fields: Array<string | undefined>, needle: string) {
  const hay = fields.filter(Boolean).join(" ").toLowerCase()
  return hay.includes(needle)
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error
  const { params: p } = await params
  const route = p?.join("/") || "stats"
  const sp = req.nextUrl.searchParams
  const get = (k: string) => sp.get(k)

  // --- Admin candidate detail: GET /api/admin/candidates/{id} ---
  if (p?.[0] === "candidates" && p?.[1] && !p?.[2]) {
    const { data, error } = await supabaseAdmin
      .from("candidates")
      .select("*, users(email, status, created_at)")
      .eq("id", p[1])
      .single()
    if (error || !data) return NextResponse.json({ error: "Candidate not found" }, { status: 404 })
    return NextResponse.json({ data })
  }

  // --- Admin resume access (signed URL): GET /api/admin/candidates/{id}/resume-url ---
  if (p?.[0] === "candidates" && p?.[1] && p?.[2] === "resume-url") {
    const candidateId = p[1]
    const { data: candidate } = await supabaseAdmin
      .from("candidates")
      .select("resume_url")
      .eq("id", candidateId)
      .single()
    if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 })
    const { resolveResumeSignedUrl } = await import("@/lib/storage/resumeStorage")
    const url = await resolveResumeSignedUrl(
      // service-role client is runtime-compatible with the storage helpers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabaseAdmin as any,
      candidateId,
      (candidate as { resume_url?: string | null }).resume_url
    )
    if (!url) return NextResponse.json({ error: "Resume not available" }, { status: 404 })
    // Audit: which admin opened which candidate's resume.
    console.info(`[admin-resume-access] admin=${auth.user?.id} candidate=${candidateId}`)
    return NextResponse.json({ url })
  }

  // --- Admin candidate intelligence: GET /api/admin/candidates/{id}/intelligence ---
  if (p?.[0] === "candidates" && p?.[1] && p?.[2] === "intelligence") {
    if (!isUuid(p[1])) return NextResponse.json({ error: "Valid candidate id required" }, { status: 400 })
    const { getCandidateIntelligence } = await import("@/lib/services/candidateAdminService")
    const data = await getCandidateIntelligence(p[1])
    if (!data) return NextResponse.json({ error: "Candidate not found" }, { status: 404 })
    return NextResponse.json({ data })
  }

  // --- Admin applications list (filter + search + pagination) ---
  if (route === "applications") {
    const status = get("status")
    const board = get("board")
    const owner = get("owner")
    const { limit, offset, q } = parsePagination(get)
    let query = supabaseAdmin
      .from("applications")
      .select(
        "*, candidates(first_name, last_name, users(email)), employers(company_name), jobs(title)",
        { count: "exact" }
      )
      .order("applied_at", { ascending: false })
    if (status && status !== "all") query = query.eq("status", status)
    if (board && board !== "all") query = query.eq("board", board)
    // Recruitment Queue: ownerless (imported) applications have no employer account.
    if (owner === "unassigned") query = query.is("employer_id", null)
    else if (owner === "employer") query = query.not("employer_id", "is", null)
    // When searching, scan a bounded window then filter; otherwise page in the DB.
    if (!q) query = query.range(offset, offset + limit - 1)
    else query = query.limit(ADMIN_LIST_MAX_LIMIT)
    const { data, error, count } = await query
    if (error) return dbError(error.message)
    let rows = (data || []) as Record<string, unknown>[]
    if (q) {
      const needle = q.toLowerCase()
      rows = rows.filter((r) => {
        const c = r.candidates as { first_name?: string; last_name?: string; users?: { email?: string } } | null
        const j = r.jobs as { title?: string } | null
        const e = r.employers as { company_name?: string } | null
        return matches(r, [c?.first_name, c?.last_name, c?.users?.email, j?.title, e?.company_name], needle)
      })
      return NextResponse.json({ data: rows.slice(offset, offset + limit), total: rows.length, limit, offset })
    }
    return NextResponse.json({ data: rows, total: count ?? rows.length, limit, offset })
  }

  if (route === "stats") {
    const stats = await getAdminStats()
    return NextResponse.json(stats)
  }

  if (route === "trend") {
    const { getAdminTrendData } = await import("@/lib/services/adminAnalytics")
    const data = await getAdminTrendData()
    return NextResponse.json({ data })
  }

  // Per-job application counts. Bounded: pass ?jobIds=uuid,uuid (the visible
  // page) for an exact `.in(...)` tally; otherwise counts are computed over a
  // bounded window of the most recent applications (never a full-table scan).
  if (route === "application-counts") {
    const jobIds = parseJobIds(get("jobIds"))
    let query = supabaseAdmin.from("applications").select("job_id")
    if (jobIds) query = query.in("job_id", jobIds)
    else query = query.order("applied_at", { ascending: false }).limit(ADMIN_LIST_MAX_LIMIT)
    const { data, error } = await query
    if (error) return dbError(error.message)
    const counts: Record<string, number> = {}
    for (const r of (data || []) as { job_id: string | null }[]) {
      if (r.job_id) counts[r.job_id] = (counts[r.job_id] || 0) + 1
    }
    return NextResponse.json({ data: counts, bounded: !jobIds })
  }

  if (route === "pending-jobs") {
    const { data, error } = await supabaseAdmin
      .from("jobs")
      .select("*")
      .eq("status", "pending")
      .order("posted_at", { ascending: false })
    if (error) return dbError(error.message)
    return NextResponse.json({ data: data || [] })
  }

  if (route === "jobs") {
    const board = get("board")
    const { limit, offset } = parsePagination(get)
    let query = supabaseAdmin.from("jobs").select("*", { count: "exact" })
    if (board) query = query.eq("board", board)
    const { data, error, count } = await query
      .order("posted_at", { ascending: false })
      .range(offset, offset + limit - 1)
    if (error) return dbError(error.message)
    return NextResponse.json({ data: data || [], total: count ?? 0, limit, offset })
  }

  if (route === "employers") {
    const { limit, offset, q } = parsePagination(get)
    const built = supabaseAdmin
      .from("employers")
      .select("*, users(email, status, created_at)", { count: "exact" })
      .order("created_at", { ascending: false })
    const { data, error, count } = q
      ? await built.limit(ADMIN_LIST_MAX_LIMIT)
      : await built.range(offset, offset + limit - 1)
    if (error) return dbError(error.message)
    let rows = (data || []) as Record<string, unknown>[]
    if (q) {
      const needle = q.toLowerCase()
      rows = rows.filter((r) => {
        const u = r.users as { email?: string } | null
        return matches(r, [r.company_name as string, u?.email], needle)
      })
      return NextResponse.json({ data: rows.slice(offset, offset + limit), total: rows.length, limit, offset })
    }
    return NextResponse.json({ data: rows, total: count ?? rows.length, limit, offset })
  }

  if (route === "candidates") {
    const { limit, offset, q } = parsePagination(get)
    const { getEnrichedCandidates } = await import("@/lib/services/candidateAdminService")
    const res = await getEnrichedCandidates({ limit, offset, q })
    if (res.error) return dbError(res.error)
    return NextResponse.json({ data: res.data, total: res.total, limit, offset })
  }

  if (route === "messages") {
    const status = get("status")
    const { limit, offset } = parsePagination(get)
    let query = supabaseAdmin
      .from("contact_messages")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
    if (status && status !== "all") query = query.eq("status", status)
    const { data, error, count } = await query.range(offset, offset + limit - 1)
    if (error) return dbError(error.message)
    return NextResponse.json({ data: data || [], total: count ?? 0, limit, offset })
  }

  if (route === "settings") {
    const { getAdminSettings } = await import("@/lib/services/siteContentService")
    return NextResponse.json({ data: await getAdminSettings() })
  }

  if (route === "content") {
    const { getSiteContent } = await import("@/lib/services/siteContentService")
    return NextResponse.json({ data: await getSiteContent() })
  }

  if (route === "govt-jobs") {
    const { data, error } = await supabaseAdmin.from("govt_jobs").select("*").order("sort_order")
    if (error) return dbError(error.message)
    return NextResponse.json({ data: data || [] })
  }

  if (route === "abroad-jobs") {
    const { data, error } = await supabaseAdmin.from("abroad_jobs").select("*").order("posted_at", { ascending: false })
    if (error) return dbError(error.message)
    return NextResponse.json({ data: data || [] })
  }

  // Single job for the admin edit form: GET /api/admin/jobs/{id}
  if (p?.[0] === "jobs" && p?.[1]) {
    const { data, error } = await supabaseAdmin.from("jobs").select("*").eq("id", p[1]).single()
    if (error || !data) return NextResponse.json({ error: "Job not found" }, { status: 404 })
    return NextResponse.json({ data })
  }

  // Employer detail + stats: GET /api/admin/employers/{id}
  if (p?.[0] === "employers" && p?.[1] && !p?.[2]) {
    const eid = p[1]
    const { data: emp, error } = await supabaseAdmin
      .from("employers")
      .select("*, users(email, status, created_at)")
      .eq("id", eid)
      .single()
    if (error || !emp) return NextResponse.json({ error: "Employer not found" }, { status: 404 })
    const [jobsCount, appsCount, apps] = await Promise.all([
      supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }).eq("employer_id", eid),
      supabaseAdmin.from("applications").select("id", { count: "exact", head: true }).eq("employer_id", eid),
      supabaseAdmin.from("applications").select("candidate_id").eq("employer_id", eid),
    ])
    const candidateCount = new Set((apps.data || []).map((a) => (a as { candidate_id: string }).candidate_id)).size
    return NextResponse.json({
      data: emp,
      stats: { jobs: jobsCount.count || 0, applications: appsCount.count || 0, candidates: candidateCount },
    })
  }

  return notFound()
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error
  const { params: p } = await params
  const route = p?.join("/") || ""

  if (route.includes("/approve")) {
    const id = p?.[0]
    if (!isUuid(id)) return NextResponse.json({ error: "Valid job id required" }, { status: 400 })
    const result = await approveJob(id)
    if (result?.error) return dbError(result.error.message)
    return NextResponse.json({ success: true })
  }

  if (route.includes("/reject")) {
    const id = p?.[0]
    if (!isUuid(id)) return NextResponse.json({ error: "Valid job id required" }, { status: 400 })
    const result = await rejectJob(id)
    if (result?.error) return dbError(result.error.message)
    return NextResponse.json({ success: true })
  }

  if (route === "jobs") {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid job body" }, { status: 400 })
    }
    if (typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "Job title is required" }, { status: 400 })
    }
    // Respect the requested status (draft → pending, publish → active, close → closed).
    const ALLOWED = new Set(["active", "pending", "closed"])
    const status = ALLOWED.has(body.status) ? body.status : "active"
    // Provenance is decided server-side from evidence, never trusted from the
    // body: an admin-curated job is CURATED only when it captures an explicit
    // source AND a real apply URL; otherwise it stays UNCLASSIFIED (fail closed).
    const source = typeof body.source === "string" ? body.source.trim() : ""
    const applyUrl = body.apply_url ?? body.applyUrl
    const provenance = source && hasRealApplyUrl(applyUrl) ? "CURATED" : "UNCLASSIFIED"
    const { data, error } = await supabaseAdmin
      .from("jobs")
      .insert({ ...body, status, provenance })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ data })
  }

  if (route === "reset") {
    // Safety: only truncate non-essential tables
    const { error } = await supabaseAdmin
      .from("contact_messages")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000")
    if (error) return dbError(error.message)
    return NextResponse.json({ success: true, message: "Reset complete" })
  }

  return notFound()
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error
  const { params: p } = await params
  const route = p?.join("/") || ""
  const body = await req.json().catch(() => null)

  if (route === "content" || route === "settings") {
    const v = validateKeyValueBody(body)
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
    const svc = await import("@/lib/services/siteContentService")
    const write = route === "content" ? svc.updateSiteContent : svc.updateAdminSetting
    for (const [key, value] of v.entries) {
      const res = await write(key, value)
      if (res.error) return dbError(res.error.message)
    }
    return NextResponse.json({ success: true, updated: v.entries.length })
  }

  if (route.startsWith("jobs/")) {
    const id = p?.[1]
    if (!isUuid(id)) return NextResponse.json({ error: "Valid job id required" }, { status: 400 })
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid job body" }, { status: 400 })
    }
    const { error } = await supabaseAdmin.from("jobs").update(body).eq("id", id)
    if (error) return dbError(error.message)
    return NextResponse.json({ success: true })
  }

  return notFound()
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error
  const { params: p } = await params
  const body = await req.json().catch(() => ({}))

  if (p?.[0] === "employers" && p?.[2] === "status") {
    if (!isUuid(p[1])) return NextResponse.json({ error: "Valid employer id required" }, { status: 400 })
    const result = await toggleEmployerStatus(p[1], body.currentStatus)
    if (result?.error) return dbError(result.error.message)
    return NextResponse.json({ success: true })
  }

  if (p?.[0] === "candidates" && p?.[2] === "status") {
    if (!isUuid(p[1])) return NextResponse.json({ error: "Valid candidate id required" }, { status: 400 })
    const { toggleCandidateStatus } = await import("@/lib/services/adminService")
    const result = await toggleCandidateStatus(p[1], body.currentStatus)
    if (result?.error) return dbError(result.error.message)
    return NextResponse.json({ success: true })
  }

  if (p?.[0] === "employers" && p?.[2] === "verify") {
    if (!isUuid(p[1])) return NextResponse.json({ error: "Valid employer id required" }, { status: 400 })
    const { verifyEmployer } = await import("@/lib/services/adminService")
    const result = await verifyEmployer(p[1])
    if (result?.error) return dbError(result.error.message)
    return NextResponse.json({ success: true })
  }

  // Mark a contact message read: PATCH /api/admin/messages/{id}/read
  if (p?.[0] === "messages" && p?.[1] && p?.[2] === "read") {
    if (!isUuid(p[1])) return NextResponse.json({ error: "Valid message id required" }, { status: 400 })
    const { error } = await supabaseAdmin
      .from("contact_messages")
      .update({ status: "read" })
      .eq("id", p[1])
      .neq("status", "replied")
    if (error) return dbError(error.message)
    return NextResponse.json({ success: true })
  }

  return notFound()
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error
  const { params: p } = await params
  if (p?.[0] === "jobs" && p?.[1]) {
    if (!isUuid(p[1])) return NextResponse.json({ error: "Valid job id required" }, { status: 400 })
    const { error } = await supabaseAdmin.from("jobs").delete().eq("id", p[1])
    if (error) return dbError(error.message)
    return NextResponse.json({ success: true })
  }
  return notFound()
}
