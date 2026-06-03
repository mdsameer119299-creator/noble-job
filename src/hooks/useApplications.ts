"use client"
import { useState, useEffect } from "react"
import type { Application } from "@/types/application"

export function useApplications(filter?: { status?: string; jobId?: string }) {
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams(filter as Record<string,string>)
    fetch(`/api/applications?${params}`)
      .then(r => r.json()).then(d => setApps(d.data || []))
      .finally(() => setLoading(false))
  }, [filter?.status, filter?.jobId])
  return { apps, loading }
}
