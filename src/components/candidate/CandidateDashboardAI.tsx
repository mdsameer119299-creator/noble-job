'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CANDIDATE_STATUSES, statusMeta, type CandidateStatus } from '@/lib/candidate/status'
import { resumeScoreBand } from '@/lib/resume/scoreBand'
import type { CompletionItem } from '@/lib/candidate/profileCompletion'

interface Intelligence {
  profile: { first_name: string | null; category: string | null; city: string | null }
  careerScore: { value: number | null; updatedAt: string | null }
  profileScore: number
  status: CandidateStatus
  completion: { items: CompletionItem[]; percent: number; completed: number; total: number; nextBest: CompletionItem | null }
  recommendations: {
    skills: string[]
    jobs: { id: string; title: string; company: string; location: string; href: string }[]
    guides: { label: string; href: string }[]
    interviewPrep: { label: string; href: string }[]
    salary: null
  }
  activity: { type: string; title: string; created_at: string }[]
}

const card = { background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 20 } as const
const h3 = { fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 15, margin: '0 0 14px' } as const

function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime()
  const days = Math.floor(d / 86400000)
  if (days > 1) return `${days}d ago`
  if (days === 1) return 'yesterday'
  const h = Math.floor(d / 3600000)
  if (h >= 1) return `${h}h ago`
  const m = Math.floor(d / 60000)
  return m >= 1 ? `${m}m ago` : 'just now'
}

const ACTIVITY_ICON: Record<string, string> = {
  career_score: '📊', resume: '📄', status: '🔔', application: '✉️', joined: '🎉',
}

