import Link from "next/link"

interface GovtPaginationProps {
  basePath: string
  page: number
  totalPages: number
  /** Current query params (excluding page) to preserve across pages. */
  query: Record<string, string | undefined>
}

function buildHref(basePath: string, query: Record<string, string | undefined>, page: number) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) if (v && k !== "page") p.set(k, v)
  if (page > 1) p.set("page", String(page))
  const qs = p.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

export function GovtPagination({ basePath, page, totalPages, query }: GovtPaginationProps) {
  if (totalPages <= 1) return null
  const linkStyle: React.CSSProperties = { padding: "8px 14px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "#fff", color: "#1847d4", fontWeight: 700, fontSize: 13, textDecoration: "none" }
  const disabledStyle: React.CSSProperties = { ...linkStyle, color: "#cbd5e1", pointerEvents: "none" }
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 24 }}>
      <Link href={buildHref(basePath, query, page - 1)} style={page <= 1 ? disabledStyle : linkStyle} aria-disabled={page <= 1}>← Prev</Link>
      <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>Page {page} of {totalPages}</span>
      <Link href={buildHref(basePath, query, page + 1)} style={page >= totalPages ? disabledStyle : linkStyle} aria-disabled={page >= totalPages}>Next →</Link>
    </div>
  )
}
