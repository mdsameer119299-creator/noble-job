'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type Job = { id: string; title: string; company?: string; posted_at?: string }

export function PendingMiniList() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/pending-jobs')
      .then(r => (r.ok ? r.json() : { data: [] }))
      .then(d => setJobs((d.data || []).slice(0, 5)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 16, margin: 0 }}>
          Pending approvals
        </h3>
        <Link href="/admin/approvals" style={{ fontSize: 12, fontWeight: 800, color: '#1847d4', textDecoration: 'none' }}>
          Review all
        </Link>
      </div>
      {loading ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>Loading…</p>
      ) : jobs.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>No jobs awaiting approval.</p>
      ) : (
        jobs.map(j => (
          <div key={j.id} style={{ padding: '10px 0', borderBottom: '1px solid #f0f4ff' }}>
            <div style={{ fontWeight: 700, color: '#0d1f4e', fontSize: 13 }}>{j.title}</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>{j.company || 'Employer job'}</div>
          </div>
        ))
      )}
    </div>
  )
}