export function CandidateDashboardAI() {
  const [data, setData] = useState<Intelligence | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingStatus, setSavingStatus] = useState(false)
  const [scoring, setScoring] = useState(false)

  async function load() {
    const d = await fetch('/api/candidate/intelligence').then(r => (r.ok ? r.json() : null)).catch(() => null)
    setData(d)
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  async function setStatus(status: CandidateStatus) {
    if (!data) return
    setSavingStatus(true)
    setData({ ...data, status }) // optimistic
    await fetch('/api/candidate/status', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }).catch(() => {})
    setSavingStatus(false)
    void load()
  }

  async function recompute() {
    setScoring(true)
    await fetch('/api/candidate/career-score', { method: 'POST' }).catch(() => {})
    setScoring(false)
    void load()
  }

  if (loading) return <div style={{ ...card, color: '#6b7280', fontSize: 13 }}>Loading your AI career coach…</div>
  if (!data) return <div style={{ ...card, color: '#6b7280', fontSize: 13 }}>Could not load your dashboard. Please refresh.</div>

  const sm = statusMeta(data.status)
  const score = data.careerScore.value
  const band = score != null ? resumeScoreBand(score) : null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 18 }} className="cand-ai-grid">
      {/* LEFT column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Career Score */}
        <div style={card}>
          <h3 style={h3}>Your Career Score</h3>
          {score != null && band ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 82, height: 82, borderRadius: '50%', border: `6px solid ${band.color}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 24, fontWeight: 900, color: band.color, lineHeight: 1 }}>{score}</span>
                <span style={{ fontSize: 9.5, color: '#6b7280' }}>/ 100</span>
              </div>
              <div>
                <div style={{ fontWeight: 900, color: band.color, fontSize: 16, fontFamily: 'Playfair Display,serif' }}>{band.label}</div>
                <div style={{ color: '#475569', fontSize: 12.5, marginTop: 2 }}>{band.blurb}</div>
                <button onClick={recompute} disabled={scoring}
                  style={{ marginTop: 8, background: 'transparent', border: '1.5px solid #cbd5e1', color: '#1847d4', borderRadius: 8, padding: '5px 12px', fontWeight: 700, fontSize: 12, cursor: scoring ? 'wait' : 'pointer' }}>
                  {scoring ? 'Recomputing…' : '↻ Recompute'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ color: '#475569', fontSize: 13, margin: '0 0 10px' }}>Upload your resume to get your AI Career Score, skill analysis and tailored tips.</p>
              <Link href="/candidate/resume" style={{ display: 'inline-block', background: '#1847d4', color: '#fff', borderRadius: 9, padding: '9px 16px', fontWeight: 800, fontSize: 13, textDecoration: 'none' }}>Upload Resume →</Link>
            </div>
          )}
        </div>

        {/* AI Recommendations */}
        <div style={card}>
          <h3 style={h3}>🧭 Your AI Career Coach recommends</h3>

          {/* Skills to learn */}
          {data.recommendations.skills.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={rowTitle}>Skills to boost your profile</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {data.recommendations.skills.map(s => (
                  <Link key={s} href={`/candidate/profile`} style={{ background: '#eff6ff', color: '#1847d4', border: '1px solid #bfdbfe', padding: '3px 9px', borderRadius: 12, fontSize: 11.5, fontWeight: 600, textDecoration: 'none' }}>+ {s}</Link>
                ))}
              </div>
            </div>
          )}

          {/* Matching jobs — verified only */}
          <div style={{ marginBottom: 16 }}>
            <div style={rowTitle}>Jobs matching your profile</div>
            {data.recommendations.jobs.length > 0 ? (
              data.recommendations.jobs.map(j => (
                <Link key={j.id} href={j.href} style={recRow}>
                  <span style={{ fontWeight: 800, color: '#0d1f4e', fontSize: 13.5 }}>{j.title}</span>
                  <span style={{ color: '#6b7280', fontSize: 12 }}> · {j.company}{j.location ? ` · ${j.location}` : ''}</span>
                </Link>
              ))
            ) : (
              <p style={muted}>No verified matches yet. Set your category and add skills to unlock matches, or <Link href="/jobs/private" style={linkStyle}>browse all jobs</Link>.</p>
            )}
          </div>

          {/* Salary — honest coming soon */}
          <div style={{ marginBottom: 16 }}>
            <div style={rowTitle}>Salary insights</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 12px', color: '#64748b', fontSize: 12.5, fontWeight: 600 }}>
              💰 Personalised salary benchmarks — <span style={{ color: '#b45309' }}>Coming soon</span>
            </div>
          </div>

          {/* Guides + interview prep */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <div style={rowTitle}>Career guides</div>
              {data.recommendations.guides.map(g => <Link key={g.href} href={g.href} style={miniLink}>→ {g.label}</Link>)}
            </div>
            <div>
              <div style={rowTitle}>Interview prep</div>
              {data.recommendations.interviewPrep.map(g => <Link key={g.href} href={g.href} style={miniLink}>→ {g.label}</Link>)}
            </div>
          </div>
        </div>

        {/* Activity timeline */}
        <div style={card}>
          <h3 style={h3}>🕑 Your activity</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.activity.slice(0, 8).map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span aria-hidden style={{ fontSize: 15, lineHeight: 1.3 }}>{ACTIVITY_ICON[a.type] || '•'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{timeAgo(a.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Availability status */}
        <div style={card}>
          <h3 style={h3}>Your availability</h3>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: sm.color, display: 'inline-block' }} />
            <span style={{ fontWeight: 800, color: sm.color, fontSize: 14 }}>{sm.label}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CANDIDATE_STATUSES.map(s => (
              <button key={s.value} onClick={() => setStatus(s.value)} disabled={savingStatus}
                title={s.hint}
                style={{ border: `1.5px solid ${data.status === s.value ? s.color : '#e2e8f0'}`, background: data.status === s.value ? s.color : '#fff', color: data.status === s.value ? '#fff' : '#475569', borderRadius: 999, padding: '5px 11px', fontSize: 11.5, fontWeight: 700, cursor: savingStatus ? 'wait' : 'pointer' }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Profile completion */}
        <div style={card}>
          <h3 style={h3}>Profile completion</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: '#1847d4' }}>{data.completion.percent}%</span>
            <span style={{ fontSize: 12, color: '#6b7280' }}>{data.completion.items.filter(i => i.done).length}/{data.completion.total} done</span>
          </div>
          <div style={{ height: 9, background: '#e2e8f0', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ width: `${data.completion.percent}%`, height: '100%', background: 'linear-gradient(90deg,#1847d4,#7c3aed)' }} />
          </div>
          {data.completion.nextBest && (
            <Link href={data.completion.nextBest.href} style={{ display: 'block', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 12px', textDecoration: 'none', marginBottom: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#1847d4' }}>Next: {data.completion.nextBest.label} →</div>
              <div style={{ fontSize: 11.5, color: '#475569', marginTop: 1 }}>{data.completion.nextBest.benefit}</div>
            </Link>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {data.completion.items.map(i => (
              <Link key={i.key} href={i.href} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', textDecoration: 'none' }}>
                <span aria-hidden style={{ color: i.done ? '#15803d' : '#cbd5e1', fontSize: 14, lineHeight: 1.3 }}>{i.done ? '✓' : '○'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.8, fontWeight: 600, color: i.done ? '#9ca3af' : '#374151', textDecoration: i.done ? 'line-through' : 'none' }}>{i.label}</div>
                  {!i.done && <div style={{ fontSize: 11, color: '#6b7280' }}>{i.benefit}</div>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const rowTitle = { fontSize: 12, fontWeight: 800, color: '#374151', marginBottom: 6 } as const
const recRow = { display: 'block', padding: '7px 0', borderBottom: '1px solid #f4f7ff', textDecoration: 'none' } as const
const miniLink = { display: 'block', color: '#1847d4', fontWeight: 600, fontSize: 12.5, textDecoration: 'none', padding: '3px 0' } as const
const linkStyle = { color: '#1847d4', fontWeight: 700, textDecoration: 'none' } as const
const muted = { color: '#6b7280', fontSize: 12.5, margin: 0 } as const
