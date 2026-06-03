'use client'
import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/useToast'

export function PersonalInfoForm() {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    city: '',
    category: '',
    experience_years: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    fetch('/api/candidate/profile')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        const p = d?.data || {}
        setForm({
          first_name: p.first_name || '',
          last_name: p.last_name || '',
          phone: p.phone || '',
          city: p.city || '',
          category: p.category || '',
          experience_years: String(p.experience_years ?? ''),
        })
      })
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    const res = await fetch('/api/candidate/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        experience_years: form.experience_years ? Number(form.experience_years) : null,
      }),
    })
    setSaving(false)
    if (res.ok) toast.success('Profile saved')
    else toast.error('Save failed')
  }

  if (loading) return <p style={{ color: '#6b7280', fontSize: 13 }}>Loading profile…</p>

  const field = (label: string, key: keyof typeof form) => (
    <div key={key}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0d1f4e', marginBottom: 6 }}>{label}</label>
      <input
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        style={{
          width: '100%',
          border: '1.5px solid #e2e8f0',
          borderRadius: 10,
          padding: '11px 14px',
          fontSize: 14,
          boxSizing: 'border-box',
        }}
      />
    </div>
  )

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 24, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 480 }}>
      {field('First name', 'first_name')}
      {field('Last name', 'last_name')}
      {field('Phone', 'phone')}
      {field('City', 'city')}
      {field('Job category', 'category')}
      {field('Years of experience', 'experience_years')}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        style={{ background: '#1847d4', color: '#fff', border: 'none', padding: '12px', borderRadius: 10, fontWeight: 800, cursor: 'pointer', marginTop: 8 }}
      >
        {saving ? 'Saving…' : 'Save profile'}
      </button>
    </div>
  )
}
