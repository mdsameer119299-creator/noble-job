import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import type { ServerSupabaseClient } from "@/lib/supabase/server"
import {
  RESUME_BUCKET,
  resumeObjectPath,
  resolveResumeSignedUrl,
} from "@/lib/storage/resumeStorage"

/** Upload resume; returns storage object path (not a public URL). */
export async function uploadResume(candidateId: string, file: File): Promise<string> {
  const sb = createClient()
  if (!sb) throw new Error("Storage unavailable until Supabase is configured")
  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf"
  const path = resumeObjectPath(candidateId, ext)
  const { error } = await sb.storage.from(RESUME_BUCKET).upload(path, file, { upsert: true })
  if (error) throw error
  return path
}

/** Signed URL for the candidate's own resume (browser client). */
export async function getResumeUrl(
  candidateId: string,
  storedPathOrUrl?: string | null
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const sb = createClient()
  if (!sb) return null
  return resolveResumeSignedUrl(sb, candidateId, storedPathOrUrl)
}

export async function getResumeUrlWithClient(
  sb: ServerSupabaseClient,
  candidateId: string,
  storedPathOrUrl?: string | null
): Promise<string | null> {
  return resolveResumeSignedUrl(sb, candidateId, storedPathOrUrl)
}

export async function uploadLogo(employerId: string, file: File): Promise<string> {
  const sb = createClient()
  if (!sb) throw new Error("Storage unavailable until Supabase is configured")
  const ext = file.name.split(".").pop()
  const path = `${employerId}/logo.${ext}`
  const { error } = await sb.storage.from("company-logos").upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = sb.storage.from("company-logos").getPublicUrl(path)
  return data.publicUrl
}
