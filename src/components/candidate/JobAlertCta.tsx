'use client'

import { useState } from 'react'
import { track, AcqEvent } from '@/lib/analytics/events'

interface JobAlertCtaProps {
  /** Heading shown above the input. */
  title?: string
  /** Context passed to the alert so the digest is relevant to the page. */
  keywords?: string
  location?: string
  category?: string
  board?: 'all' | 'private' | 'govt' | 'abroad' | 'wfh'
  compact?: boolean
}

/**
 * "Get Jobs Like This Daily" — anonymous email capture for a daily/weekly job
 * alert. Posts to /api/alerts (which accepts a null user), so a visitor can
 * subscribe without an account. A resume-acquisition-first surface.
 */
export function JobAlertCta({
  title = 'Get Matching Jobs by Email',
  keywords,
  location,
  category,
  board = 'all',
  compact = false,
}: JobAlertCtaProps) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setState('error')
      setMsg('Please enter a valid email.')
      return
    }
    setState('busy')
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, keywords, location, category, board, frequency: 'daily' }),
      })
      const ok = res.ok && (await res.json().catch(() => ({}))).success !== false
      if (!ok) throw new Error('failed')
      setState('done')
      track(AcqEvent.JOB_ALERT_SUBSCRIBED, { board, hasKeywords: Boolean(keywords), location: location ?? '' })
    } catch {
      setState('error')
      setMsg('Could not subscribe right now. Please try again.')
    }
  }

  if (state === 'done') {
    return (
      <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: '14px 16px', color: '#15803d', fontWeight: 700, fontSize: 13.5 }}>
        ✓ You're subscribed. We'll email matching jobs daily.
      </div>
    )
  }

  return (
    <form onSubmit={submit} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: compact ? '12px 14px' : '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontWeight: 800, color: '#0d1f4e', fontSize: compact ? 14 : 15.5, fontFamily: 'Playfair Display,serif' }}>
          📬 {title}
        </span>
        <span style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 999, padding: '2px 8px', fontSize: 10.5, fontWeight: 700 }}>
          📱 WhatsApp — coming soon
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="email"
          value={email}
          onChange={e => { setEmail(e.target.value); if (state === 'error') setState('idle') }}
          placeholder="you@email.com"
          aria-label="Email for job alerts"
          style={{ flex: '1 1 180px', minWidth: 0, padding: '10px 12px', borderRadius: 9, border: '1.5px solid #cbd5e1', fontSize: 14 }}
        />
        <button type="submit" disabled={state === 'busy'}
          style={{ background: '#1847d4', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 18px', fontWeight: 800, fontSize: 13.5, cursor: state === 'busy' ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
          {state === 'busy' ? 'Subscribing…' : 'Notify Me'}
        </button>
      </div>
      {state === 'error' && <div style={{ color: '#be123c', fontSize: 12.5, marginTop: 6 }}>{msg}</div>}
      <div style={{ color: '#6b7280', fontSize: 11.5, marginTop: 6 }}>Free · unsubscribe anytime · no spam.</div>
    </form>
  )
}
