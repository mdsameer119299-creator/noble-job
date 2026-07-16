'use client'
import { useEffect, useState } from 'react'
import { JobStatusBadge } from '@/components/shared/JobStatusBadge'
import type { Job, JobStatus } from '@/types/job'

type Counts = { all: number; live: number; verified: number; archived: number }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const TABS: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'LIVE_JOB', label: 'Live' },
  { id: 'VERIFIED_JOB', label: 'Verified' },
  { id: 'ARCHIVED_JOB', label: 'Archived' },
]

export function JobsTable() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [counts, setCounts] = useState<Counts>({ all: 0, live: 0, verified: 0, archived: 0 })
  const [appCounts, setAppCounts] = useState<Record<string, number>>({})
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '100' })
    if (status !== 'all') params.set('status', status)
    fetch(`/api/jobs?${params}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        setJobs(d?.jobs || [])
        if (d?.counts) setCounts(d.counts)
      })
      .catch(() => setJobs([]))
      .finally(() => setLoading(false))
  }, [status])

  // Per-job application counts, scoped to the jobs actually on screen so the
  // tally is EXACT. The endpoint's unscoped path only counts a bounded window of
  // recent applications, which would undercount once the site has many of them.
  // Only real (UUID) job ids exist in `applications.job_id`; inventory ids can't.
  useEffect(() => {
    const ids = jobs.map(j => String(j.id)).filter(id => UUID_RE.test(id))
    if (!ids.length) { setAppCounts({}); return }
    fetch(`/api/admin/application-counts?jobIds=${encodeURIComponent(ids.join(','))}`)
      .then(r => (r.ok ? r.json() : { data: {} }))
      .then(d => setAppCounts(d.data || {}))
      .catch(() => setAppCounts({}))
  }, [jobs])

  const needle = q.trim().toLowerCase()
  const visible = needle
    ? jobs.filter(j =>
        [j.title, j.company, j.location].filter(Boolean).join(' ').toLowerCase().includes(needle),
      )
    : jobs

  const changeStatus = (id: string, jobStatus: JobStatus) => {
    setJobs(prev => prev.map(j => (j.id === id ? { ...j, jobStatus } : j)))
    fetch('/api/admin/job-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, jobStatus }),
    }).catch(() => {})
  }

  const countFor = (id: string) =>
    id === 'all' ? counts.all : id === 'LIVE_JOB' ? counts.live : id === 'VERIFIED_JOB' ? counts.verified : counts.archived

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: '20px', marginBottom: 16 }}>
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search jobs by title, company or location…"
        style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 12 }}
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {TABS.map(t => {
          const active = status === t.id
          return (
            <button key={t.id} onClick={() => setStatus(t.id)}
              style={{ padding: '7px 14px', borderRadius: 22, border: '1.5px solid', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, borderColor: active ? '#1847d4' : '#e2e8f0', background: active ? '#1847d4' : '#fff', color: active ? '#fff' : '#374151' }}>
              {t.label}
              <span style={{ fontSize: 11, fontWeight: 800, background: active ? 'rgba(255,255,255,.2)' : '#f0f4ff', color: active ? '#fff' : '#1847d4', padding: '1px 7px', borderRadius: 10 }}>{countFor(t.id)}</span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>Loading jobs…</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#6b7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                <th style={{ padding: '8px 10px' }}>Job</th>
                <th style={{ padding: '8px 10px' }}>Location</th>
                <th style={{ padding: '8px 10px' }}>Applicants</th>
                <th style={{ padding: '8px 10px' }}>Status</th>
                <th style={{ padding: '8px 10px' }}>Change Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(j => (
                <tr key={j.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px' }}>
                    <div style={{ fontWeight: 700, color: '#0d1f4e' }}>{j.title}</div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>{j.company}</div>
                  </td>
                  <td style={{ padding: '10px', color: '#374151' }}>{j.location}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ fontWeight: 800, color: (appCounts[j.id] || 0) > 0 ? '#1847d4' : '#94a3b8' }}>
                      {appCounts[j.id] || 0}
                    </span>
                  </td>
                  <td style={{ padding: '10px' }}><JobStatusBadge status={j.jobStatus} /></td>
                  <td style={{ padding: '10px' }}>
                    <select value={j.jobStatus || 'VERIFIED_JOB'} onChange={e => changeStatus(j.id, e.target.value as JobStatus)}
                      style={{ border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', fontSize: 12.5, color: '#374151', background: '#fff' }}>
                      <option value="LIVE_JOB">Live Job</option>
                      <option value="VERIFIED_JOB">Verified</option>
                      <option value="ARCHIVED_JOB">Archived</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && <p style={{ color: '#6b7280', fontSize: 13, padding: 10 }}>No jobs found.</p>}
        </div>
      )}
    </div>
  )
}
