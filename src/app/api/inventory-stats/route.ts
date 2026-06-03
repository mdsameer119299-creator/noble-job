import { NextResponse } from "next/server"
import {
  getPrivateInventoryCounts,
  getWfhInventoryCounts,
  getAbroadInventoryCounts,
  getAbroadCountryCounts,
  getMarketplaceTotals,
} from "@/lib/data/jobInventory"

export const dynamic = "force-dynamic"

/** Lightweight counts for heroes/stats (no full job payloads). */
export async function GET() {
  return NextResponse.json({
    marketplace: getMarketplaceTotals(),
    private: getPrivateInventoryCounts(),
    wfh: getWfhInventoryCounts(),
    abroad: getAbroadInventoryCounts(),
    countries: getAbroadCountryCounts(),
  })
}
