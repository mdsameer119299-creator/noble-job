'use client'

import { useState } from 'react'
import { ResumeFilePicker } from '../ResumeFilePicker'
import { resumeScoreBand } from '@/lib/resume/scoreBand'
import { track, AcqEvent } from '@/lib/analytics/events'

/**
 * Improve entry flow: select the resume to strengthen, then (optionally) get an
 * instant Career Score using the EXISTING public quick-score endpoint — the
 * same heuristic score the Career Report shows. Nothing is uploaded or stored;
 * the file lives only in this browser session.
 *
 * Truthfulness: the instant score is clearly labelled as a quick check. The full
 * AI audit and rebuild do NOT run here — that is a future engine PR. We never
 * claim an AI audit occurred.
 */

interface QuickScore {
  overallScore: number
  atsScore: number
  extractedSkills: string[]
  wordCount: number
  parseWarning: string | null
}

export function ImproveFlow() {
  const [file, setFile] = useState<File | null>(null)
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [score, setScore] = useState<QuickScore | null>(null)

  function onReady(f: File, ext: string) {
    setFile(f)
    setScore(null)
    setState('idle')
    setError('')
    track(AcqEvent.RESUME_FILE_SELECTED, { mode: 'improve', ext, size: f.size })
  }
  function onClear() {
    setFile(null)
    setScore(null)
    setState('idle')
    setError('')
  }

  async function runQuickScore() {
    if (!file) return
    setState('busy')
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/resume/quick-score', { method: 'POST', body: fd })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setState('error')
        setError(json?.error || 'Could not score your resume. Please try again.')
        return
      }
      const data = json.data as QuickScore
      setScore(data)
      setState('done')
      track(AcqEvent.RESUME_SCORE_GENERATED, { source: 'improve', score: data.overallScore, skills: data.extractedSkills.length })
    } catch {
      setState('error')
      setError('Network error. Please try again.')
    }
  }

  return (
    <div>
      <ResumeFilePicker onFileReady={onReady} onClear={onClear} prompt="PDF, DOC or DOCX · up to 5 MB · not uploaded or stored" />

      {file && (
        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            onClick={runQuickScore}
            disabled={state === 'busy'}
            aria-busy={state === 'busy'}
            style={{ ...primaryBtn, opacity: state === 'busy' ? 0.7 : 1 }}
          >
            {state === 'busy' ? 'Checking your resume…' : score ? 'Re-check Career Score' : 'Get my instant Career Score'}
          </button>
          <p style={{ color: '#9ca3af', fontSize: 11.5, margin: '8px 2px 0' }}>
            A quick, free readability check — not the full AI audit. Nothing is saved.
          </p>
        </div>
      )}

      {state === 'error' && (
        <div role="alert" style={{ color: '#be123c', fontSize: 12.8, marginTop: 10 }}>{error}</div>
      )}

      {state === 'done' && score && <ScorePreview score={score} />}
    </div>
  )
}

function ScorePreview({ score }: { score: QuickScore }) {
  const band = resumeScoreBand(score.overallScore)
  return (
    <div style={{ marginTop: 16, border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', border: `6px solid ${band.color}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: band.color, lineHeight: 1 }}>{Math.round(score.overallScore)}</span>
          <span style={{ fontSize: 9, color: '#6b7280' }}>/ 100</span>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: '#6b7280' }}>Instant Career Score</div>
          <div style={{ fontWeight: 900, color: band.color, fontSize: 16, fontFamily: 'Playfair Display,serif' }}>{band.label}</div>
          <div style={{ color: '#9ca3af', fontSize: 11.5, marginTop: 2 }}>ATS readability {Math.round(score.atsScore)}% · {score.extractedSkills.length} skills detected</div>
        </div>
      </div>
      {score.extractedSkills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {score.extractedSkills.slice(0, 10).map(s => (
            <span key={s} style={{ background: '#eff6ff', color: '#1847d4', border: '1px solid #bfdbfe', padding: '3px 9px', borderRadius: 12, fontSize: 11.5, fontWeight: 600 }}>{s}</span>
          ))}
        </div>
      )}
      <p style={{ color: '#6b7280', fontSize: 12, margin: '12px 0 0' }}>
        This is a quick heuristic check. The full AI audit — grammar, chronology, achievements, keyword gaps — and a truthful rebuild arrive in an upcoming release.
      </p>
    </div>
  )
}

const primaryBtn = {
  display: 'inline-block', background: '#1847d4', color: '#fff', border: 'none',
  borderRadius: 10, padding: '11px 18px', fontWeight: 800, fontSize: 14, cursor: 'pointer',
} as const
