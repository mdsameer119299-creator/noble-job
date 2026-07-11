'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Contact messages admin view: a paginated list of contact_messages with a
 * detail panel. Opening an unread message marks it read (PATCH
 * /api/admin/messages/{id}/read) and updates the unread badge. Covers loading /
 * error / empty states and real API error handling.
 */

type ContactMessage = {
  id: string
  first_name: string
  last_name: string | null
  email: string
  phone: string | null
  subject: string
  message: string
  inquiry_type: string
  user_type: string
  status: 'unread' | 'read' | 'replied'
  created_at: string
}

const PAGE_SIZE = 20

export function MessageViewModal() {
  const [rows, setRows] = useState<ContactMessage[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<ContactMessage | null>(null)

  const load = useCallback(async () => {
    setStatus('loading'); setError('')
    try {
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
      if (statusFilter !== 'all') qs.set('status', statusFilter)
      const res = await fetch(`/api/admin/messages?${qs.toString()}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setStatus('error'); setError(json?.error || 'Failed to load messages'); return }
      setRows((json.data || []) as ContactMessage[])
      setTotal(json.total ?? (json.data || []).length)
      setStatus('ready')
    } catch {
      setStatus('error'); setError('Network error while loading messages')
    }
  }, [offset, statusFilter])

  useEffect(() => { void load() }, [load])

  async function open(msg: ContactMessage) {
    setSelected(msg)
    if (msg.status === 'unread') {
      // Optimistic; reconcile on failure.
      setRows(r => r.map(m => (m.id === msg.id ? { ...m, status: 'read' } : m)))
      setSelected({ ...msg, status: 'read' })
      try {
        const res = await fetch(`/api/admin/messages/${msg.id}/read`, { method: 'PATCH' })
        if (!res.ok) setRows(r => r.map(m => (m.id === msg.id ? { ...m, status: 'unread' } : m)))
      } catch {
        setRows(r => r.map(m => (m.id === msg.id ? { ...m, status: 'unread' } : m)))
      }
    }
  }

  const unreadCount = rows.filter(m => m.status === 'unread').length

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 380px) 1fr', gap: 16, alignItems: 'start' }}>
      {/* List */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={heading}>📬 Messages{unreadCount ? ` · ${unreadCount} unread` : ''}</h3>
          <select value={statusFilter} onChange={e => { setOffset(0); setStatusFilter(e.target.value as 'all' | 'unread' | 'read') }}
            aria-label="Filter messages by status" style={select}>
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
        </div>

        {status === 'loading' && <p style={muted}>Loading messages…</p>}
        {status === 'error' && (
          <div>
            <p style={{ color: '#be123c', fontSize: 13.5, marginBottom: 8 }} role="alert">{error}</p>
            <button onClick={load} style={btnSecondary}>Retry</button>
          </div>
        )}
        {status === 'ready' && rows.length === 0 && <p style={muted}>No messages{statusFilter !== 'all' ? ` (${statusFilter})` : ''}.</p>}
        {status === 'ready' && rows.length > 0 && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rows.map(m => (
              <li key={m.id}>
                <button onClick={() => open(m)} aria-label={`Open message from ${m.first_name}: ${m.subject}`}
                  style={{ ...listItem, borderColor: selected?.id === m.id ? '#1847d4' : '#e2e8f0', background: m.status === 'unread' ? '#eff6ff' : '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: m.status === 'unread' ? 800 : 600, color: '#0d1f4e', fontSize: 13 }}>
                      {m.first_name} {m.last_name || ''}
                    </span>
                    {m.status === 'unread' && <span style={dot} aria-label="unread" />}
                  </div>
                  <div style={{ color: '#374151', fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.subject}</div>
                  <div style={{ color: '#9ca3af', fontSize: 11 }}>{new Date(m.created_at).toLocaleString()}</div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Pagination */}
        {status === 'ready' && total > PAGE_SIZE && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
            <button onClick={() => setOffset(o => Math.max(0, o - PAGE_SIZE))} disabled={offset === 0} style={btnSecondary}>← Prev</button>
            <span style={{ fontSize: 11.5, color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
            </span>
            <button onClick={() => setOffset(o => o + PAGE_SIZE)} disabled={offset + PAGE_SIZE >= total} style={btnSecondary}>Next →</button>
          </div>
        )}
      </div>

      {/* Detail */}
      <div style={card}>
        {!selected ? (
          <p style={muted}>Select a message to read it.</p>
        ) : (
          <div>
            <h3 style={{ ...heading, marginBottom: 4 }}>{selected.subject}</h3>
            <div style={{ color: '#6b7280', fontSize: 12.5, marginBottom: 12 }}>
              {selected.first_name} {selected.last_name || ''} · <a href={`mailto:${selected.email}`} style={{ color: '#1847d4' }}>{selected.email}</a>
              {selected.phone ? ` · ${selected.phone}` : ''}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              <Tag>{selected.inquiry_type}</Tag><Tag>{selected.user_type}</Tag><Tag>{selected.status}</Tag>
            </div>
            <p style={{ color: '#374151', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>{selected.message}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{children}</span>
}

const card = { background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 18 } as const
const heading = { fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 15, marginTop: 0, marginBottom: 0 } as const
const muted = { color: '#6b7280', fontSize: 13 } as const
const listItem = { display: 'block', width: '100%', textAlign: 'left' as const, cursor: 'pointer', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '9px 11px', background: '#fff' }
const dot = { width: 9, height: 9, borderRadius: '50%', background: '#1847d4', flexShrink: 0, marginTop: 4 } as const
const select = { padding: '6px 10px', fontSize: 12.5, borderRadius: 8, border: '1.5px solid #cbd5e1', background: '#fff', color: '#0d1f4e' } as const
const btnSecondary = { background: '#fff', color: '#1847d4', border: '1.5px solid #cbd5e1', borderRadius: 8, padding: '6px 12px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' } as const
