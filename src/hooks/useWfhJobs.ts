"use client"
import { useState, useEffect } from "react"
import type { WfhJob } from "@/types/wfhJob"

export function useWfhJobs(query = "", cat = "all", exp = "all", sort = "latest") {
  const [jobs, setJobs] = useState<WfhJob[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ q: query, cat, exp, sort })
    fetch(`/api/wfh-jobs?${params}`)
      .then(r => (r.ok ? r.json() : { data: [] }))
      .then(d => setJobs(d.data || []))
      .catch(() => setJobs([]))
      .finally(() => setLoading(false))
  }, [query, cat, exp, sort])
  return { jobs, loading }
}
