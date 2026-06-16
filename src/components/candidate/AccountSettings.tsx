'use client'
import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/useToast'
import { useAsyncData } from '@/hooks/useAsyncData'
import { LoadingState, ErrorState, PanelCard } from './AsyncStates'
import { LogoutButton } from './LogoutButton'

type Profile = {
  phone: string | null
  city: string | null
  state: string | null
  category: string | null
}

export function AccountSettings() {
  const { data, loading, error, reload } = useAsyncData<Profile>('/api/candidate/profile')
  const [form, setForm] = useState<Profile>({ phone: '', city: '', state: '', category: '' })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (data) {
      setForm({
        phone: data.phone || '',
        city: data.city || '',
        state: data.state || '',
        category: data.category || '',
      })
    }
  }, [data])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/candidate/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) toast.success('Settings saved')
      else toast.error('Save failed')
    } catch {
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState label="Loading account settings…" />
  if (error) return <ErrorState onRetry={reload} message={error} />

  const field = (label: string, key: keyof Profile) => (
    <div key={key}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0d1f4e', marginBottom: 6 }}>{label}</label>
      <input
        value={form[key] || ''}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, boxSizing: 'border-box' }}
      />
    </div>
  )

  return (
    <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PanelCard>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {field('Phone', 'phone')}
          {field('City', 'city')}
          {field('State', 'state')}
          {field('Job category', 'category')}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            style={{ background: '#1847d4', color: '#fff', border: 'none', padding: '12px', borderRadius: 10, fontWeight: 800, cursor: saving ? 'wait' : 'pointer', marginTop: 4 }}
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </PanelCard>

      <PanelCard>
        <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 15, marginBottom: 10 }}>
          Session
        </h3>
        <LogoutButton />
      </PanelCard>
    </div>
  )
}
