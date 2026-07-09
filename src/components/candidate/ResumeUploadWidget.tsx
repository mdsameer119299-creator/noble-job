'use client'

import { useRef, useState } from 'react'
import { validateResumeFile } from '@/lib/utils/resumeUpload'
import { resumeScoreBand, anonProfileCompletion } from '@/lib/resume/scoreBand'
import { track, AcqEvent } from '@/lib/analytics/events'
import { JobAlertCta } from './JobAlertCta'

interface QuickScore {
  overallScore: number
  atsScore: number
  extractedSkills: string[]
  suggestions: string[]
  wordCount: number
  parseWarning: string | null
}

/**
 * Parse-first onboarding widget: an anonymous visitor uploads a resume and
 * immediately sees VALUE FIRST — a Career Score, detected skills, matching-job
 * and salary/career-insight teasers, and improvement tips — with no account
 * required. Only AFTER the value do we invite sign-in (to save + apply
 * internally) and offer email job alerts.
 *
 * Nothing is persisted here; scoring runs via the public /api/resume/quick-score
 * endpoint. This is the top of the resume-acquisition funnel.
 *
 * NOTE: "Career Score" is the user-facing label; the underlying implementation
 * is still the heuristic ATS analyzer (unchanged) — see scoreBand.ts / atsScore.ts.
 */
