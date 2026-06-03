'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type JobRow = { id: string; title: string; company?: string; location?: string }

export function RecommendedJobsList() {
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/candidate/recommended')
      .then(r => (r.ok ? r.json() : null))
      .then(d => setJobs((d?.data || []).slice(0, 5)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', marginTop: 20, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f4ff' }}>
        <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 16, margin: 0 }}>
          Recommended for you
        </h3>
      </div>
      {loading ? (
        <p style={{ padding: 20, color: '#6b7280', fontSize: 13 }}>Loading…</p>
      ) : jobs.length === 0 ? (
        <p style={{ padding: 20, color: '#6b7280', fontSize: 13 }}>Update your category in profile for better matches.</p>
      ) : (
        jobs.map(j => (
          <Link
            key={j.id}
            href={`/jobs/private/${j.id}`}
            style={{
              display: 'block',
              padding: '12px 20px',
              borderBottom: '1px solid #f8faff',
              textDecoration: 'none',
            }}
          >
            <div style={{ fontWeight: 800, color: '#0d1f4e', fontSize: 14 }}>{j.title}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              {j.company} {j.location ? `· ${j.location}` : ''}
            </div>
          </Link>
        ))
      )}
    </div>
  )
}
