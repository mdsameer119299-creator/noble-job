"use client"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { INDIAN_STATES, GOVT_QUALIFICATIONS } from "@/lib/config/govtTaxonomy"

interface GovtFilterBarProps {
  /** Which filters to hide because the page already scopes them. */
  hide?: ("state" | "qualification")[]
  departments: string[]
  experiences: string[]
}

export function GovtFilterBar({ hide = [], departments, experiences }: GovtFilterBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const set = useCallback(
    (key: string, value: string) => {
      const p = new URLSearchParams(params.toString())
      if (value) p.set(key, value); else p.delete(key)
      p.delete("page")
      router.push(`${pathname}?${p}`, { scroll: false })
    },
    [router, pathname, params],
  )

  const selectStyle: React.CSSProperties = { border: "1.5px solid #e2e8f0", borderRadius: 9, padding: "9px 12px", fontSize: 13, color: "#374151", background: "#fff", minWidth: 150 }

  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1.5px solid #e2e8f0", padding: "12px 16px", marginBottom: 18, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <input
        defaultValue={params.get("q") || ""}
        onKeyDown={e => { if (e.key === "Enter") set("q", (e.target as HTMLInputElement).value) }}
        placeholder="Search jobs, department…"
        style={{ flex: 1, minWidth: 180, border: "1.5px solid #e2e8f0", borderRadius: 9, padding: "9px 12px", fontSize: 13, color: "#0d1f4e", outline: "none" }}
      />
      {!hide.includes("state") && (
        <select value={params.get("state") || ""} onChange={e => set("state", e.target.value)} style={selectStyle}>
          <option value="">All States</option>
          {INDIAN_STATES.map(s => <option key={s.slug} value={s.slug}>{s.label}</option>)}
        </select>
      )}
      {!hide.includes("qualification") && (
        <select value={params.get("qualification") || ""} onChange={e => set("qualification", e.target.value)} style={selectStyle}>
          <option value="">All Qualifications</option>
          {GOVT_QUALIFICATIONS.map(q => <option key={q.slug} value={q.slug}>{q.label}</option>)}
        </select>
      )}
      <select value={params.get("department") || ""} onChange={e => set("department", e.target.value)} style={selectStyle}>
        <option value="">All Departments</option>
        {departments.map((d, i) => <option key={`${d}-${i}`} value={d}>{d}</option>)}
      </select>
      <select value={params.get("experience") || ""} onChange={e => set("experience", e.target.value)} style={selectStyle}>
        <option value="">Any Experience</option>
        {experiences.map((x, i) => <option key={`${x}-${i}`} value={x}>{x}</option>)}
      </select>
      <select value={params.get("lastDate") || ""} onChange={e => set("lastDate", e.target.value)} style={selectStyle}>
        <option value="">Last Date: Any</option>
        <option value="open">Open (Not Expired)</option>
      </select>
    </div>
  )
}