export function ResumeUploadWidget({ source = 'dock' }: { source?: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<QuickScore | null>(null)
  const [fileName, setFileName] = useState('')

  async function handleFile(file: File) {
    const valid = validateResumeFile(file)
    if (!valid.ok) {
      setState('error')
      setError(valid.error)
      return
    }
    setFileName(file.name)
    setState('busy')
    setError('')
    track(AcqEvent.RESUME_UPLOAD, { source, ext: valid.ext, size: file.size })
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
      track(AcqEvent.RESUME_PARSED, { source, words: data.wordCount })
      track(AcqEvent.RESUME_SCORE_GENERATED, { source, score: data.overallScore, skills: data.extractedSkills.length })
      setResult(data)
      setState('done')
    } catch {
      setState('error')
      setError('Network error. Please try again.')
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) void handleFile(f)
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) void handleFile(f)
  }

  if (state === 'done' && result) {
    const band = resumeScoreBand(result.overallScore)
    const completion = anonProfileCompletion({ hasResume: true, skillsCount: result.extractedSkills.length, score: result.overallScore })
    const topSkill = result.extractedSkills[0]
    const matchHref = topSkill ? `/jobs/private?q=${encodeURIComponent(topSkill)}` : '/jobs/private'
    return (
      <div>
        {/* ── VALUE FIRST ─────────────────────────────────────────────── */}
        {/* 1) Career Score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ width: 88, height: 88, borderRadius: '50%', border: `6px solid ${band.color}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: band.color, lineHeight: 1 }}>{Math.round(result.overallScore)}</span>
            <span style={{ fontSize: 10, color: '#6b7280' }}>/ 100</span>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: '#6b7280' }}>Your Career Score</div>
            <div style={{ fontWeight: 900, color: band.color, fontSize: 17, fontFamily: 'Playfair Display,serif' }}>{band.label}</div>
            <div style={{ color: '#475569', fontSize: 13, marginTop: 2 }}>{band.blurb}</div>
            <div style={{ color: '#9ca3af', fontSize: 11.5, marginTop: 2 }}>ATS readability {Math.round(result.atsScore)}% · {result.extractedSkills.length} skills detected</div>
          </div>
        </div>

        {/* 2) Detected skills */}
        {result.extractedSkills.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#374151', marginBottom: 6 }}>Skills we detected</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {result.extractedSkills.slice(0, 10).map(s => (
                <span key={s} style={{ background: '#eff6ff', color: '#1847d4', border: '1px solid #bfdbfe', padding: '3px 9px', borderRadius: 12, fontSize: 11.5, fontWeight: 600 }}>{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* 3) Matching jobs + 4) Salary/career insights — honest teasers to real pages */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          <a href={matchHref} style={teaser}>
            <div style={teaserIcon}>🎯</div>
            <div style={teaserTitle}>Matching Jobs</div>
            <div style={teaserSub}>{topSkill ? `See roles hiring for ${topSkill}` : 'Browse roles for you'}</div>
          </a>
          <a href="/guides" style={teaser}>
            <div style={teaserIcon}>💰</div>
            <div style={teaserTitle}>Salary &amp; Career Insights</div>
            <div style={teaserSub}>Ranges &amp; guides for your field</div>
          </a>
        </div>

        {/* 5) Top tips */}
        {result.suggestions.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#374151', marginBottom: 4 }}>Top tips to improve</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: '#374151', fontSize: 12.8, lineHeight: 1.6 }}>
              {result.suggestions.slice(0, 3).map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}

        {/* ── THEN prompt to sign in ──────────────────────────────────── */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
            <span>Profile completion</span><span>{completion}%</span>
          </div>
          <div style={{ height: 8, background: '#e5e7eb', borderRadius: 99 }}>
            <div style={{ width: `${completion}%`, height: '100%', background: '#1847d4', borderRadius: 99 }} />
          </div>
        </div>
        <a href="/auth?role=candidate&reason=save-resume"
          style={{ display: 'block', textAlign: 'center', background: '#1847d4', color: '#fff', borderRadius: 10, padding: '12px', fontWeight: 800, fontSize: 14.5, textDecoration: 'none', marginBottom: 12 }}>
          Create free account to save &amp; apply →
        </a>
        <JobAlertCta title="Get Matching Jobs by Email" compact />

        <SocialProof />
      </div>
    )
  }

  return (
    <div>
      <div
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter') inputRef.current?.click() }}
        style={{ border: '2px dashed #cbd5e1', borderRadius: 12, padding: '26px 18px', textAlign: 'center', cursor: 'pointer', background: '#f8faff' }}
      >
        <div style={{ fontSize: 30, marginBottom: 6 }}>📄</div>
        <div style={{ fontWeight: 800, color: '#0d1f4e', fontSize: 15 }}>
          {state === 'busy' ? 'Analysing your resume…' : 'Upload your resume'}
        </div>
        <div style={{ color: '#6b7280', fontSize: 12.5, marginTop: 4 }}>
          {fileName || 'PDF, DOC or DOCX · up to 5 MB · instant AI Career Report, no signup'}
        </div>
        <input ref={inputRef} type="file" accept=".pdf,.doc,.docx" onChange={onPick} style={{ display: 'none' }} />
      </div>
      {state === 'error' && <div style={{ color: '#be123c', fontSize: 12.8, marginTop: 8 }}>{error}</div>}
      <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 8, textAlign: 'center' }}>
        We analyse your resume instantly and never share it. Nothing is saved until you create an account.
      </div>
      <SocialProof />
    </div>
  )
}

const teaser = { display: 'block', textDecoration: 'none', background: '#f8faff', border: '1px solid #e2e8f0', borderRadius: 11, padding: '11px 12px' } as const
const teaserIcon = { fontSize: 18, marginBottom: 3 } as const
const teaserTitle = { fontWeight: 800, color: '#0d1f4e', fontSize: 12.8 } as const
const teaserSub = { color: '#6b7280', fontSize: 11.5, marginTop: 1 } as const

/**
 * Honest social proof — credibility markers only, no fabricated counts or
 * testimonials. Reflects what is verifiably true about Noble Job today.
 */
function SocialProof() {
  const items = [
    ['🏛️', 'An initiative of NCC Foundation'],
    ['🇮🇳', 'Govt · Private · WFH · Abroad jobs'],
    ['🔒', 'Private & free — no spam, ever'],
  ]
  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #eef2fb', display: 'flex', flexWrap: 'wrap', gap: '6px 14px', justifyContent: 'center' }}>
      {items.map(([icon, label]) => (
        <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#64748b', fontSize: 11.5, fontWeight: 600 }}>
          <span aria-hidden>{icon}</span> {label}
        </span>
      ))}
    </div>
  )
}
