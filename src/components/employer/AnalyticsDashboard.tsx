'use client'
import { useEffect, useState } from 'react'
import type { ChartConfiguration } from 'chart.js'
import { useChart } from '@/hooks/useChart'
import type { AnalyticsSummary } from '@/types/analytics'

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/employer/analytics')
      .then(r => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  const funnelConfig: ChartConfiguration | null = data
    ? {
        type: 'bar',
        data: {
          labels: data.funnel.map(f => f.label),
          datasets: [
            {
              label: 'Candidates',
              data: data.funnel.map(f => f.value),
              backgroundColor: ['#1847d4', '#7c3aed', '#f07020', '#15803d'],
            },
          ],
        },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
      }
    : null

  const funnelRef = useChart(funnelConfig)

  if (loading) return <p style={{ color: '#6b7280', fontSize: 13 }}>Loading analytics…</p>
  if (!data) return <p style={{ color: '#6b7280', fontSize: 13 }}>No analytics data yet.</p>

  return (
    <div>
      <div className="grid-resp-3" style={{ display: 'grid', gap: 14, marginBottom: 24 }}>
        <MetricCard label="Conversion rate" value={`${data.conversionRate}%`} />
        <MetricCard label="Time to hire" value={`${data.timeToHireDays} days`} />
        <MetricCard label="Applications" value={String(data.funnel[0]?.value ?? 0)} />
      </div>
      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 20 }}>
        <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 16, marginBottom: 16 }}>
          Hiring funnel
        </h3>
        <canvas ref={funnelRef} style={{ maxHeight: 280 }} />
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 18, textAlign: 'center' }}>
      <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 26, fontWeight: 900, color: '#1847d4' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginTop: 4 }}>{label}</div>
    </div>
  )
}
