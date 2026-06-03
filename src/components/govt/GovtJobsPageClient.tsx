"use client"

import { useState } from "react"
import type { GovtJob, GovtJobTab } from "@/types/govtJob"
import { GovtTabBar } from "@/components/govt/GovtTabBar"
import { GovtSearchBar } from "@/components/govt/GovtSearchBar"
import { GovtJobsList } from "@/components/govt/GovtJobsList"
import { GovtFilterSidebar } from "@/components/govt/GovtFilterSidebar"
import { GovtAlertForm } from "@/components/govt/GovtAlertForm"
import { AiRecommendations } from "@/components/govt/AiRecommendations"
import { useGovtJobs } from "@/hooks/useGovtJobs"
import "@/styles/govt-nav.css"

interface GovtJobsPageClientProps {
  initialJobs: GovtJob[]
}

export function GovtJobsPageClient({ initialJobs }: GovtJobsPageClientProps) {
  const [tab, setTab] = useState<GovtJobTab>("latest")
  const [q, setQ] = useState("")
  const [state, setState] = useState("")
  const { jobs, loading, error } = useGovtJobs(tab, initialJobs)

  return (
    <div id="govt-jobs">
      <h2
        style={{
          fontFamily: "Playfair Display,serif",
          fontWeight: 900,
          color: "#0d1f4e",
          fontSize: 20,
          margin: "28px 0 14px",
        }}
      >
        Latest Notifications
        {!loading && jobs.length > 0 && (
          <span style={{ fontSize: 14, fontWeight: 600, color: "#64748b", marginLeft: 10 }}>
            ({jobs.length.toLocaleString("en-IN")})
          </span>
        )}
      </h2>

      {error && (
        <p style={{ fontSize: 13, color: "#b45309", background: "#fffbeb", padding: "10px 14px", borderRadius: 10, marginBottom: 12 }}>
          {error}
        </p>
      )}

      <GovtTabBar active={tab} onChange={setTab} />
      <GovtSearchBar q={q} state={state} onQ={setQ} onState={setState} />
      <div className="govt-hub-layout">
        <GovtFilterSidebar state={state} onState={setState} />
        <GovtJobsList jobs={jobs} loading={loading} q={q} />
        <div className="govt-hub-sidebar">
          <AiRecommendations />
          <div id="alert">
            <GovtAlertForm />
          </div>
        </div>
      </div>
    </div>
  )
}
