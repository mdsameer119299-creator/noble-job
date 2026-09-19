/**
 * clientRecords.ts — the CLIENT-side half of "NO EMPTY JOBS".
 *
 * The services and API routes already exclude incomplete records, but a browser
 * component must not trust that blindly (a cached response, a stale deploy, a
 * different API). Everything a listing component receives goes through these pure
 * functions, which:
 *   • never invent a value (no `String(undefined)`, no "#", "Competitive", "Recent",
 *     "Full Time", "Any Experience", no `verified ?? true`);
 *   • carry provenance / employer evidence through so cards can label or gate
 *     samples correctly;
 *   • drop every record that is not renderable (see renderable.ts).
 *
 * Pure and dependency-light so the same logic is unit-tested on the server.
 */
import { KNOWN_PROVENANCE, classifyProvenance } from "./provenance"
import { filterRenderable, isUsableLiveJob } from "./renderable"
import type { Job, JobStatus, Provenance } from "@/types/job"
import type { WfhJob } from "@/types/wfhJob"
import type { AbroadJob } from "@/types/abroadJob"
import type { GovtJob } from "@/types/govtJob"

type Raw = Record<string, unknown>

function s(v: unknown): string {
  if (typeof v === "string") return v.trim()
  if (typeof v === "number" && Number.isFinite(v)) return String(v)
  return ""
}

function asRecords(v: unknown): Raw[] {
  return Array.isArray(v) ? v.filter((x): x is Raw => !!x && typeof x === "object") : []
}

function provenanceFor(raw: Raw, board: "private" | "wfh" | "abroad", id: string): Provenance {
  const explicit = s(raw.provenance).toUpperCase()
  if (KNOWN_PROVENANCE.has(explicit)) return explicit as Provenance
  return classifyProvenance({
    id,
    board,
    source: s(raw.source),
    apply_url: s(raw.applyUrl) || s(raw.apply_url),
    employer_id: s(raw.employer_id),
    is_verified: Boolean(raw.is_verified ?? raw.verified),
    job_status: s(raw.jobStatus) || s(raw.job_status),
  })
}

/**
 * A row of the private-jobs API → a `Job`, or `null` when it is not a complete,
 * known-provenance job. Nothing is defaulted.
 */
export function toListingJob(raw: unknown, fallbackStatus?: JobStatus): Job | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Raw
  const id = s(r.id)
  const company = s(r.company)
  const job: Job = {
    ...(r as object),
    id,
    title: s(r.title),
    company,
    logo: s(r.logo) || company.slice(0, 2).toUpperCase(),
    logoUrl: (r.logoUrl as string | null | undefined) ?? null,
    color: s(r.color) || "#1847d4",
    location: s(r.location),
    type: s(r.type) || s(r.job_type),
    exp: s(r.exp) || s(r.experience_required),
    salary: s(r.salary),
    cat: s(r.cat) || s(r.category),
    skills: Array.isArray(r.skills) ? (r.skills as unknown[]).map(s).filter(Boolean) : [],
    badge: s(r.badge) || undefined,
    jobStatus: (s(r.jobStatus) as JobStatus) || fallbackStatus,
    provenance: provenanceFor(r, "private", id),
    employer_id: s(r.employer_id) || undefined,
    applyUrl: s(r.applyUrl) || s(r.apply_url),
    desc: s(r.desc) || s(r.description),
    posted: s(r.posted) || s(r.posted_at),
    verified: Boolean(r.verified ?? r.is_verified),
    source: s(r.source),
    board: "private",
  }
  const [ok] = filterRenderable([job], "private")
  return ok ?? null
}

/** A whole API payload → renderable jobs only (order preserved). */
export function toListingJobs(rows: unknown, fallbackStatus?: JobStatus): Job[] {
  return asRecords(rows)
    .map(r => toListingJob(r, fallbackStatus))
    .filter((j): j is Job => j !== null)
}

/**
 * A live third-party (Himalayas) card → a `Job`, or `null` without a real id, title,
 * company and external application URL. AGGREGATED provenance (it is a third-party
 * posting we link to, never an employer-owned one); no "verified" default.
 */
export function toLiveExternalJob(raw: unknown, fallbackStatus: JobStatus = "LIVE_JOB"): Job | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Raw
  if (!isUsableLiveJob(r)) return null
  const company = s(r.company)
  return {
    id: s(r.id),
    title: s(r.title),
    company,
    logo: s(r.logo) || company.slice(0, 2).toUpperCase(),
    logoUrl: (r.logoUrl as string | null | undefined) ?? null,
    color: s(r.color) || "#1847d4",
    location: s(r.location),
    type: s(r.type),
    exp: s(r.exp),
    salary: s(r.salary),
    cat: s(r.cat) || s(r.category),
    skills: Array.isArray(r.skills) ? (r.skills as unknown[]).map(s).filter(Boolean) : [],
    badge: s(r.badge) || undefined,
    jobStatus: (s(r.jobStatus) as JobStatus) || fallbackStatus,
    provenance: "AGGREGATED",
    applyUrl: s(r.applyUrl) || s(r.apply_url),
    desc: s(r.desc) || s(r.description),
    posted: s(r.posted),
    verified: Boolean(r.verified),
    source: s(r.source),
    board: "private",
  }
}

export function toLiveExternalJobs(rows: unknown, fallbackStatus: JobStatus = "LIVE_JOB"): Job[] {
  return asRecords(rows)
    .map(r => toLiveExternalJob(r, fallbackStatus))
    .filter((j): j is Job => j !== null)
}

/** Raw WFH API rows → renderable WFH jobs only. */
export function toRenderableWfhJobs(rows: unknown): WfhJob[] {
  return filterRenderable(asRecords(rows) as unknown as WfhJob[], "wfh")
}

/** Raw government API rows → renderable govt jobs only (real id, title, organisation, known provenance). */
export function toRenderableGovtJobs(rows: unknown): GovtJob[] {
  return filterRenderable(asRecords(rows) as unknown as GovtJob[] as never[], "govt") as unknown as GovtJob[]
}

/** Raw abroad API rows → renderable abroad jobs only. */
export function toRenderableAbroadJobs(rows: unknown): AbroadJob[] {
  return filterRenderable(asRecords(rows) as unknown as AbroadJob[], "abroad")
}
