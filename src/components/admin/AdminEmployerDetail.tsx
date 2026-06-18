'use client'
import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/useToast'

type Employer = {
  id: string
  company_name?: string
  website?: string
  industry?: string
  company_size?: string
  city?: string
  designation?: string
  gst_number?: string
  description?: string
  status?: string
  verified?: boolean
  users?: { email?: string; status?: string; created_at?: string }
}
type Stats = { jobs: number; applications: number; candidates: number }

export function AdminEmployerDetail({ id }: { id: string }) {
  const [emp, setEmp] = useState<Employer | null>(null)
  const [stats, setStats] = useState<Stats>({ jobs: 0, applications: 0, candidates: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const load = () => {
    setLoading(true)
    setError(false)
    fetch(`/api/admin/employers/${id}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => { setEmp(d.data); setStats(d.stats || { jobs: 0, applications: 0, candidates: 0 }) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleStatus = async () => {
    if (!emp) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/employers/${id}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentStatus: emp.status }),
      })
      if (res.ok) { toast.success('Status updated'); load() } else toast.error('Failed')
    } finally { setBusy(false) }
  }

  const verify = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/employers/${id}/verify`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      if (res.ok) { toast.success('Employer verified'); load() } else toast.error('Failed')
    } finally { setBusy(false) }
  }

  if (loading) return <p style={{ color: '#6b7280', fontSize: 13 }}>Loading employer…</p>
  if (error || !emp) return (
    <div style={card}>
      <p style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>Could not load this employer.</p>
      <button type="button" onClick={load} style={primary}>Retry</button>
    </div>
  )

  const isActive = emp.status === 'active'

  return (
    <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h2 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 22, margin: 0 }}>{emp.company_name || 'Employer'}</h2>
            <p style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>{[emp.industry, emp.city].filter(Boolean).join(' · ')}</p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={badge(isActive ? '#15803d' : '#dc2626', isActive ? '#f0fdf4' : '#fef2f2')}>{emp.status}</span>
            {emp.verified && <span style={badge('#1847d4', '#eff6ff')}>✓ Verified</span>}
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <Field label="Email" value={emp.users?.email} />
          <Field label="Contact / designation" value={emp.designation} />
          <Field label="Website" value={emp.website} />
          <Field label="Company size" value={emp.company_size} />
          <Field label="GST number" value={emp.gst_number} />
          <Field label="Joined" value={emp.users?.created_at ? new Date(emp.users.created_at).toLocaleDateString() : undefined} />
        </div>
      </div>

      <div className="grid-resp-3" style={{ display: 'grid', gap: 12 }}>
        <Stat label="Jobs posted" value={stats.jobs} />
        <Stat label="Applications" value={stats.applications} />
        <Stat label="Candidates" value={stats.candidates} />
      </div>

      <div style={{ ...card, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={toggleStatus} disabled={busy} style={isActive ? danger : primary}>
          {isActive ? 'Suspend employer' : 'Activate employer'}
        </button>
        {!emp.verified && (
          <button type="button" onClick={verify} disabled={busy} style={{ ...primary, background: '#7c3aed' }}>Verify employer</button>
        )}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f4ff', fontSize: 13 }}>
      <span style={{ color: '#6b7280', fontWeight: 600 }}>{label}</span>
      <span style={{ color: '#0d1f4e', fontWeight: 700, textAlign: 'right' }}>{value || '—'}</span>
    </div>
  )
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ ...card, textAlign: 'center', padding: 16 }}>
      <div style={{ fontFamily: 'Playfair Display,serif', fontSize: 26, fontWeight: 900, color: '#1847d4' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginTop: 4 }}>{label}</div>
    </div>
  )
}

const card: React.CSSProperties = { background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 20 }
const primary: React.CSSProperties = { background: '#1847d4', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }
const danger: React.CSSProperties = { background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fca5a5', padding: '10px 18px', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }
const badge = (color: string, bg: string): React.CSSProperties => ({ background: bg, color, padding: '4px 10px', borderRadius: 12, fontSize: 11.5, fontWeight: 800 })
