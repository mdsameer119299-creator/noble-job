'use client'

import { useEffect, useState } from 'react'

const KEY = 'synthetic_jobs_visible'

/**
 * Dedicated ON/OFF control for the synthetic/demo job catalog (private, WFH,
 * abroad), separate from the generic key/value SettingsForm since this one
 * flag matters enough to deserve its own labeled switch. Reuses the same
 * /api/admin/settings GET/PUT the generic form uses.
 */
export function SyntheticJobsToggle() {
  const [visible, setVisible] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { void load() }, [])

  async function load() {
    setError('')
    try {
      const res = await fetch('/api/admin/settings')
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json?.error || 'Failed to load setting'); setVisible(true); return }
      const data = (json.data || {}) as Record<string, string>
      setVisible(data[KEY] !== 'false')
    } catch {
      setError('Network error while loading setting')
      setVisible(true)
    }
  }

  async function toggle() {
    if (visible === null || saving) return
    const next = !visible
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [KEY]: String(next) }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) { setError(json?.error || 'Failed to save setting'); return }
      setVisible(next)
    } catch {
      setError('Network error while saving')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={card}>
      <h3 style={heading}>🧪 Synthetic / Demo Job Listings</h3>
      <p style={{ ...muted, marginBottom: 14 }}>
        Controls whether the generated demo job catalog (private, WFH, abroad) is shown to visitors.
        These listings are always excluded from Google indexing and JobPosting schema regardless of
        this switch — it only controls visitor-facing visibility.
      </p>
      {visible === null ? (
        <p style={muted}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            role="switch"
            aria-checked={visible}
            aria-label="Synthetic job listings visible to visitors"
            onClick={toggle}
            disabled={saving}
            style={{
              width: 46,
              height: 26,
              borderRadius: 100,
              border: 'none',
              background: visible ? '#15803d' : '#cbd5e1',
              position: 'relative',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              flexShrink: 0,
              transition: 'background .2s',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 3,
                left: visible ? 23 : 3,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#fff',
                transition: 'left .2s',
                boxShadow: '0 1px 3px rgba(0,0,0,.3)',
              }}
            />
          </button>
          <span style={{ fontWeight: 800, fontSize: 13.5, color: visible ? '#15803d' : '#64748b' }}>
            {visible ? 'ON — visible to visitors' : 'OFF — hidden from visitors'}
          </span>
        </div>
      )}
      {error && <p style={{ color: '#be123c', fontSize: 12, marginTop: 8 }} role="alert">{error}</p>}
    </div>
  )
}

const card = { background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 20, marginBottom: 16, maxWidth: 640 } as const
const heading = { fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 15, marginTop: 0, marginBottom: 10 } as const
const muted = { color: '#6b7280', fontSize: 13, lineHeight: 1.5 } as const
