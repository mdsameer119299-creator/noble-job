import { getWfhInventoryCounts, WFH_CATEGORY_LIST } from "@/lib/data/jobInventory"
import { formatCounter } from "@/lib/config/jobStrategy"

export function WfhStatsHero() {
  const c = getWfhInventoryCounts()
  const stats = [
    { num: formatCounter(c.all), label: "WFH Jobs", icon: "💼" },
    { num: String(WFH_CATEGORY_LIST.length), label: "Categories", icon: "📂" },
    { num: formatCounter(c.live), label: "Live Remote", icon: "🟢" },
    { num: formatCounter(c.live + c.verified), label: "Active Listings", icon: "✅" },
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
