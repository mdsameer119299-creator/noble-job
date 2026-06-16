import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { validateUrlShape, probeUrl } from "@/lib/utils/urlHealth"
import { alertAdmins } from "@/lib/services/adminNotifyService"

/**
 * Periodic health check for stored external application links.
 *
 * Validates apply_url on DB-backed job rows and marks dead ones inactive
 * (status='closed') so they drop out of public listings (which filter
 * status='active'). Notifies admins with a summary when links are disabled.
 *
 * Schedule like the govt-jobs cron:
 *   GET /api/cron/validate-apply-urls   Authorization: Bearer <CRON_SECRET>
 *
 * NOTE: production serves most listings from local inventory, so the primary
 * candidate-facing protection is the per-click /api/validate-url guard in
 * ApplyButton. This sweep covers links that live in the database.
 */
export const dynamic = "force-dynamic"

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== "production" // fail closed in prod
  return (req.headers.get("authorization") || "") === `Bearer ${secret}`
}

const TABLES = ["jobs", "wfh_jobs", "abroad_jobs", "govt_jobs"] as const
const MAX_PER_TABLE = 200

type Broken = { table: string; id: string; url: string }

async function sweepTable(table: string): Promise<{ checked: number; broken: Broken[] }> {
  const broken: Broken[] = []
  // Table name is dynamic across several job tables not all present in the
  // generated Database types; cast to decouple from codegen.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from(table)
    .select("id, apply_url")
    .eq("status", "active")
    .not("apply_url", "is", null)
    .limit(MAX_PER_TABLE)
  if (error || !data) return { checked: 0, broken }

  for (const row of data as { id: string; apply_url: string | null }[]) {
    const parsed = validateUrlShape(row.apply_url)
    if (!parsed) {
      broken.push({ table, id: String(row.id), url: row.apply_url || "" })
      continue
    }
    const { ok } = await probeUrl(parsed.toString())
    if (!ok) broken.push({ table, id: String(row.id), url: parsed.toString() })
  }
  return { checked: data.length, broken }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, skipped: "not configured" })

  let checked = 0
  const allBroken: Broken[] = []
  try {
    for (const table of TABLES) {
      const r = await sweepTable(table)
      checked += r.checked
      allBroken.push(...r.broken)
    }

    // Disable broken links so they leave public listings.
    for (const b of allBroken) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin as any).from(b.table).update({ status: "closed" }).eq("id", b.id)
    }

    if (allBroken.length > 0) {
      const summary = allBroken
        .slice(0, 20)
        .map((b) => `• ${b.table}/${b.id} — ${b.url}`)
        .join("<br>")
      await alertAdmins({
        type: "broken_apply_links",
        title: "Broken application links disabled",
        message: `${allBroken.length} job(s) had unreachable application links and were marked inactive.`,
        email: true,
        emailHtml: `<p style="color:#374151">${allBroken.length} job(s) had unreachable application links and were marked inactive (status=closed).</p><p style="color:#6b7280;font-size:13px">${summary}</p>`,
      })
    }

    return NextResponse.json({ ok: true, checked, disabled: allBroken.length })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
