import { getGovtCoverageReport } from "@/lib/services/govtCoverage"
import { getGovtIngestMetrics } from "@/lib/services/govtAutoUpdate"

export const dynamic = "force-dynamic"

function fmt(n: number) {
  return n.toLocaleString("en-IN")
}
function ago(iso: string | null) {
  if (!iso) return "never"
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  return `${Math.round(hrs / 24)} d ago`
}

const cardStyle: React.CSSProperties = { background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: 18 }
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".03em" }
const bigNum: React.CSSProperties = { fontSize: 30, fontWeight: 900, color: "#0d1f4e", lineHeight: 1.1, marginTop: 6 }

export default async function AdminGovtJobsPage() {
  const [report, metrics] = await Promise.all([
    getGovtCoverageReport().catch(() => null),
    getGovtIngestMetrics().catch(() => null),
  ])

  return (
    <div>
      <h1 style={{ fontFamily: "Playfair Display,serif", fontWeight: 900, color: "#0d1f4e", fontSize: 26, marginBottom: 6 }}>
        🏛️ Govt Jobs Monitoring
      </h1>
      <p style={{ color: "#64748b", fontSize: 13.5, marginBottom: 22 }}>
        Live coverage of the government-jobs ingestion pipeline. Use this to track which states have real data and what needs re-ingesting.
      </p>

      {/* Summary stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 20 }}>
        <div style={cardStyle}>
          <div style={labelStyle}>Active jobs</div>
          <div style={bigNum}>{fmt(report?.totalActive ?? 0)}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>National (All-India)</div>
          <div style={bigNum}>{fmt(report?.nationalJobs ?? 0)}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>State-specific</div>
          <div style={bigNum}>{fmt(report?.stateJobs ?? 0)}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>States covered</div>
          <div style={bigNum}>{fmt(report?.statesCovered ?? 0)}<span style={{ fontSize: 15, color: "#94a3b8", fontWeight: 700 }}> / {fmt((report?.statesCovered ?? 0) + (report?.statesEmpty ?? 0))}</span></div>
        </div>
        <div style={{ ...cardStyle, borderColor: (report?.misTagged ?? 0) > 0 ? "#fca5a5" : "#e2e8f0" }}>
          <div style={labelStyle}>Missing state_slug</div>
          <div style={{ ...bigNum, color: (report?.misTagged ?? 0) > 0 ? "#dc2626" : "#0d1f4e" }}>{fmt(report?.misTagged ?? 0)}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>real state name, not normalised</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Expiring ≤ 30 days</div>
          <div style={{ ...bigNum, color: (report?.expiringSoon.length ?? 0) > 0 ? "#d97706" : "#0d1f4e" }}>{fmt(report?.expiringSoon.length ?? 0)}</div>
        </div>
      </div>

      {/* Ingestion health */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ fontWeight: 800, color: "#0d1f4e", fontSize: 15, marginBottom: 12 }}>Ingestion health</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, fontSize: 13.5, color: "#374151" }}>
          <span>Last sync: <strong>{ago(metrics?.lastSync ?? null)}</strong></span>
          <span>Added today: <strong>{fmt(metrics?.addedToday ?? 0)}</strong></span>
          <span>Expired (total): <strong>{fmt(metrics?.expiredJobs ?? 0)}</strong></span>
          <span>Sources configured: <strong>{fmt(metrics?.sourcesChecked ?? 0)}</strong></span>
          <span style={{ color: (metrics?.failedSources.length ?? 0) > 0 ? "#dc2626" : "#16a34a" }}>
            {(metrics?.failedSources.length ?? 0) > 0 ? `⚠ ${metrics?.failedSources.join(", ")}` : "✓ last run clean"}
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* State-wise coverage */}
        <div style={cardStyle}>
          <div style={{ fontWeight: 800, color: "#0d1f4e", fontSize: 15, marginBottom: 4 }}>State-wise coverage</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
            {report?.statesCovered ?? 0} of {(report?.statesCovered ?? 0) + (report?.statesEmpty ?? 0)} states have at least one state-specific recruitment.
          </div>
          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <tbody>
                {(report?.perState ?? []).map(s => (
                  <tr key={s.slug} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "7px 4px", color: "#374151" }}>{s.label}</td>
                    <td style={{ padding: "7px 4px", textAlign: "right", fontWeight: 800, color: s.jobs > 0 ? "#16a34a" : "#cbd5e1" }}>{fmt(s.jobs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expiring soon */}
        <div style={cardStyle}>
          <div style={{ fontWeight: 800, color: "#0d1f4e", fontSize: 15, marginBottom: 12 }}>Expiring in next 30 days</div>
          {(report?.expiringSoon.length ?? 0) === 0 ? (
            <div style={{ color: "#94a3b8", fontSize: 13, padding: "20px 0", textAlign: "center" }}>No active jobs closing in the next 30 days.</div>
          ) : (
            <div style={{ maxHeight: 420, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <tbody>
                  {(report?.expiringSoon ?? []).map(j => (
                    <tr key={j.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "7px 4px", color: "#374151" }}>
                        <div style={{ fontWeight: 600 }}>{j.title.length > 60 ? j.title.slice(0, 58) + "…" : j.title}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{j.state} · closes {j.lastDate}</div>
                      </td>
                      <td style={{ padding: "7px 4px", textAlign: "right", whiteSpace: "nowrap", fontWeight: 800, color: j.daysLeft <= 3 ? "#dc2626" : j.daysLeft <= 7 ? "#d97706" : "#64748b" }}>
                        {j.daysLeft === 0 ? "today" : `${j.daysLeft}d`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
