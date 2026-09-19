"use client"
import { useState, useEffect } from "react"
import type { WfhJob } from "@/types/wfhJob"
import { toRenderableWfhJobs } from "@/lib/jobs/clientRecords"

export function useWfhJobs(query = "", cat = "all", exp = "all", sort = "latest") {
  const [jobs, setJobs] = useState<WfhJob[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ q: query, cat, exp, sort })
    fetch(`/api/wfh-jobs?${params}`)
      .then(r => (r.ok ? r.json() : { data: [] }))
      .then(d => setJobs(toRenderableWfhJobs(d.data)))
      .catch(() => setJobs([]))
      .finally(() => setLoading(false))
  }, [query, cat, exp, sort])
  return { jobs, loading }
}
