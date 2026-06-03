import type { GovtContentItem } from "@/types/govtJob"
import { resolveGovtJobLinks } from "@/lib/services/govtOfficialLinks"

export function GovtContentCard({ item }: { item: GovtContentItem }) {
  const fallbackLink = resolveGovtJobLinks({ org: item.org, short: item.org, title: item.title }).officialUrl
  const href = item.link?.startsWith("http") ? item.link : fallbackLink
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", padding: "16px 18px", display: "flex", gap: 14, alignItems: "center", boxShadow: "0 2px 10px rgba(24,71,212,.05)" }}>
      <div style={{ width: 46, height: 46, borderRadius: 10, background: item.color || "#1847d4", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12, flexShrink: 0 }}>{item.org.slice(0, 4)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontWeight: 800, color: "#0d1f4e", fontSize: 14.5 }}>{item.title}</div>
          {item.badge && <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 800, border: "1px solid #86efac" }}>{item.badge}</span>}
        </div>
        <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 2 }}>{item.examName} · {item.org} · {item.date}</div>
      </div>
      <a href={href} target="_blank" rel="noopener noreferrer" style={{ background: "#1847d4", color: "#fff", padding: "8px 16px", borderRadius: 8, fontWeight: 800, fontSize: 12.5, textDecoration: "none", flexShrink: 0 }}>Open →</a>
    </div>
  )
}
