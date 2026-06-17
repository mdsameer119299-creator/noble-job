'use client'
import { useEffect, useMemo, useState } from 'react'
import { useToast } from '@/hooks/useToast'

type Notification = {
  id: string
  type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

const TYPE_LABELS: Record<string, string> = {
  candidate_registered: 'Candidate',
  employer_registered: 'Employer',
  resume_uploaded: 'Resume',
  application_submitted: 'Application',
  job_pending: 'Job pending',
  job_approved: 'Job approved',
  job_rejected: 'Job rejected',
}

const FILTERS = ['all', 'candidate_registered', 'employer_registered', 'resume_uploaded', 'application_submitted', 'job_pending', 'job_approved', 'job_rejected']

export function AdminNotifications() {
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const toast = useToast()

  const load = () => {
    setLoading(true)
    setError(false)
    fetch('/api/notifications')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => setItems(d.data || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const markRead = async (id: string) => {
    setItems(items => items.map(n => (n.id === id ? { ...n, is_read: true } : n)))
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' }).catch(() => {})
  }

  const markAllRead = async () => {
    const unread = items.filter(n => !n.is_read)
    setItems(items => items.map(n => ({ ...n, is_read: true })))
    await Promise.all(unread.map(n => fetch(`/api/notifications/${n.id}`, { method: 'PATCH' }).catch(() => {})))
    toast.success('All marked as read')
  }

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return items.filter(n => {
      if (filter !== 'all' && n.type !== filter) return false
      if (needle && !`${n.title} ${n.message}`.toLowerCase().includes(needle)) return false
      return true
    })
  }, [items, filter, q])

  const unread = items.filter(n => !n.is_read).length

  if (loading) return <p style={{ color: '#6b7280', fontSize: 13 }}>Loading notifications…</p>
  if (error) return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 20 }}>
      <p style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>Could not load notifications.</p>
      <button type="button" onClick={load} style={{ background: '#1847d4', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>Retry</button>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search notifications…"
          style={{ flex: 1, minWidth: 200, border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#0d1f4e' }} />
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#0d1f4e' }}>
          {FILTERS.map(f => <option key={f} value={f}>{f === 'all' ? 'All types' : TYPE_LABELS[f] || f}</option>)}
        </select>
        <button type="button" onClick={markAllRead} disabled={unread === 0}
          style={{ background: unread ? '#1847d4' : '#cbd5e1', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: unread ? 'pointer' : 'not-allowed' }}>
          Mark all read{unread ? ` (${unread})` : ''}
        </button>
      </div>

      {visible.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>No notifications{filter !== 'all' || q ? ' match your filters' : ' yet'}.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map(n => (
            <div key={n.id} onClick={() => !n.is_read && markRead(n.id)}
              style={{ background: '#fff', borderRadius: 12, border: '1.5px solid', borderColor: n.is_read ? '#e2e8f0' : '#bfdbfe', borderLeft: n.is_read ? '1.5px solid #e2e8f0' : '4px solid #1847d4', padding: '14px 16px', cursor: n.is_read ? 'default' : 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#1847d4', textTransform: 'uppercase', letterSpacing: '.04em' }}>{TYPE_LABELS[n.type] || n.type}</span>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0d1f4e' }}>{n.title}</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{n.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
