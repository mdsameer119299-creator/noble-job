'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/useToast'

/**
 * Admin Candidate Detail — profile, resume status, Career Score (+ history when
 * available), applications history, saved jobs, job alerts, Resume AI usage and
 * an activity timeline. All from real persisted data via
 * GET /api/admin/candidates/{id}/intelligence. Missing data shows honest empty
 * states; a missing Career Score shows "Not Scored" (never 0%).
 */

type Intelligence = {
  candidate: {
    id: string; first_name: string | null; last_name: string | null; phone?: string | null
    city?: string | null; state?: string | null; category: string | null; experience_years?: string | null
    expected_salary?: number | null; skills?: string[] | null; profile_score: number | null; resume_url: string | null
    users?: { email?: string | null; status?: string | null; created_at?: string | null } | null
  }
  applications: Array<{ id: string; status: string; board: string; applied_at: string; notes: string | null; jobs?: { title?: string; category?: string } | null }>
  savedJobs: Array<{ id: string; job_id: string; board: string; saved_at: string }>
  jobAlerts: Array<Record<string, unknown>>
  careerScore: number | null
  scoreHistory: Array<{ at: string; score: number; source: string | null }>
  resumeAiUsage: Array<{ at: string; event: string; props: Record<string, unknown> }>
  timeline: Array<{ at: string; kind: string; label: string }>
}

function importedTitle(notes: string | null): string | null {
  if (!notes) return null
  try { return (JSON.parse(notes) as { title?: string }).title || null } catch { return null }
}

