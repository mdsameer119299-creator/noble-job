import { WFH_CATEGORY_LIST } from "@/lib/data/jobInventory"
import { getWfhVisibleCounts } from "@/lib/services/visibleCounts"
import { getGenuineJobCounts } from "@/lib/services/genuineCounts"
import { formatCounter } from "@/lib/config/jobStrategy"

/**
 * WFH stats strip. Counts come from the list pipeline (renderable only, synthetic switch
 * honoured); "Live Remote" is the GENUINE live count and is omitted when there is none.
 */
export async function WfhStatsHero() {
  const [c, genuine] = await Promise.all([
    getWfhVisibleCounts(),
    getGenuineJobCounts({ govt: false }).then(g => g.wfh).catch(() => 0),
  ])
  const stats = [
    { num: formatCounter(c.all), label: "WFH Roles to Explore", icon: "💼" },
    { num: String(WFH_CATEGORY_LIST.length), label: "Categories", icon: "📂" },
    ...(genuine > 0 ? [{ num: formatCounter(genuine), label: "Live Remote", icon: "🟢" }] : []),
  ]
  return (
    <div style={{ background: "#fff", borderBottom: "2px solid #f0f4ff", padding: "14px 0" }}>
      <div className="wrap" style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 8 }}>
        {stats.map((s, i) => (
          <div key={i} style={{ textAlign: "center", padding: "6px 20px" }}>
            <div style={{ fontSize: 20, marginBottom: 2 }}>{s.icon}</div>
            <div style={{ fontFamily: "Playfair Display,serif", fontSize: 22, fontWeight: 900, color: "#7c3aed" }}>{s.num}</div>
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
