'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { isValidJobId, isRealDisplayValue } from '@/lib/jobs/renderable'

type Saved = { id: string; job_id: string; board?: string; title?: string; company?: string; location?: string }

export function SavedJobsTab() {
  const [items, setItems] = useState<Saved[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/saved-jobs')
      .then(r => (r.ok ? r.json() : { data: [] }))
      // The API only returns references that still resolve to a renderable job; a
      // reference without a usable id or title is never shown as "View job undefined".
      .then(d => setItems(((d.data || []) as Saved[]).filter(s => isValidJobId(s?.job_id) && isRealDisplayValue(s?.title))))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p style={{ color: '#6b7280', fontSize: 13 }}>Loading saved jobs…</p>
  if (!items.length) {
    return (
      <div style={{ textAlign: 'center', padding: 32 }}>
        <p style={{ color: '#6b7280', fontSize: 14 }}>No saved jobs yet.</p>
        <Link href="/jobs/private" style={{ color: '#1847d4', fontWeight: 800, fontSize: 14 }}>
          Browse jobs →
        </Link>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map(s => (
        <Link
          key={s.id}
          href={`/jobs/${s.board || 'private'}/${s.job_id}`}
          style={{
            display: 'block',
            padding: 16,
            background: '#fff',
            borderRadius: 12,
            border: '1.5px solid #e2e8f0',
            textDecoration: 'none',
            fontWeight: 700,
            color: '#0d1f4e',
          }}
        >
          {s.title}
          {[s.company, s.location].filter(Boolean).length > 0 && (
            <span style={{ display: 'block', fontWeight: 500, fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {[s.company, s.location].filter(Boolean).join(' · ')}
            </span>
          )}
        </Link>
      ))}
    </div>
  )
}
