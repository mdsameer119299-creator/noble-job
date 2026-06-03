'use client'
import { useEffect, useState } from 'react'
import type { ChartConfiguration } from 'chart.js'
import { useChart } from '@/hooks/useChart'

export function AiScoreChart() {
  const [score, setScore] = useState(0)

  useEffect(() => {
    fetch('/api/candidate/ai-score')
      .then(r => (r.ok ? r.json() : null))
      .then(d => setScore(d?.score ?? 0))
  }, [])

  const config: ChartConfiguration = {
    type: 'doughnut',
    data: {
      labels: ['Complete', 'Remaining'],
      datasets: [
        {
          data: [score, Math.max(0, 100 - score)],
          backgroundColor: ['#1847d4', '#e2e8f0'],
          borderWidth: 0,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
    } as ChartConfiguration['options'],
  }

  const ref = useChart(config)

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 20, marginBottom: 16 }}>
      <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 15, marginBottom: 12, textAlign: 'center' }}>
        AI profile score
      </h3>
      <div style={{ position: 'relative', height: 140 }}>
        <canvas ref={ref} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            fontSize: 22,
            color: '#1847d4',
            pointerEvents: 'none',
          }}
        >
          {score}%
        </div>
      </div>
    </div>
  )
}
