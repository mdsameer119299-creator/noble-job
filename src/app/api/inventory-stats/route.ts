import { NextResponse } from "next/server"
import {
  getPrivateInventoryCounts,
  getWfhInventoryCounts,
  getAbroadInventoryCounts,
  getAbroadCountryCounts,
  getMarketplaceTotals,
  getGenuineTotals,
} from "@/lib/data/jobInventory"

export const dynamic = "force-dynamic"

/**
 * Lightweight counts for heroes/stats (no full job payloads).
 *  • `catalog` = full browsable inventory incl. demo showcase content
 *    ("roles to explore" — NOT a genuine-openings claim).
 *  • `genuine` = only rows that pass the publication gate (real provenance).
 */
export async function GET() {
  return NextResponse.json({
    catalog: getMarketplaceTotals(),
    genuine: getGenuineTotals(),
    private: getPrivateInventoryCounts(),
    wfh: getWfhInventoryCounts(),
    abroad: getAbroadInventoryCounts(),
    countries: getAbroadCountryCounts(),
  })
}
