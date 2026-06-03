import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { requireAdminApi } from "@/lib/auth/verifyAdminApi"
import { getAdminStats, approveJob, rejectJob, toggleEmployerStatus } from "@/lib/services/adminService"

export async function GET(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error
  const { params: p } = await params
  const route = p?.join("/") || "stats"

  if (route === "stats") {
    const stats = await getAdminStats()
    return NextResponse.json(stats)
  }

  if (route === "trend") {
    const { getAdminTrendData } = await import("@/lib/services/adminAnalytics")
    const data = await getAdminTrendData()
    return NextResponse.json({ data })
  }

  if (route === "pending-jobs") {
    const { data } = await supabaseAdmin.from("jobs").select("*").eq("status", "pending").order("posted_at", { ascending: false })
    return NextResponse.json({ data: data || [] })
  }

  if (route === "jobs") {
    const board = req.nextUrl.searchParams.get("board")
    let q = supabaseAdmin.from("jobs").select("*")
    if (board) q = q.eq("board", board)
    const { data } = await q.order("posted_at", { ascending: false })
    return NextResponse.json({ data: data || [] })
  }

  if (route === "employers") {
    const { data } = await supabaseAdmin.from("employers").select("*, users(email, status, created_at)").order("created_at", { ascending: false })
    return NextResponse.json({ data: data || [] })
  }

  if (route === "candidates") {
    const { data } = await supabaseAdmin.from("candidates").select("*, users(email, status, created_at)").order("created_at", { ascending: false })
    return NextResponse.json({ data: data || [] })
  }

  if (route === "messages") {
    const { data } = await supabaseAdmin.from("contact_messages").select("*").order("created_at", { ascending: false })
    return NextResponse.json({ data: data || [] })
  }

  if (route === "govt-jobs") {
    const { data } = await supabaseAdmin.from("govt_jobs").select("*").order("sort_order")
    return NextResponse.json({ data: data || [] })
  }

  if (route === "abroad-jobs") {
    const { data } = await supabaseAdmin.from("abroad_jobs").select("*").order("posted_at", { ascending: false })
    return NextResponse.json({ data: data || [] })
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error
  const { params: p } = await params
  const route = p?.join("/") || ""

  if (route.includes("/approve")) {
    const id = p?.[0]; if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })
    await approveJob(id)
    return NextResponse.json({ success: true })
  }

  if (route.includes("/reject")) {
    const id = p?.[0]; if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })
    await rejectJob(id)
    return NextResponse.json({ success: true })
  }

  if (route === "jobs") {
    const body = await req.json()
    const { data, error } = await supabaseAdmin.from("jobs").insert({ ...body, status: "active" }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ data })
  }

  if (route === "reset") {
    // Safety: only truncate non-essential tables
    await supabaseAdmin.from("contact_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000")
    return NextResponse.json({ success: true, message: "Reset complete" })
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error
  const { params: p } = await params
  const route = p?.join("/") || ""
  const body = await req.json()

  if (route === "content") {
    const { updateSiteContent } = await import("@/lib/services/siteContentService")
    for (const [key, value] of Object.entries(body)) await updateSiteContent(key, value as string)
    return NextResponse.json({ success: true })
  }

  if (route === "settings") {
    const { updateAdminSetting } = await import("@/lib/services/siteContentService")
    for (const [key, value] of Object.entries(body)) await updateAdminSetting(key, String(value))
    return NextResponse.json({ success: true })
  }

  if (route.startsWith("jobs/")) {
    const id = p?.[1]
    const { error } = await supabaseAdmin.from("jobs").update(body).eq("id", id!)
    return NextResponse.json({ success: !error })
  }

  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error
  const { params: p } = await params
  const body = await req.json()

  if (p?.[0] === "employers" && p?.[2] === "status") {
    await toggleEmployerStatus(p[1], body.currentStatus)
    return NextResponse.json({ success: true })
  }

  if (p?.[0] === "candidates" && p?.[2] === "status") {
    const { toggleCandidateStatus } = await import("@/lib/services/adminService")
    await toggleCandidateStatus(p[1], body.currentStatus)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error
  const { params: p } = await params
  if (p?.[0] === "jobs" && p?.[1]) {
    const { error } = await supabaseAdmin.from("jobs").delete().eq("id", p[1])
    return NextResponse.json({ success: !error })
  }
  return NextResponse.json({ success: true })
}
