'use client'
import { StatCards } from './StatCards'
import { useEmployerStats } from '@/hooks/useEmployerStats'

export function EmployerDashboardStats() {
  const { stats, loading } = useEmployerStats()
  if (loading) {
    return (
      <div style={{ marginBottom: 24, color: '#6b7280', fontSize: 13 }}>Loading stats…</div>
    )
  }
  return <StatCards stats={stats} />
}
