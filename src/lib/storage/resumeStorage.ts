import type { BrowserSupabaseClient } from "@/lib/supabase/client"
import type { ServerSupabaseClient } from "@/lib/supabase/server"

export type ResumeStorageClient = BrowserSupabaseClient | ServerSupabaseClient

export const RESUME_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET_RESUMES?.trim() || "resumes"

export const RESUME_SIGNED_URL_TTL_SEC = 3600

const RESUME_EXT = ["pdf", "doc", "docx"] as const

export function resumeObjectPath(candidateId: string, ext: string): string {
  return `${candidateId}/resume.${ext}`
}

/** Normalize DB value: storage path, or legacy public/signed URL → object path */
export function normalizeResumeStoragePath(
  stored: string | null | undefined,
  candidateId: string
): string | null {
  if (!stored?.trim()) return null
  const value = stored.trim()

  const publicMarker = `/storage/v1/object/public/${RESUME_BUCKET}/`
  const signedMarker = `/storage/v1/object/sign/${RESUME_BUCKET}/`
  if (value.includes(publicMarker)) {
    return value.split(publicMarker)[1]?.split("?")[0] ?? null
  }
  if (value.includes(signedMarker)) {
    return value.split(signedMarker)[1]?.split("?")[0] ?? null
  }

  const ownPath = new RegExp(
    `^${candidateId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/resume\\.(pdf|doc|docx)$`,
    "i"
  )
  if (ownPath.test(value)) return value

  return null
}

export async function discoverResumeObjectPath(
  sb: ResumeStorageClient,
  candidateId: string
): Promise<string | null> {
  for (const ext of RESUME_EXT) {
    const path = resumeObjectPath(candidateId, ext)
    const { data, error } = await sb.storage
      .from(RESUME_BUCKET)
      .createSignedUrl(path, 60)
    if (!error && data?.signedUrl) return path
  }
  return null
}

export async function createResumeSignedUrl(
  sb: ResumeStorageClient,
  path: string,
  expiresIn = RESUME_SIGNED_URL_TTL_SEC
): Promise<string | null> {
  const { data, error } = await sb.storage
    .from(RESUME_BUCKET)
    .createSignedUrl(path, expiresIn)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

export async function resolveResumeSignedUrl(
  sb: ResumeStorageClient,
  candidateId: string,
  storedPathOrUrl: string | null | undefined
): Promise<string | null> {
  const path =
    normalizeResumeStoragePath(storedPathOrUrl, candidateId) ??
    (await discoverResumeObjectPath(sb, candidateId))
  if (!path) return null
  return createResumeSignedUrl(sb, path)
}
