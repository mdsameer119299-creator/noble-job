import { NextRequest, NextResponse } from "next/server"
import { requireApiSupabase } from "@/lib/supabase/apiHelpers"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  if (!isSupabaseConfigured()) return NextResponse.json({ data: [] })
  const api = await requireApiSupabase()
  if (api.error) return NextResponse.json({ data: [] })
  const sb = api.sb
  const { params: p } = await params
  const id = p?.[0]

  // Single test (with questions) for the runner: GET /api/skill-tests/{id}
  if (id) {
    const { data, error } = await sb
      .from("skill_tests")
      .select("id, title, category, duration_mins, passing_score, questions_json")
      .eq("id", id)
      .single()
    if (error || !data) return NextResponse.json({ error: "Test not found" }, { status: 404 })
    return NextResponse.json({ data })
  }

  const { data } = await sb.from("skill_tests").select("id, title, category, duration_mins, passing_score")
  return NextResponse.json({ data: data || [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
  const api = await requireApiSupabase()
  if (api.error) return api.error
  const sb = api.sb
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { params: p } = await params
  const testId = p?.[0]
  if (!testId) return NextResponse.json({ error: "Test ID required" }, { status: 400 })
  const { answers, score } = await req.json()
  const { data: candidate } = await sb.from("candidates").select("id").eq("user_id", user.id).single()
  const { error } = await sb.from("candidate_test_results").upsert({
    candidate_id: (candidate as { id: string } | null)?.id!, test_id: testId,
    score, passed: score >= 70, taken_at: new Date().toISOString()
  }, { onConflict: "candidate_id,test_id" })
  return NextResponse.json({ success: !error, score })
}
