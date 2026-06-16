'use client'
import { useEffect, useState, useCallback } from 'react'

type Row = {
  id: string
  status: string
  board: string | null
  applied_at: string | null
  candidates?: { first_name?: string; last_name?: string; users?: { email?: string } } | null
  employers?: { company_name?: string } | null
  jobs?: { title?: string } | null
}

const STATUSES = ['all', 'new', 'shortlisted', 'interview', 'hired', 'rejected']
const BOARDS = ['all', 'private', 'govt', 'wfh', 'abroad']
const OWNERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All applications' },
  { value: 'employer', label: 'Employer-owned' },
  { value: 'unassigned', label: 'Recruitment queue (no employer)' },
]

const selectStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1.5px solid #e2e8f0',
  fontSize: 13,
  color: '#0d1f4e',
  background: '#fff',
}

export function ApplicationsTable() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('all')
  const [board, setBoard] = useState('all')
  const [owner, setOwner] = useState('all')
  const [q, setQ] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    const sp = new URLSearchParams()
    if (status !== 'all') sp.set('status', status)
    if (board !== 'all') sp.set('board', board)
    if (owner !== 'all') sp.set('owner', owner)
    if (q.trim()) sp.set('q', q.trim())
    fetch(`/api/admin/applications?${sp.toString()}`)
      .then(r => (r.ok ? r.json() : { data: [] }))
      .then(d => setRows(d.data || []))
      .finally(() => setLoading(false))
  }, [status, board, owner, q])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search applicant, email, job, employer…"
          style={{ ...selectStyle, flex: 1, minWidth: 220 }}
        />
        <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
          {STATUSES.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>
          ))}
        </select>
        <select value={board} onChange={e => setBoard(e.target.value)} style={selectStyle}>
          {BOARDS.map(b => (
            <option key={b} value={b}>{b === 'all' ? 'All boards' : b}</option>
          ))}
        </select>
        <select value={owner} onChange={e => setOwner(e.target.value)} style={selectStyle}>
          {OWNERS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8faff', textAlign: 'left' }}>
              <th style={{ padding: 12 }}>Applicant</th>
              <th style={{ padding: 12 }}>Email</th>
              <th style={{ padding: 12 }}>Job</th>
              <th style={{ padding: 12 }}>Owner</th>
              <th style={{ padding: 12 }}>Board</th>
              <th style={{ padding: 12 }}>Status</th>
              <th style={{ padding: 12 }}>Applied</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 16, color: '#6b7280' }}>Loading applications…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 16, color: '#6b7280' }}>No applications found.</td></tr>
            ) : (
              rows.map(r => {
                const c = r.candidates
                const name = c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() : '—'
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid #f0f4ff' }}>
                    <td style={{ padding: 12, fontWeight: 700 }}>{name || '—'}</td>
                    <td style={{ padding: 12 }}>{c?.users?.email || '—'}</td>
                    <td style={{ padding: 12 }}>{r.jobs?.title || '—'}</td>
                    <td style={{ padding: 12 }}>
                      {r.employers?.company_name || (
                        <span style={{ color: '#b45309', fontWeight: 700 }}>Noble Job · outreach pending</span>
                      )}
                    </td>
                    <td style={{ padding: 12 }}>{r.board || 'private'}</td>
                    <td style={{ padding: 12 }}>{r.status}</td>
                    <td style={{ padding: 12 }}>{r.applied_at ? new Date(r.applied_at).toLocaleDateString() : '—'}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
