import { NextRequest, NextResponse } from "next/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { requireAdminApi } from "@/lib/auth/verifyAdminApi"
import { setJobStatus } from "@/lib/services/adminService"
import type { JobStatus } from "@/types/job"

const VALID: JobStatus[] = ["LIVE_JOB", "VERIFIED_JOB", "ARCHIVED_JOB"]

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error

  try {
    const { id, jobStatus } = await req.json()
    if (!id || !VALID.includes(jobStatus)) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 })
    }
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ ok: true, persisted: false })
    }
    const { error } = await setJobStatus(id, jobStatus)
    return NextResponse.json({ ok: !error, persisted: !error, error: error?.message })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
