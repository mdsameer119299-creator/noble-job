"use client"
import { useState, useEffect } from "react"
import type { AbroadJob } from "@/types/abroadJob"
import { toRenderableAbroadJobs } from "@/lib/jobs/clientRecords"

export function useAbroadJobs(query = "", country = "", category = "") {
  const [jobs, setJobs] = useState<AbroadJob[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ q: query, country, category })
    fetch(`/api/abroad-jobs?${params}`)
      .then(r => (r.ok ? r.json() : { data: [] }))
      .then(d => setJobs(toRenderableAbroadJobs(d.data)))
      .catch(() => setJobs([]))
      .finally(() => setLoading(false))
  }, [query, country, category])
  return { jobs, loading }
}
