'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/utils/formatters'

type Job = { id: string; title: string; status: string; posted_at?: string; applications_count?: number }

export function RecentJobsTable() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/employer/jobs')
      .then(r => (r.ok ? r.json() : null))
      .then(d => setJobs((d?.data || []).slice(0, 8)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="dashboard-table-wrap" style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f4ff', display: 'flex', justifyContent: 'space-between' }}>
        <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 16, margin: 0 }}>
          Recent job postings
        </h3>
        <Link href="/employer/jobs/new" style={{ fontSize: 12, fontWeight: 800, color: '#1847d4', textDecoration: 'none' }}>
          + Post job
        </Link>
      </div>
      {loading ? (
        <p style={{ padding: 20, color: '#6b7280', fontSize: 13 }}>Loading…</p>
      ) : jobs.length === 0 ? (
        <p style={{ padding: 20, color: '#6b7280', fontSize: 13 }}>No jobs posted yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8faff', textAlign: 'left' }}>
              <th style={{ padding: '10px 20px', color: '#6b7280', fontWeight: 700 }}>Title</th>
              <th style={{ padding: '10px 12px', color: '#6b7280', fontWeight: 700 }}>Status</th>
              <th style={{ padding: '10px 20px', color: '#6b7280', fontWeight: 700 }}>Posted</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(j => (
              <tr key={j.id} style={{ borderTop: '1px solid #f0f4ff' }}>
                <td style={{ padding: '12px 20px', fontWeight: 700, color: '#0d1f4e' }}>{j.title}</td>
                <td style={{ padding: '12px 12px' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: j.status === 'active' ? '#15803d' : '#f07020' }}>
                    {j.status}
                  </span>
                </td>
                <td style={{ padding: '12px 20px', color: '#6b7280' }}>{j.posted_at ? formatDate(j.posted_at) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
