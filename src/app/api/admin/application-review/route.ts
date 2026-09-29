import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { requireAdminApi } from "@/lib/auth/verifyAdminApi"
import { createNotification } from "@/lib/services/notificationService"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error

  const body = await req.json().catch(() => null) as { applicationId?: string; action?: string } | null
  const applicationId = body?.applicationId || ""
  const action = body?.action || ""
  if (!UUID_RE.test(applicationId)) return NextResponse.json({ error: "Valid application id required" }, { status: 400 })
  if (action !== "approve" && action !== "reject") return NextResponse.json({ error: "Action must be approve or reject" }, { status: 400 })

  const { data: application, error: appError } = await supabaseAdmin
    .from("applications")
    .select("id, employer_id, candidate_id, board, status, admin_review_status, notes, employers(company_name, user_id)")
    .eq("id", applicationId)
    .single()
  if (appError || !application) return NextResponse.json({ error: "Application not found" }, { status: 404 })

  const current = (application as { admin_review_status?: string }).admin_review_status || "pending_review"
  if (current !== "pending_review") {
    return NextResponse.json({ error: `Application is already ${current}` }, { status: 409 })
  }

  const next = action === "approve" ? "approved" : "rejected"
  const { error: updateError } = await supabaseAdmin
    .from("applications")
    .update({
      admin_review_status: next,
      admin_reviewed_at: new Date().toISOString(),
      admin_reviewed_by: auth.user?.id ?? null,
    })
    .eq("id", applicationId)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  const employer = (application as { employers?: { user_id?: string; company_name?: string } | null }).employers
  if (next === "approved" && employer?.user_id) {
    await createNotification(
      employer.user_id,
      "application",
      "New approved application",
      `Noble Job approved a candidate application for ${employer.company_name || "your job"}. The candidate and resume are now available in your employer dashboard.`
    )
  }

  return NextResponse.json({ success: true, adminReviewStatus: next })
}
