"use client"
import { useState, useEffect } from "react"

export type EmployerStats = {
  activeJobs: number
  applications: number
  shortlisted: number
  interviews: number
  hired: number
}

export function useEmployerStats() {
  const [stats, setStats] = useState<EmployerStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/employer/dashboard")
      .then(r => (r.ok ? r.json() : null))
      .then(d => setStats(d))
      .finally(() => setLoading(false))
  }, [])

  return { stats, loading }
}
