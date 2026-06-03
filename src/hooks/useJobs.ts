"use client"
import { useState, useEffect, useCallback } from "react"
import type { Job, JobFilter } from "@/types/job"
import { useDebounce } from "./useDebounce"

export function useJobs(initialFilter?: JobFilter) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<JobFilter>(initialFilter || {})
  const debouncedFilter = useDebounce(filter, 400)

  const fetchJobs = useCallback(async (f: JobFilter) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (f.q) params.set("q", f.q)
      if (f.category) params.set("category", f.category)
      if (f.location) params.set("location", f.location)
      if (f.page) params.set("page", String(f.page))
      const res = await fetch(`/api/jobs?${params}`)
      const data = await res.json()
      setJobs(data.data || []); setTotal(data.total || 0)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchJobs(debouncedFilter) }, [debouncedFilter, fetchJobs])
  return { jobs, total, loading, filter, setFilter }
}
