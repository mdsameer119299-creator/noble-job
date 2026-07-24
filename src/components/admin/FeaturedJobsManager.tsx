'use client'
import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/useToast'

type Board = 'private' | 'wfh' | 'abroad'
type Row = { id: string; title: string; company?: string; location?: string; country?: string; is_featured: boolean; board: Board }

const BOARD_LABEL: Record<Board, string> = { private: 'Private', wfh: 'Work From Home', abroad: 'Abroad' }
const BOARD_FILTERS: { id: Board | 'all'; label: string }[] = [
  { id: 'all', label: 'All Boards' },
  { id: 'private', label: 'Private' },
  { id: 'wfh', label: 'Work From Home' },
  { id: 'abroad', label: 'Abroad' },
]

/**
 * Featured is genuine-only by construction: this list only ever contains
 * active jobs with a real owning employer (server-enforced too — see the
 * PATCH .../featured handler's defense-in-depth check).
 */
export function FeaturedJobsManager() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [board, setBoard] = useState<Board | 'all'>('all')
  const toast = useToast()

  useEffect(() => {
    setLoading(true)
    fetch('/api/admin/featured-candidates')
      .then(r => (r.ok ? r.json() : { data: [] }))
      .then(d => setRows(d.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  const toggle = async (row: Row) => {
    const key = `${row.board}-${row.id}`
    setBusy(key)
    try {
      const res = await fetch(`/api/admin/${row.id}/featured?board=${row.board}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ featured: !row.is_featured }),
      })
      if (res.ok) {
        setRows(prev => prev.map(r => (r.id === row.id && r.board === row.board ? { ...r, is_featured: !r.is_featured } : r)))
        toast.success(!row.is_featured ? 'Marked as Featured' : 'Removed from Featured')
      } else toast.error('Could not update')
    } finally { setBusy(null) }
  }

  const visible = board === 'all' ? rows : rows.filter(r => r.board === board)

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 20, marginBottom: 16 }}>
      <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 16, marginBottom: 4 }}>⭐ Featured Jobs</h3>
      <p style={{ color: '#6b7280', fontSize: 12.5, marginBottom: 14 }}>Only genuine, active employer-posted jobs can be featured — across Private, Work From Home and Abroad.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {BOARD_FILTERS.map(f => (
          <button key={f.id} onClick={() => setBoard(f.id)}
            style={{ padding: '6px 13px', borderRadius: 20, border: '1.5px solid', fontWeight: 700, fontSize: 12, cursor: 'pointer', borderColor: board === f.id ? '#1847d4' : '#e2e8f0', background: board === f.id ? '#1847d4' : '#fff', color: board === f.id ? '#fff' : '#374151' }}>
            {f.label}
          </button>
        ))}
      </div>
      {loading ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>Loading…</p>
      ) : visible.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>No genuine active jobs yet — Featured only applies once real employers have live postings.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#6b7280', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.03em' }}>
                <th style={{ padding: '8px 10px' }}>Job</th>
                <th style={{ padding: '8px 10px' }}>Board</th>
                <th style={{ padding: '8px 10px' }}>Location</th>
                <th style={{ padding: '8px 10px' }}>Featured</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(r => {
                const key = `${r.board}-${r.id}`
                return (
                  <tr key={key} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px' }}>
                      <div style={{ fontWeight: 700, color: '#0d1f4e' }}>{r.title}</div>
                      <div style={{ color: '#6b7280', fontSize: 12 }}>{r.company}</div>
                    </td>
                    <td style={{ padding: '10px', color: '#374151' }}>{BOARD_LABEL[r.board]}</td>
                    <td style={{ padding: '10px', color: '#374151' }}>{r.location || r.country || '—'}</td>
                    <td style={{ padding: '10px' }}>
                      <button type="button" onClick={() => toggle(r)} disabled={busy === key}
                        style={{ background: r.is_featured ? '#fef3c7' : '#f1f5f9', color: r.is_featured ? '#92400e' : '#64748b', border: '1.5px solid', borderColor: r.is_featured ? '#fcd34d' : '#e2e8f0', padding: '6px 14px', borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
                        {r.is_featured ? '⭐ Featured' : 'Mark Featured'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
