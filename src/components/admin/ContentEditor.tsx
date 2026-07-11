'use client'

import { useEffect, useState } from 'react'

/**
 * Site Content editor. Loads the seeded site_content rows (GET /api/admin/content)
 * and saves edits via PUT /api/admin/content (safe UPSERT, server-validated).
 * Covers loading / error / empty / saving / saved states.
 */

// The seeded, meaningful site_content keys (schema 20250603000001). We edit these
// known fields rather than inventing arbitrary content keys.
const FIELDS: Array<{ key: string; label: string; type: 'text' | 'textarea' | 'email' | 'tel' }> = [
  { key: 'sitename', label: 'Site name', type: 'text' },
  { key: 'tagline', label: 'Tagline', type: 'text' },
  { key: 'hero_text', label: 'Homepage hero text', type: 'textarea' },
  { key: 'contact_email', label: 'Contact email', type: 'email' },
  { key: 'contact_phone', label: 'Contact phone', type: 'tel' },
  { key: 'address', label: 'Address', type: 'textarea' },
  { key: 'ncc_banner', label: 'NCC banner text', type: 'textarea' },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function ContentEditor() {
  const [values, setValues] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [fieldError, setFieldError] = useState<Record<string, string>>({})

  useEffect(() => { void load() }, [])

  async function load() {
    setStatus('loading')
    setLoadError('')
    try {
      const res = await fetch('/api/admin/content')
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setStatus('error'); setLoadError(json?.error || 'Failed to load content'); return }
      setValues((json.data || {}) as Record<string, string>)
      setStatus('ready')
    } catch {
      setStatus('error'); setLoadError('Network error while loading content')
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    for (const f of FIELDS) {
      const v = (values[f.key] || '').trim()
      if (!v) { errs[f.key] = 'This field cannot be empty'; continue }
      if (f.type === 'email' && !EMAIL_RE.test(v)) errs[f.key] = 'Enter a valid email address'
      if (v.length > 20000) errs[f.key] = 'Too long (max 20,000 characters)'
    }
    setFieldError(errs)
    return Object.keys(errs).length === 0
  }

  async function save() {
    setSaveMsg(null)
    if (!validate()) return
    setSaving(true)
    try {
      const payload: Record<string, string> = {}
      for (const f of FIELDS) payload[f.key] = (values[f.key] || '').trim()
      const res = await fetch('/api/admin/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) {
        setSaveMsg({ ok: false, text: json?.error || 'Failed to save content' })
      } else {
        setSaveMsg({ ok: true, text: 'Content saved' })
      }
    } catch {
      setSaveMsg({ ok: false, text: 'Network error while saving' })
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading') return <Card><p style={muted}>Loading content…</p></Card>
  if (status === 'error') return (
    <Card>
      <p style={{ color: '#be123c', fontSize: 13.5, marginBottom: 10 }} role="alert">{loadError}</p>
      <button onClick={load} style={btnSecondary}>Retry</button>
    </Card>
  )

  return (
    <Card>
      <h3 style={heading}>📝 Edit Site Content</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {FIELDS.map(f => (
          <label key={f.key} style={{ display: 'block' }}>
            <span style={labelText}>{f.label}</span>
            {f.type === 'textarea' ? (
              <textarea
                value={values[f.key] || ''}
                onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                rows={2}
                aria-invalid={!!fieldError[f.key]}
                style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }}
              />
            ) : (
              <input
                type={f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : 'text'}
                value={values[f.key] || ''}
                onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                aria-invalid={!!fieldError[f.key]}
                style={input}
              />
            )}
            {fieldError[f.key] && <span style={errText} role="alert">{fieldError[f.key]}</span>}
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
        <button onClick={save} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {saveMsg && (
          <span role="status" style={{ fontSize: 13, fontWeight: 700, color: saveMsg.ok ? '#059669' : '#be123c' }}>
            {saveMsg.ok ? '✓ ' : ''}{saveMsg.text}
          </span>
        )}
      </div>
    </Card>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 20, marginBottom: 16, maxWidth: 640 }}>{children}</div>
}

const heading = { fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 15, marginTop: 0, marginBottom: 14 } as const
const labelText = { display: 'block', fontSize: 12.5, fontWeight: 700, color: '#374151', marginBottom: 5 } as const
const input = { width: '100%', padding: '9px 12px', fontSize: 13.5, borderRadius: 9, border: '1.5px solid #cbd5e1', background: '#fff', color: '#0d1f4e' } as const
const errText = { display: 'block', color: '#be123c', fontSize: 11.5, marginTop: 4 } as const
const muted = { color: '#6b7280', fontSize: 13 } as const
const btnPrimary = { background: '#1847d4', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 18px', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' } as const
const btnSecondary = { background: '#fff', color: '#1847d4', border: '1.5px solid #cbd5e1', borderRadius: 9, padding: '8px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' } as const
