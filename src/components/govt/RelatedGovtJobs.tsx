import Link from "next/link"
import type { GovtJob } from "@/types/govtJob"

interface RelatedGovtJobsProps { title: string; jobs: GovtJob[]; icon?: string }

export function RelatedGovtJobs({ title, jobs, icon = "🔗" }: RelatedGovtJobsProps) {
  if (!jobs.length) return null
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", padding: "18px 16px" }}>
      <h3 style={{ fontWeight: 800, color: "#0d1f4e", fontSize: 14.5, marginBottom: 12 }}>{icon} {title}</h3>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        {jobs.map(j => (
          <li key={j.id}>
            <Link href={`/jobs/govt/${j.slug || j.id}`}
              style={{ display: "block", padding: "8px 10px", borderRadius: 8, color: "#1e3a8a", fontSize: 13, fontWeight: 600, textDecoration: "none", lineHeight: 1.4 }}
              className="hover:bg-[#f0f4ff]">
              <span style={{ color: "#16a34a", marginRight: 6 }}>›</span>{j.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
