"use client"

import { useState, useEffect, useRef } from "react"
import type { GovtJob, GovtJobTab } from "@/types/govtJob"

export function useGovtJobs(tab: GovtJobTab = "latest", initialJobs: GovtJob[] = []) {
  const seedRef = useRef(initialJobs)
  const [jobs, setJobs] = useState<GovtJob[]>(initialJobs)
  const [loading, setLoading] = useState(initialJobs.length === 0)
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
        const list = Array.isArray(d?.data) ? d.data : []
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
        setError("Could not refresh jobs. Showing last loaded listings.")
        if (tab === "latest" && seedRef.current.length > 0) {
          setJobs(seedRef.current)
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
