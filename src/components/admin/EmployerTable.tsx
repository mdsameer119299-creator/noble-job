'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useToast } from '@/hooks/useToast'

type Row = {
  id: string
  company_name: string
  city: string
  industry: string
  status: string
  users?: { email: string; status: string }
}

export function EmployerTable() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const load = () => {
    setLoading(true)
    fetch('/api/admin/employers')
      .then(r => (r.ok ? r.json() : { data: [] }))
      .then(d => setRows(d.data || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const toggle = async (id: string, status: string) => {
    const res = await fetch(`/api/admin/employers/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentStatus: status }),
    })
    if (res.ok) {
      toast.success('Status updated')
      load()
    } else toast.error('Failed')
  }

  if (loading) return <p style={{ color: '#6b7280', fontSize: 13 }}>Loading employers…</p>

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8faff', textAlign: 'left' }}>
            <th style={{ padding: 12 }}>Company</th>
            <th style={{ padding: 12 }}>City</th>
            <th style={{ padding: 12 }}>Email</th>
            <th style={{ padding: 12 }}>Status</th>
            <th style={{ padding: 12 }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} style={{ borderTop: '1px solid #f0f4ff' }}>
              <td style={{ padding: 12, fontWeight: 700 }}>
                <Link href={`/admin/employers/${r.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{r.company_name}</Link>
              </td>
              <td style={{ padding: 12 }}>{r.city}</td>
              <td style={{ padding: 12 }}>{r.users?.email}</td>
              <td style={{ padding: 12 }}>{r.status}</td>
              <td style={{ padding: 12 }}>
                <button
                  type="button"
                  onClick={() => toggle(r.id, r.status)}
                  style={{ fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer' }}
                >
                  Toggle
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
