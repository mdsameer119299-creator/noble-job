'use client'
import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { formatDate } from '@/lib/utils/formatters'

type Job = { id: string; title: string; status: string; posted_at?: string; location?: string; job_type?: string }

const statusColor: Record<string, string> = {
  active: '#15803d', pending: '#f07020', rejected: '#dc2626', closed: '#64748b',
}

export function JobPostingsTable() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const toast = useToast()

  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch('/api/employer/jobs')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => setJobs(d.data || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const remove = async (id: string) => {
    if (!confirm('Delete this job posting? This cannot be undone.')) return
    setBusy(id)
    try {
      const res = await fetch(`/api/employer/jobs/${id}`, { method: 'DELETE' })
      if (res.ok) { toast.success('Job deleted'); setJobs(j => j.filter(x => x.id !== id)) }
      else toast.error('Could not delete job')
    } finally { setBusy(null) }
  }

  const close = async (id: string) => {
    setBusy(id)
    try {
      const res = await fetch(`/api/employer/jobs/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' }),
      })
      if (res.ok) { toast.success('Job closed'); load() }
      else toast.error('Could not close job')
    } finally { setBusy(null) }
  }

  if (loading) return <p style={{ color: '#6b7280', fontSize: 13 }}>Loading job postings…</p>
  if (error) return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 20 }}>
      <p style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>Could not load your jobs.</p>
      <button type="button" onClick={load} style={{ background: '#1847d4', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>Retry</button>
    </div>
  )
  if (jobs.length === 0) return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 32, textAlign: 'center' }}>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 12 }}>You haven&apos;t posted any jobs yet.</p>
      <Link href="/employer/jobs/new" style={{ color: '#1847d4', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>+ Post your first job</Link>
    </div>
  )

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8faff', textAlign: 'left' }}>
            <th style={{ padding: 12 }}>Title</th>
            <th style={{ padding: 12 }}>Location</th>
            <th style={{ padding: 12 }}>Status</th>
            <th style={{ padding: 12 }}>Posted</th>
            <th style={{ padding: 12 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map(j => (
            <tr key={j.id} style={{ borderTop: '1px solid #f0f4ff' }}>
              <td style={{ padding: 12, fontWeight: 700, color: '#0d1f4e' }}>{j.title}</td>
              <td style={{ padding: 12, color: '#6b7280' }}>{j.location || '—'}</td>
              <td style={{ padding: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: statusColor[j.status] || '#64748b' }}>{j.status}</span>
              </td>
              <td style={{ padding: 12, color: '#6b7280' }}>{j.posted_at ? formatDate(j.posted_at) : '—'}</td>
              <td style={{ padding: 12 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Link href={`/employer/jobs/${j.id}/edit`} style={{ fontSize: 12, fontWeight: 700, color: '#1847d4', textDecoration: 'none' }}>Edit</Link>
                  {j.status !== 'closed' && (
                    <button type="button" onClick={() => close(j.id)} disabled={busy === j.id} style={linkBtn('#64748b')}>Close</button>
                  )}
                  <button type="button" onClick={() => remove(j.id)} disabled={busy === j.id} style={linkBtn('#dc2626')}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const linkBtn = (color: string): React.CSSProperties => ({
  background: 'none', border: 'none', color, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0,
})