export function CandidateDetail({ id }: { id: string }) {
  const [d, setD] = useState<Intelligence | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'notfound'>('loading')
  const [error, setError] = useState('')
  const [resumeLoading, setResumeLoading] = useState(false)
  const toast = useToast()

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/candidates/${id}/intelligence`)
        if (res.status === 404) { if (alive) setStatus('notfound'); return }
        const json = await res.json().catch(() => ({}))
        if (!res.ok) { if (alive) { setStatus('error'); setError(json?.error || 'Failed to load candidate') } return }
        if (alive) { setD(json.data as Intelligence); setStatus('ready') }
      } catch {
        if (alive) { setStatus('error'); setError('Network error while loading candidate') }
      }
    })()
    return () => { alive = false }
  }, [id])

  const openResume = async () => {
    setResumeLoading(true)
    try {
      const res = await fetch(`/api/admin/candidates/${id}/resume-url`)
      const j = await res.json()
      if (res.ok && j.url) window.open(j.url, '_blank', 'noopener,noreferrer')
      else toast.error(j.error || 'Resume not available')
    } finally { setResumeLoading(false) }
  }

  if (status === 'loading') return <p style={muted}>Loading candidate…</p>
  if (status === 'notfound') return <p style={muted}>Candidate not found.</p>
  if (status === 'error' || !d) return <p style={{ color: '#be123c', fontSize: 13 }} role="alert">{error || 'Could not load candidate.'}</p>

  const c = d.candidate
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || '—'

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Profile */}
      <Card>
        <h2 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 22, margin: '0 0 4px' }}>{name}</h2>
        <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 12px' }}>{c.users?.email || '—'}</p>
        <Field label="Phone" value={c.phone} />
        <Field label="Location" value={[c.city, c.state].filter(Boolean).join(', ')} />
        <Field label="Category / Target" value={c.category} />
        <Field label="Experience" value={c.experience_years} />
        <Field label="Expected salary" value={c.expected_salary ? `₹${c.expected_salary.toLocaleString()}` : ''} />
        <Field label="Skills" value={(c.skills || []).join(', ')} />
        <Field label="Profile completion" value={`${c.profile_score ?? 0}%`} />
        <Field label="Career Score" value={d.careerScore === null ? <span style={{ color: '#9ca3af' }}>Not Scored</span> : <span style={{ color: '#1847d4', fontWeight: 800 }}>{Math.round(d.careerScore)}</span>} />
        <Field label="Account status" value={c.users?.status} />
      </Card>

      {/* Resume */}
      <Card>
        <SectionTitle>Resume</SectionTitle>
        {c.resume_url
          ? <button type="button" onClick={openResume} disabled={resumeLoading} style={btnPrimary}>{resumeLoading ? 'Opening…' : 'Open / Download resume'}</button>
          : <p style={muted}>No resume on file.</p>}
      </Card>

      {/* Career Score breakdown (history) */}
      {d.scoreHistory.length > 0 && (
        <Card>
          <SectionTitle>Career Score history</SectionTitle>
          <ul style={list}>
            {d.scoreHistory.map((s, i) => (
              <li key={i} style={row}>
                <span style={{ fontWeight: 800, color: '#1847d4' }}>{Math.round(s.score)}</span>
                <span style={{ color: '#6b7280' }}>{s.source ? `via ${s.source}` : ''}</span>
                <span style={{ color: '#9ca3af', fontSize: 11.5 }}>{new Date(s.at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Applications history */}
      <Card>
        <SectionTitle>Applications ({d.applications.length})</SectionTitle>
        {d.applications.length === 0 ? <p style={muted}>No applications yet.</p> : (
          <ul style={list}>
            {d.applications.map(a => (
              <li key={a.id} style={row}>
                <span style={{ fontWeight: 700, color: '#0d1f4e' }}>{a.jobs?.title || importedTitle(a.notes) || 'A job'}</span>
                <span style={pill}>{a.status}</span>
                <span style={{ color: '#9ca3af', fontSize: 11.5 }}>{a.board} · {new Date(a.applied_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Saved jobs + Job alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <SectionTitle>Saved jobs ({d.savedJobs.length})</SectionTitle>
          {d.savedJobs.length === 0 ? <p style={muted}>None saved.</p> : (
            <ul style={list}>{d.savedJobs.map(s => <li key={s.id} style={row}><span>{s.board} job</span><span style={{ color: '#9ca3af', fontSize: 11.5 }}>{new Date(s.saved_at).toLocaleDateString()}</span></li>)}</ul>
          )}
        </Card>
        <Card>
          <SectionTitle>Job alerts ({d.jobAlerts.length})</SectionTitle>
          {d.jobAlerts.length === 0 ? <p style={muted}>No alerts set.</p> : (
            <ul style={list}>{d.jobAlerts.map((al, i) => (
              <li key={i} style={row}>
                <span>{String(al.keywords || al.category || 'All jobs')}</span>
                <span style={{ color: '#9ca3af', fontSize: 11.5 }}>{String(al.frequency || '')}{al.is_active === false ? ' · off' : ''}</span>
              </li>
            ))}</ul>
          )}
        </Card>
      </div>

      {/* Resume AI usage */}
      <Card>
        <SectionTitle>Resume AI usage ({d.resumeAiUsage.length})</SectionTitle>
        {d.resumeAiUsage.length === 0 ? <p style={muted}>No Resume AI activity recorded.</p> : (
          <ul style={list}>
            {d.resumeAiUsage.slice(0, 20).map((u, i) => (
              <li key={i} style={row}>
                <span style={{ color: '#374151' }}>{u.event.replace(/_/g, ' ')}</span>
                <span style={{ color: '#9ca3af', fontSize: 11.5 }}>{new Date(u.at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Activity timeline */}
      <Card>
        <SectionTitle>Activity timeline</SectionTitle>
        {d.timeline.length === 0 ? <p style={muted}>No recorded activity.</p> : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {d.timeline.map((t, i) => (
              <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '6px 0', borderBottom: '1px solid #f0f4ff' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.kind === 'application' ? '#1847d4' : t.kind === 'resume_ai' ? '#0c8f86' : '#b4703a', flexShrink: 0 }} aria-hidden />
                <span style={{ color: '#374151', fontSize: 13, flex: 1 }}>{t.label}</span>
                <span style={{ color: '#9ca3af', fontSize: 11.5 }}>{new Date(t.at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 20, marginBottom: 16 }}>{children}</div>
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 15, margin: '0 0 10px' }}>{children}</h3>
}
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid #f0f4ff', fontSize: 13 }}>
      <span style={{ color: '#6b7280', fontWeight: 600 }}>{label}</span>
      <span style={{ color: '#0d1f4e', fontWeight: 700, textAlign: 'right' }}>{value || '—'}</span>
    </div>
  )
}

const muted = { color: '#6b7280', fontSize: 13, margin: 0 } as const
const list = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 } as const
const row = { display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', fontSize: 13 } as const
const pill = { fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 999, background: '#f1f5f9', color: '#475569' } as const
const btnPrimary = { background: '#1847d4', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: 'pointer' } as const
