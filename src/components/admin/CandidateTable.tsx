'use client'
import { useEffect, useState } from 'react'

type Row = {
  id: string
  first_name: string
  last_name: string
  category: string | null
  profile_score: number
  users?: { email: string; status: string }
}

export function CandidateTable() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/candidates')
      .then(r => (r.ok ? r.json() : { data: [] }))
      .then(d => setRows(d.data || []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p style={{ color: '#6b7280', fontSize: 13 }}>Loading candidates…</p>

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8faff', textAlign: 'left' }}>
            <th style={{ padding: 12 }}>Name</th>
            <th style={{ padding: 12 }}>Email</th>
            <th style={{ padding: 12 }}>Category</th>
            <th style={{ padding: 12 }}>Score</th>
            <th style={{ padding: 12 }}>Account</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} style={{ borderTop: '1px solid #f0f4ff' }}>
              <td style={{ padding: 12, fontWeight: 700 }}>
                {r.first_name} {r.last_name}
              </td>
              <td style={{ padding: 12 }}>{r.users?.email}</td>
              <td style={{ padding: 12 }}>{r.category || '—'}</td>
              <td style={{ padding: 12 }}>{r.profile_score ?? 0}%</td>
              <td style={{ padding: 12 }}>{r.users?.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
