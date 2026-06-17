'use client'
import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/useToast'

type Profile = {
  company_name?: string
  website?: string
  industry?: string
  company_size?: string
  city?: string
  designation?: string
  gst_number?: string
  description?: string
}

const FIELDS: { key: keyof Profile; label: string; textarea?: boolean }[] = [
  { key: 'company_name', label: 'Company name' },
  { key: 'website', label: 'Website' },
  { key: 'industry', label: 'Industry' },
  { key: 'company_size', label: 'Company size' },
  { key: 'city', label: 'City' },
  { key: 'designation', label: 'Your designation' },
  { key: 'gst_number', label: 'GST number' },
  { key: 'description', label: 'About the company', textarea: true },
]

export function CompanyProfileForm() {
  const [form, setForm] = useState<Profile>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const load = () => {
    setLoading(true)
    setError(false)
    fetch('/api/employer/profile')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => setForm(d.data || {}))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/employer/profile', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: form[f.key] ?? null }), {} as Profile)
        ),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok && d.success !== false) toast.success('Company profile saved')
      else toast.error('Save failed')
    } finally { setSaving(false) }
  }

  if (loading) return <p style={{ color: '#6b7280', fontSize: 13 }}>Loading company profile…</p>
  if (error) return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 20 }}>
      <p style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>Could not load your profile.</p>
      <button type="button" onClick={load} style={primary}>Retry</button>
    </div>
  )

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 24, maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {FIELDS.map(f => (
        <div key={f.key}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0d1f4e', marginBottom: 6 }}>{f.label}</label>
          {f.textarea ? (
            <textarea value={form[f.key] || ''} onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))}
              style={{ width: '100%', minHeight: 90, border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          ) : (
            <input value={form[f.key] || ''} onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))}
              style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, boxSizing: 'border-box' }} />
          )}
        </div>
      ))}
      <button type="button" onClick={save} disabled={saving} style={{ ...primary, padding: '12px', marginTop: 4 }}>
        {saving ? 'Saving…' : 'Save company profile'}
      </button>
    </div>
  )
}

const primary: React.CSSProperties = { background: '#1847d4', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }
