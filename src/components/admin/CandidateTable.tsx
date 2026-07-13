'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * Admin Candidates table — truthful real data only. Career Score shows the
 * latest persisted Resume AI score, or "Not Scored" when none exists (never 0%).
 * Category shows the candidate's own value, or one derived from a real applied
 * job (flagged), never fabricated. Paginated + searchable via /api/admin/candidates.
 */

type Row = {
  id: string
  name: string
  email: string | null
  category: string | null
  categoryDerived: boolean
  applicationsCount: number
  latestAppliedJob: string | null
  resumeUploaded: boolean
  careerScore: number | null
  profileCompletion: number
  lastActivity: string | null
  accountStatus: string | null
}

const PAGE_SIZE = 25

export function CandidateTable() {
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setOffset(0) }, 300)
    return () => clearTimeout(t)
  }, [q])

  const load = useCallback(async () => {
    setStatus('loading'); setError('')
    try {
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
      if (debouncedQ) qs.set('q', debouncedQ)
      const res = await fetch(`/api/admin/candidates?${qs.toString()}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setStatus('error'); setError(json?.error || 'Failed to load candidates'); return }
      setRows((json.data || []) as Row[])
      setTotal(json.total ?? (json.data || []).length)
      setStatus('ready')
    } catch {
      setStatus('error'); setError('Network error while loading candidates')
    }
  }, [offset, debouncedQ])

  useEffect(() => { void load() }, [load])

  return (
    <div>
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search candidates by name, email or category…"
        aria-label="Search candidates"
        style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 12 }}
      />

      {status === 'error' && (
        <div style={{ background: '#fff', border: '1.5px solid #fecaca', borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <p style={{ color: '#be123c', fontSize: 13.5, marginBottom: 8 }} role="alert">{error}</p>
          <button onClick={load} style={btnSecondary}>Retry</button>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 1040 }}>
          <thead>
            <tr style={{ background: '#f8faff', textAlign: 'left', color: '#475569' }}>
              <Th>Name</Th><Th>Email</Th><Th>Category / Target</Th><Th>Apps</Th><Th>Latest Applied Job</Th>
              <Th>Resume</Th><Th>Career Score</Th><Th>Profile</Th><Th>Last Activity</Th><Th>Account</Th><Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {status === 'loading' && (
              <tr><td colSpan={11} style={{ padding: 16, color: '#6b7280' }}>Loading candidates…</td></tr>
            )}
            {status === 'ready' && rows.length === 0 && (
              <tr><td colSpan={11} style={{ padding: 16, color: '#6b7280' }}>No candidates found{debouncedQ ? ` for “${debouncedQ}”` : ''}.</td></tr>
            )}
            {status === 'ready' && rows.map(r => (
              <tr key={r.id} style={{ borderTop: '1px solid #f0f4ff' }}>
                <Td><span style={{ fontWeight: 700, color: '#0d1f4e' }}>{r.name}</span></Td>
                <Td>{r.email || '—'}</Td>
                <Td>
                  {r.category
                    ? <span>{r.category}{r.categoryDerived && <span style={derivedTag} title="Derived from a job this candidate applied to">derived</span>}</span>
                    : <span style={{ color: '#9ca3af' }}>—</span>}
                </Td>
                <Td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.applicationsCount}</Td>
                <Td>{r.latestAppliedJob || <span style={{ color: '#9ca3af' }}>—</span>}</Td>
                <Td>{r.resumeUploaded ? <span style={{ color: '#059669', fontWeight: 700 }}>Yes</span> : <span style={{ color: '#9ca3af' }}>No</span>}</Td>
                <Td>{r.careerScore === null
                  ? <span style={{ color: '#9ca3af' }}>Not Scored</span>
                  : <span style={{ fontWeight: 800, color: '#1847d4' }}>{Math.round(r.careerScore)}</span>}</Td>
                <Td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.profileCompletion}%</Td>
                <Td style={{ color: '#6b7280' }}>{r.lastActivity ? new Date(r.lastActivity).toLocaleDateString() : '—'}</Td>
                <Td><StatusPill status={r.accountStatus} /></Td>
                <Td><Link href={`/admin/candidates/${r.id}`} style={viewLink}>View profile →</Link></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {status === 'ready' && total > PAGE_SIZE && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <button onClick={() => setOffset(o => Math.max(0, o - PAGE_SIZE))} disabled={offset === 0} style={btnSecondary}>← Prev</button>
          <span style={{ fontSize: 12, color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </span>
          <button onClick={() => setOffset(o => o + PAGE_SIZE)} disabled={offset + PAGE_SIZE >= total} style={btnSecondary}>Next →</button>
        </div>
      )}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: '11px 12px', fontWeight: 700, whiteSpace: 'nowrap' }}>{children}</th>
}
function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', ...style }}>{children}</td>
}
function StatusPill({ status }: { status: string | null }) {
  const active = status === 'active'
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: active ? '#e4f0e8' : '#f1f5f9', color: active ? '#2e8b57' : '#64748b' }}>{status || 'unknown'}</span>
}

const derivedTag = { marginLeft: 6, fontSize: 9.5, fontWeight: 700, color: '#b4703a', background: '#f6ece0', borderRadius: 5, padding: '1px 5px', verticalAlign: 'middle' } as const
const viewLink = { color: '#1847d4', fontWeight: 700, textDecoration: 'none', fontSize: 12.5 } as const
const btnSecondary = { background: '#fff', color: '#1847d4', border: '1.5px solid #cbd5e1', borderRadius: 8, padding: '7px 13px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' } as const
