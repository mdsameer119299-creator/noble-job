'use client'
import { useState } from 'react'
import type { ResumeScoreResult } from '@/lib/resume/types'

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 20,
}
const barColor = (n: number) => (n >= 75 ? '#15803d' : n >= 50 ? '#f07020' : '#dc2626')

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#374151', marginBottom: 3 }}>
        <span style={{ textTransform: 'capitalize' }}>{label.replace(/([A-Z])/g, ' $1')}</span>
        <span style={{ fontWeight: 800, color: barColor(value) }}>{value}</span>
      </div>
      <div style={{ height: 7, background: '#eef2f7', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: barColor(value) }} />
      </div>
    </div>
  )
}

function Chips({ items, tone }: { items: string[]; tone: 'ok' | 'warn' }) {
  if (!items.length) return null
  const bg = tone === 'ok' ? '#eaf7ee' : '#fdeee7'
  const fg = tone === 'ok' ? '#15803d' : '#c2410c'
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
      {items.map(s => (
        <span key={s} style={{ background: bg, color: fg, fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>{s}</span>
      ))}
    </div>
  )
}

/** AI Resume Score panel — scores the candidate's stored resume, optionally vs a JD. */
export function ResumeScoreCard() {
  const [jd, setJd] = useState('')
  const [result, setResult] = useState<ResumeScoreResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/candidate/resume-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jd.trim() ? { jobDescription: jd.trim() } : {}),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || 'Could not score resume'); setResult(null) }
      else setResult(d.data as ResumeScoreResult)
    } catch {
      setError('Network error — please try again.')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ ...card }}>
      <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 16, marginBottom: 4 }}>
        AI Resume Score
      </h3>
      <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 12 }}>
        Analyse your uploaded resume for ATS compatibility, skills and keywords. Paste a job description to score the match.
      </p>

      <textarea
        value={jd}
        onChange={e => setJd(e.target.value)}
        placeholder="Optional: paste a job description to compare against…"
        rows={3}
        style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', fontSize: 13, resize: 'vertical', marginBottom: 10 }}
      />
      <button
        type="button" onClick={run} disabled={loading}
        style={{ background: '#1847d4', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}
      >
        {loading ? 'Analysing…' : result ? 'Re-analyse' : 'Score my resume'}
      </button>

      {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 12 }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
            <ScoreDial label="Overall" value={result.overallScore} />
            <ScoreDial label="ATS" value={result.atsScore} />
            {result.jobMatchScore !== null && <ScoreDial label="Job match" value={result.jobMatchScore} />}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
            <div>
              <h4 style={sub}>ATS breakdown</h4>
              {Object.entries(result.subscores).map(([k, v]) => <Meter key={k} label={k} value={v as number} />)}
            </div>
            <div>
              <h4 style={sub}>Detected skills ({result.extractedSkills.length})</h4>
              <Chips items={result.extractedSkills} tone="ok" />
              {!result.extractedSkills.length && <p style={{ color: '#6b7280', fontSize: 12 }}>No recognised skills found — add a Skills section.</p>}
              {result.missingKeywords.length > 0 && (
                <>
                  <h4 style={{ ...sub, marginTop: 12 }}>Missing keywords</h4>
                  <Chips items={result.missingKeywords} tone="warn" />
                </>
              )}
            </div>
          </div>

          <h4 style={{ ...sub, marginTop: 16 }}>
            Recommendations
            <span style={{ fontSize: 11, fontWeight: 700, color: result.recommendationsSource === 'ai' ? '#7c3aed' : '#64748b', marginLeft: 8 }}>
              {result.recommendationsSource === 'ai' ? 'AI-generated' : 'Rule-based'}
            </span>
          </h4>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: '#374151', fontSize: 13, lineHeight: 1.6 }}>
            {result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
          </ul>

          {result.parseWarning && <p style={{ color: '#c2410c', fontSize: 12, marginTop: 10 }}>⚠ {result.parseWarning}</p>}
          {!result.aiConfigured && (
            <p style={{ color: '#6b7280', fontSize: 11.5, marginTop: 10 }}>
              Recommendations are rule-based. Set an AI provider key (OPENAI_API_KEY or ANTHROPIC_API_KEY) on the server to enable AI-generated feedback.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

const sub: React.CSSProperties = { fontWeight: 800, color: '#0d1f4e', fontSize: 13, margin: '0 0 4px' }

function ScoreDial({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, color: barColor(value), border: `5px solid ${barColor(value)}` }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 5, fontWeight: 700 }}>{label}</div>
    </div>
  )
}
