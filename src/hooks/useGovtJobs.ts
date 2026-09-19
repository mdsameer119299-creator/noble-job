"use client"

import { useState, useEffect, useRef } from "react"
import type { GovtJob, GovtJobTab } from "@/types/govtJob"
import { toRenderableGovtJobs } from "@/lib/jobs/clientRecords"

export function useGovtJobs(tab: GovtJobTab = "latest", initialJobs: GovtJob[] = []) {
  // Every record — server-provided, API-fetched or seed — passes the same client gate.
  const seedRef = useRef(toRenderableGovtJobs(initialJobs))
  const [jobs, setJobs] = useState<GovtJob[]>(seedRef.current)
  const [loading, setLoading] = useState(seedRef.current.length === 0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/govt-jobs?tab=${encodeURIComponent(tab)}`, { cache: "no-store" })
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => {
        if (cancelled) return
        const list = toRenderableGovtJobs(d?.data)
        if (list.length > 0) {
          setJobs(list)
        } else if (tab === "latest" && seedRef.current.length > 0) {
          setJobs(seedRef.current)
        } else {
          setJobs([])
        }
      })
      .catch(() => {
        if (cancelled) return
        // Never leave another tab's jobs on screen under this tab's heading.
        if (tab === "latest" && seedRef.current.length > 0) {
          setError("Could not refresh jobs. Showing last loaded listings.")
          setJobs(seedRef.current)
        } else {
          setError("Could not load jobs right now.")
          setJobs([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tab])

  return { jobs, loading, error }
}
