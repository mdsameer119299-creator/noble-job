'use client'

import { useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { RESUME_BUILD_SECTIONS } from '@/lib/resume/resumeWorkspace'
import { track, AcqEvent } from '@/lib/analytics/events'

/**
 * Build entry flow: choose a starting method, then land in a truthful pre-engine
 * state. Two methods:
 *   • Start from scratch — no data needed.
 *   • Use my saved Noble Job details — lazily calls the EXISTING production API
 *     (GET /api/candidate/profile). 401 → offer sign-in; 200 → show which real
 *     details are available to prefill later.
 *
 * No editor is built and no incomplete resume is saved in this PR. Anonymous
 * users can explore freely; auth is requested ONLY for the saved-details path.
 */

type SavedProfile = {
  first_name?: string | null
  last_name?: string | null
  city?: string | null
  state?: string | null
  skills?: string[] | null
  experience_years?: number | null
}

export function BuildFlow() {
  const [method, setMethod] = useState<'none' | 'scratch' | 'saved'>('none')
  const [savedState, setSavedState] = useState<'idle' | 'busy' | 'ready' | 'signin' | 'empty' | 'error'>('idle')
  const [profile, setProfile] = useState<SavedProfile | null>(null)

  function chooseScratch() {
    setMethod('scratch')
    track(AcqEvent.RESUME_BUILD_METHOD_SELECTED, { method: 'scratch' })
  }

  async function chooseSaved() {
    setMethod('saved')
    setSavedState('busy')
    // Guard against a hung request leaving a permanent "Checking…" spinner:
    // abort after 12s so the flow falls back to the graceful error state.
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 12000)
    try {
      const res = await fetch('/api/candidate/profile', { headers: { Accept: 'application/json' }, signal: ctrl.signal })
      // 401 → not signed in; all other non-OK (403/404/500/503) fall through to
      // the graceful error state, which always offers "start from scratch".
      if (res.status === 401) {
        setSavedState('signin')
        track(AcqEvent.RESUME_SIGNIN_REQUESTED, { mode: 'build', reason: 'saved-data' })
        return
      }
      if (!res.ok) {
        setSavedState('error')
        return
      }
      const json = await res.json().catch(() => ({}))
      const p = (json?.data ?? null) as SavedProfile | null
      const hasAny = !!(p && (p.first_name || p.skills?.length || p.city || p.experience_years))
      setProfile(p)
      setSavedState(hasAny ? 'ready' : 'empty')
      track(AcqEvent.RESUME_BUILD_METHOD_SELECTED, { method: 'saved' })
    } catch {
      // Network failure or timeout/abort → graceful error (never a dead end).
      setSavedState('error')
    } finally {
      clearTimeout(timer)
    }
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#374151', marginBottom: 8 }}>How would you like to start?</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
        <button
          type="button"
          onClick={chooseScratch}
          aria-pressed={method === 'scratch'}
          style={methodCard(method === 'scratch')}
        >
          <span style={{ fontSize: 22 }} aria-hidden>📝</span>
          <span style={methodTitle}>Start from scratch</span>
          <span style={methodSub}>Build a fresh resume, section by section</span>
        </button>
        <button
          type="button"
          onClick={chooseSaved}
          aria-pressed={method === 'saved'}
          style={methodCard(method === 'saved')}
        >
          <span style={{ fontSize: 22 }} aria-hidden>👤</span>
          <span style={methodTitle}>Use my saved Noble Job details</span>
          <span style={methodSub}>Prefill from your candidate profile</span>
        </button>
      </div>

      {/* Saved-details states */}
      {method === 'saved' && (
        <div style={{ marginTop: 14 }} aria-live="polite">
          {savedState === 'busy' && <p style={muted}>Checking your Noble Job account…</p>}
          {savedState === 'signin' && (
            <div style={infoBox}>
              <p style={{ margin: '0 0 10px', color: '#374151', fontSize: 13.5 }}>
                Sign in to your Noble Job candidate account to reuse your saved details. Nothing is drafted yet.
              </p>
              <Link href="/auth?role=candidate&reason=resume-build" style={primaryLink}>Sign in to continue →</Link>
            </div>
          )}
          {savedState === 'empty' && (
            <div style={infoBox}>
              <p style={{ margin: 0, color: '#374151', fontSize: 13.5 }}>
                You’re signed in, but your candidate profile doesn’t have saved details yet. You can start from scratch, or add details to your profile first.
              </p>
              <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button type="button" onClick={chooseScratch} style={primaryLink}>Start from scratch →</button>
                <Link href="/candidate/profile" style={secondaryLink}>Edit my profile</Link>
              </div>
            </div>
          )}
          {savedState === 'error' && (
            <div role="alert" style={infoBox}>
              <p style={{ margin: 0, color: '#be123c', fontSize: 13.5 }}>We couldn’t load your saved details right now. You can start from scratch instead.</p>
            </div>
          )}
          {savedState === 'ready' && profile && (
            <div style={{ ...infoBox, borderColor: '#bbf7d0', background: '#f0fdf4' }}>
              <div style={{ fontWeight: 800, color: '#065f46', fontSize: 13 }}>Details we can use to get you started</div>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: '#065f46', fontSize: 12.8, lineHeight: 1.7 }}>
                {(profile.first_name || profile.last_name) && <li>Name: {[profile.first_name, profile.last_name].filter(Boolean).join(' ')}</li>}
                {(profile.city || profile.state) && <li>Location: {[profile.city, profile.state].filter(Boolean).join(', ')}</li>}
                {typeof profile.experience_years === 'number' && <li>Experience: {profile.experience_years} year(s)</li>}
                {profile.skills?.length ? <li>{profile.skills.length} skill(s) on file</li> : null}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Scratch confirmation */}
      {method === 'scratch' && (
        <div style={{ ...infoBox, marginTop: 14 }} aria-live="polite">
          <p style={{ margin: 0, color: '#374151', fontSize: 13.5 }}>
            Great — you’ll build your resume section by section. The guided builder opens here when the engine ships.
          </p>
        </div>
      )}

      {/* Planned sections (display-only) */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#374151', marginBottom: 8 }}>Your resume will include</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {RESUME_BUILD_SECTIONS.map((s, i) => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 999, padding: '5px 11px', fontSize: 12, color: '#475569', fontWeight: 600 }}>
              <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: 11 }}>{i + 1}</span>{s}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

const methodCard = (active: boolean): CSSProperties => ({
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, textAlign: 'left',
  width: '100%', cursor: 'pointer', font: 'inherit',
  background: active ? '#eff6ff' : '#fff',
  border: `1.5px solid ${active ? '#1847d4' : '#dbe4ff'}`, borderRadius: 12, padding: '14px 15px',
})
const methodTitle = { fontWeight: 800, color: '#0d1f4e', fontSize: 14 } as const
const methodSub = { color: '#6b7280', fontSize: 12 } as const
const muted = { color: '#6b7280', fontSize: 13 } as const
const infoBox = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '13px 15px' } as const
const primaryLink = { display: 'inline-block', background: '#1847d4', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 15px', fontWeight: 800, fontSize: 13.5, textDecoration: 'none', cursor: 'pointer' } as const
const secondaryLink = { display: 'inline-block', color: '#1847d4', fontWeight: 700, fontSize: 13.5, textDecoration: 'none', padding: '9px 4px' } as const
