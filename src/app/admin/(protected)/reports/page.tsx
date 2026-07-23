'use client'

import { useEffect, useState } from 'react'

interface JobReport {
  id: string
  board: string
  job_id: string
  job_title: string | null
  reason: string
  note: string | null
  created_at: string
}

const REASON_LABELS: Record<string, string> = {
  fake_or_spam: 'Fake or spam',
  asks_for_money: 'Asks for money',
  expired_but_showing: 'Expired but showing',
  discriminatory: 'Discriminatory',
  other: 'Other',
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<JobReport[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => { void load() }, [])

  async function load() {
    setStatus('loading')
    try {
      const res = await fetch('/api/admin/reports')
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setStatus('error'); setError(json?.error || 'Failed to load reports'); return }
      setReports(json.data || [])
      setStatus('ready')
    } catch {
      setStatus('error'); setError('Network error while loading reports')
    }
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 26, marginBottom: 24 }}>Job Reports</h1>

      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 20 }}>
        {status === 'loading' && <p style={{ color: '#6b7280', fontSize: 13 }}>Loading…</p>}
        {status === 'error' && (
          <>
            <p style={{ color: '#be123c', fontSize: 13.5, marginBottom: 10 }} role="alert">{error}</p>
            <button onClick={load} style={{ background: '#fff', color: '#1847d4', border: '1.5px solid #cbd5e1', borderRadius: 9, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Retry</button>
          </>
        )}
        {status === 'ready' && reports.length === 0 && (
          <p style={{ color: '#6b7280', fontSize: 13 }}>No reports yet.</p>
        )}
        {status === 'ready' && reports.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={th}>Job</th>
                  <th style={th}>Board</th>
                  <th style={th}>Reason</th>
                  <th style={th}>Note</th>
                  <th style={th}>Reported</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={td}>
                      <div style={{ fontWeight: 700, color: '#0d1f4e' }}>{r.job_title || r.job_id}</div>
                      <div style={{ color: '#9ca3af', fontSize: 11 }}>{r.job_id}</div>
                    </td>
                    <td style={td}>{r.board}</td>
                    <td style={td}>{REASON_LABELS[r.reason] || r.reason}</td>
                    <td style={{ ...td, maxWidth: 260, whiteSpace: 'pre-wrap' }}>{r.note || '—'}</td>
                    <td style={td}>{new Date(r.created_at).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const th = { padding: '9px 12px', fontSize: 11.5, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '.03em' }
const td = { padding: '10px 12px', color: '#374151', verticalAlign: 'top' as const }
