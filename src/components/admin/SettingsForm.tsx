'use client'

import { useEffect, useState } from 'react'

/**
 * Admin settings editor. admin_settings is a generic key/value store with no
 * predefined schema (nothing in the app consumes fixed keys yet), so this is a
 * generic editor: it loads existing settings (GET /api/admin/settings), lets an
 * admin edit values or add new key/value pairs, and saves via PUT (safe UPSERT,
 * server-validated). Covers loading / error / empty / saving / saved states.
 */

type Row = { key: string; value: string }

export function SettingsForm() {
  const [rows, setRows] = useState<Row[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [formError, setFormError] = useState('')

  useEffect(() => { void load() }, [])

  async function load() {
    setStatus('loading'); setLoadError('')
    try {
      const res = await fetch('/api/admin/settings')
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setStatus('error'); setLoadError(json?.error || 'Failed to load settings'); return }
      const data = (json.data || {}) as Record<string, string>
      setRows(Object.entries(data).map(([key, value]) => ({ key, value: String(value) })))
      setStatus('ready')
    } catch {
      setStatus('error'); setLoadError('Network error while loading settings')
    }
  }

  function addRow() { setRows(r => [...r, { key: '', value: '' }]) }
  function removeRow(i: number) { setRows(r => r.filter((_, idx) => idx !== i)) }
  function update(i: number, field: 'key' | 'value', val: string) {
    setRows(r => r.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)))
  }

  function validate(): Record<string, string> | null {
    const payload: Record<string, string> = {}
    const seen = new Set<string>()
    for (const row of rows) {
      const k = row.key.trim()
      if (!k) { setFormError('Every setting needs a key'); return null }
      if (k.length > 64) { setFormError(`Key "${k.slice(0, 20)}…" is too long (max 64)`); return null }
      if (seen.has(k)) { setFormError(`Duplicate key "${k}"`); return null }
      seen.add(k)
      payload[k] = row.value
    }
    setFormError('')
    return payload
  }

  async function save() {
    setSaveMsg(null)
    const payload = validate()
    if (!payload) return
    if (Object.keys(payload).length === 0) { setSaveMsg({ ok: false, text: 'Add at least one setting first' }); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) setSaveMsg({ ok: false, text: json?.error || 'Failed to save settings' })
      else setSaveMsg({ ok: true, text: `Saved ${json.updated ?? Object.keys(payload).length} setting(s)` })
    } catch {
      setSaveMsg({ ok: false, text: 'Network error while saving' })
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading') return <Card><p style={muted}>Loading settings…</p></Card>
  if (status === 'error') return (
    <Card>
      <p style={{ color: '#be123c', fontSize: 13.5, marginBottom: 10 }} role="alert">{loadError}</p>
      <button onClick={load} style={btnSecondary}>Retry</button>
    </Card>
  )

  return (
    <Card>
      <h3 style={heading}>⚙️ Admin Settings</h3>
      {rows.length === 0 ? (
        <p style={{ ...muted, marginBottom: 12 }}>No settings defined yet. Add a key/value pair to get started.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {rows.map((row, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={row.key} onChange={e => update(i, 'key', e.target.value)} placeholder="key"
                aria-label={`Setting ${i + 1} key`} style={{ ...input, flex: '0 0 200px' }} />
              <input value={row.value} onChange={e => update(i, 'value', e.target.value)} placeholder="value"
                aria-label={`Setting ${i + 1} value`} style={{ ...input, flex: 1 }} />
              <button onClick={() => removeRow(i)} aria-label={`Remove setting ${row.key || i + 1}`} style={btnRemove}>×</button>
            </div>
          ))}
        </div>
      )}
      {formError && <p style={{ color: '#be123c', fontSize: 12, margin: '0 0 10px' }} role="alert">{formError}</p>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={addRow} style={btnSecondary}>+ Add setting</button>
        <button onClick={save} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving…' : 'Save settings'}
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
const input = { padding: '9px 12px', fontSize: 13.5, borderRadius: 9, border: '1.5px solid #cbd5e1', background: '#fff', color: '#0d1f4e', minWidth: 0 } as const
const muted = { color: '#6b7280', fontSize: 13 } as const
const btnPrimary = { background: '#1847d4', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 18px', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' } as const
const btnSecondary = { background: '#fff', color: '#1847d4', border: '1.5px solid #cbd5e1', borderRadius: 9, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' } as const
const btnRemove = { background: '#fef2f2', color: '#be123c', border: '1.5px solid #fecaca', borderRadius: 8, width: 34, height: 34, flexShrink: 0, cursor: 'pointer', fontSize: 18, lineHeight: 1 } as const
