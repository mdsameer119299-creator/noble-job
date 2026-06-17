'use client'
import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/useToast'

type Settings = {
  notify_applications: boolean
  notify_interviews: boolean
  notify_messages: boolean
}

const ITEMS: { key: keyof Settings; label: string; desc: string }[] = [
  { key: 'notify_applications', label: 'New applications', desc: 'Email me when a candidate applies to one of my jobs' },
  { key: 'notify_interviews', label: 'Interviews', desc: 'Email me about interview schedule changes' },
  { key: 'notify_messages', label: 'Messages', desc: 'Email me when a candidate sends a message' },
]

export function NotificationToggles() {
  const [settings, setSettings] = useState<Settings>({ notify_applications: true, notify_interviews: true, notify_messages: true })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const load = () => {
    setLoading(true)
    setError(false)
    fetch('/api/employer/settings')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => setSettings({
        notify_applications: d.data?.notify_applications ?? true,
        notify_interviews: d.data?.notify_interviews ?? true,
        notify_messages: d.data?.notify_messages ?? true,
      }))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const toggle = async (key: keyof Settings) => {
    const next = { ...settings, [key]: !settings[key] }
    setSettings(next)
    setSaving(true)
    try {
      const res = await fetch('/api/employer/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      if (!res.ok) { toast.error('Could not save'); setSettings(settings) }
    } finally { setSaving(false) }
  }

  if (loading) return <p style={{ color: '#6b7280', fontSize: 13 }}>Loading notifications…</p>
  if (error) return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 20 }}>
      <p style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>Could not load settings.</p>
      <button type="button" onClick={load} style={{ background: '#1847d4', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>Retry</button>
    </div>
  )

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 8, maxWidth: 560 }}>
      {ITEMS.map(it => (
        <div key={it.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid #f0f4ff', gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0d1f4e' }}>{it.label}</div>
            <div style={{ fontSize: 12.5, color: '#6b7280' }}>{it.desc}</div>
          </div>
          <button type="button" role="switch" aria-checked={settings[it.key]} onClick={() => toggle(it.key)} disabled={saving}
            style={{ width: 44, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer', flexShrink: 0, background: settings[it.key] ? '#1847d4' : '#cbd5e1', position: 'relative', transition: 'background .2s' }}>
            <span style={{ position: 'absolute', top: 3, left: settings[it.key] ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
          </button>
        </div>
      ))}
    </div>
  )
}
