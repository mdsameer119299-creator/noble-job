'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ResumeFilePicker } from '../ResumeFilePicker'
import { JOB_DESCRIPTION_MAX_CHARS, validateJobDescription } from '@/lib/resume/resumeWorkspace'
import { track, AcqEvent } from '@/lib/analytics/events'

/**
 * Tailor entry flow: add the resume to tailor and the target job. The target is
 * pasted job-description TEXT (no arbitrary external URL is fetched server-side
 * in this PR). Genuine Noble Job vacancies are reachable via a normal on-site
 * link so the user can copy a real description to paste.
 *
 * Validation: empty (on continue) and oversized (live, capped at
 * JOB_DESCRIPTION_MAX_CHARS). No tailored resume is generated here — that is a
 * future engine PR. Tailoring will use only verified candidate facts.
 */
export function TailorFlow() {
  const [hasResume, setHasResume] = useState(false)
  const [jd, setJd] = useState('')
  const [error, setError] = useState('')
  const [entered, setEntered] = useState(false)

  const over = jd.length > JOB_DESCRIPTION_MAX_CHARS

  function onContinue() {
    const v = validateJobDescription(jd)
    if (!v.ok) {
      setError(
        v.reason === 'empty'
          ? 'Please paste the job description you want to tailor for.'
          : `That job description is too long. Please keep it under ${JOB_DESCRIPTION_MAX_CHARS.toLocaleString()} characters.`,
      )
      setEntered(false)
      return
    }
    setError('')
    setEntered(true)
    track(AcqEvent.RESUME_TAILOR_TARGET_ENTERED, { hasResume, jdChars: v.length })
  }

  return (
    <div>
      {/* 1) Resume entry (optional here; required by the engine later) */}
      <div style={{ fontSize: 13, fontWeight: 800, color: '#374151', marginBottom: 8 }}>1 · Add your resume</div>
      <ResumeFilePicker
        onFileReady={(f, ext) => { setHasResume(true); track(AcqEvent.RESUME_FILE_SELECTED, { mode: 'tailor', ext, size: f.size }) }}
        onClear={() => setHasResume(false)}
        prompt="PDF, DOC or DOCX · up to 5 MB · not uploaded or stored"
      />

      {/* 2) Target job description */}
      <div style={{ fontSize: 13, fontWeight: 800, color: '#374151', margin: '20px 0 8px' }}>2 · Paste the job you’re targeting</div>
      <label htmlFor="tailor-jd" style={{ display: 'block', color: '#6b7280', fontSize: 12.5, marginBottom: 6 }}>
        Paste the full job description below. Prefer a real role?{' '}
        <Link href="/jobs/private" style={{ color: '#1847d4', fontWeight: 700 }}>Browse genuine Noble Job vacancies</Link> and copy one here.
      </label>
      <textarea
        id="tailor-jd"
        value={jd}
        onChange={e => { setJd(e.target.value); if (error) setError('') }}
        rows={6}
        placeholder="Paste the job description (responsibilities, requirements, skills)…"
        aria-invalid={!!error || over}
        aria-describedby="tailor-jd-help"
        style={{
          width: '100%', resize: 'vertical', minHeight: 120, padding: '11px 13px', fontSize: 13.5,
          borderRadius: 10, border: `1.5px solid ${error || over ? '#fca5a5' : '#cbd5e1'}`,
          fontFamily: 'inherit', lineHeight: 1.5, background: '#fff', color: '#0d1f4e',
        }}
      />
      <div id="tailor-jd-help" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 6 }}>
        <span style={{ color: error ? '#be123c' : '#9ca3af', fontSize: 11.5 }} role={error ? 'alert' : undefined}>
          {error || 'Only your verified facts are used — never invented experience or qualifications.'}
        </span>
        <span style={{ color: over ? '#be123c' : '#9ca3af', fontSize: 11.5, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
          {jd.length.toLocaleString()} / {JOB_DESCRIPTION_MAX_CHARS.toLocaleString()}
        </span>
      </div>

      <div style={{ marginTop: 14 }}>
        <button type="button" onClick={onContinue} disabled={over} style={{ ...primaryBtn, opacity: over ? 0.6 : 1 }}>
          Continue
        </button>
      </div>

      {entered && (
        <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'flex-start', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '13px 15px' }} aria-live="polite">
          <span aria-hidden style={{ fontSize: 15 }}>✅</span>
          <p style={{ margin: 0, color: '#065f46', fontSize: 13, lineHeight: 1.6 }}>
            Target captured{hasResume ? ' with your resume' : ''}. When the tailoring engine ships, Noble Resume AI will compare this role against your verified experience and emphasise genuine, matching strengths — no invented experience, ever.
          </p>
        </div>
      )}
    </div>
  )
}

const primaryBtn = {
  display: 'inline-block', background: '#1847d4', color: '#fff', border: 'none',
  borderRadius: 10, padding: '11px 20px', fontWeight: 800, fontSize: 14, cursor: 'pointer',
} as const
