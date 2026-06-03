'use client'
import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/useToast'

type Job = {
  id: string
  title: string
  company?: string
  location?: string
  description?: string
  status: string
}

export function PendingJobModal() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [selected, setSelected] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const load = () => {
    setLoading(true)
    fetch('/api/admin/pending-jobs')
      .then(r => (r.ok ? r.json() : { data: [] }))
      .then(d => {
        const list = d.data || []
        setJobs(list)
        if (!selected && list[0]) setSelected(list[0])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const act = async (id: string, action: 'approve' | 'reject') => {
    const res = await fetch(`/api/admin/${id}/${action}`, { method: 'POST' })
    if (res.ok) {
      toast.success(action === 'approve' ? 'Job approved' : 'Job rejected')
      setSelected(null)
      load()
    } else toast.error('Action failed')
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f4ff', fontWeight: 800, color: '#0d1f4e' }}>
          Queue ({jobs.length})
        </div>
        {loading ? (
          <p style={{ padding: 16, fontSize: 13, color: '#6b7280' }}>Loading…</p>
        ) : jobs.length === 0 ? (
          <p style={{ padding: 16, fontSize: 13, color: '#6b7280' }}>No pending jobs.</p>
        ) : (
          jobs.map(j => (
            <button
              key={j.id}
              type="button"
              onClick={() => setSelected(j)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '12px 16px',
                border: 'none',
                borderBottom: '1px solid #f8faff',
                background: selected?.id === j.id ? '#eff6ff' : '#fff',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13, color: '#0d1f4e' }}>{j.title}</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{j.company}</div>
            </button>
          ))
        )}
      </div>

      {selected ? (
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 24 }}>
          <h2 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 22, marginBottom: 8 }}>
            {selected.title}
          </h2>
          <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>
            {selected.company} · {selected.location}
          </p>
          {selected.description && (
            <p style={{ color: '#374151', fontSize: 13, lineHeight: 1.6, marginBottom: 20, maxHeight: 200, overflow: 'auto' }}>
              {selected.description.slice(0, 600)}
              {selected.description.length > 600 ? '…' : ''}
            </p>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => act(selected.id, 'approve')}
              style={{ background: '#15803d', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => act(selected.id, 'reject')}
              style={{ background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fca5a5', padding: '10px 20px', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}
            >
              Reject
            </button>
          </div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 40, textAlign: 'center', color: '#6b7280' }}>
          Select a job to review
        </div>
      )}
    </div>
  )
}
