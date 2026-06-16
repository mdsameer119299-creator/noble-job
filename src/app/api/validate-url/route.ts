import { NextRequest, NextResponse } from "next/server"
import { rateLimit } from "@/lib/utils/rateLimit"
import { validateUrlShape, probeUrl } from "@/lib/utils/urlHealth"

export const dynamic = "force-dynamic"

type CacheEntry = { ok: boolean; status: number | null; at: number }
const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 min — avoid re-probing the same URL repeatedly

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  const { success } = rateLimit(`validate-url:${ip}`, 30, 60_000)
  if (!success) return NextResponse.json({ ok: false, reason: "rate_limited" }, { status: 429 })

  const raw = req.nextUrl.searchParams.get("url") || ""
  const parsed = validateUrlShape(raw)
  if (!parsed) return NextResponse.json({ ok: false, reason: "invalid" })

  const key = parsed.toString()
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json({ ok: cached.ok, status: cached.status, cached: true })
  }

  const result = await probeUrl(key)
  cache.set(key, { ...result, at: Date.now() })
  return NextResponse.json({ ok: result.ok, status: result.status })
}
