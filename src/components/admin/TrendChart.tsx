'use client'
import { useEffect, useState } from 'react'
import type { ChartConfiguration } from 'chart.js'
import { useChart } from '@/hooks/useChart'
import type { TrendPoint } from '@/lib/services/adminAnalytics'

export function TrendChart() {
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/trend')
      .then(r => (r.ok ? r.json() : { data: [] }))
      .then(d => setTrend(d.data || []))
      .finally(() => setLoading(false))
  }, [])

  const config: ChartConfiguration | null = trend.length
    ? {
        type: 'line',
        data: {
          labels: trend.map(t => t.label),
          datasets: [
            {
              label: 'Applications',
              data: trend.map(t => t.applications),
              borderColor: '#1847d4',
              backgroundColor: 'rgba(24,71,212,.1)',
              fill: true,
              tension: 0.3,
            },
            {
              label: 'New jobs',
              data: trend.map(t => t.jobs),
              borderColor: '#f07020',
              backgroundColor: 'rgba(240,112,32,.08)',
              fill: true,
              tension: 0.3,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'bottom' } },
          scales: { y: { beginAtZero: true } },
        },
      }
    : null

  const ref = useChart(config)

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 20, marginBottom: 24 }}>
      <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 16, marginBottom: 16 }}>
        7-day activity
      </h3>
      {loading ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>Loading chart…</p>
      ) : (
        <canvas ref={ref} style={{ maxHeight: 260 }} />
      )}
    </div>
  )
}
