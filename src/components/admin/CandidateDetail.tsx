'use client'
import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/useToast'

type Candidate = {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  city: string | null
  state: string | null
  category: string | null
  experience_years: string | null
  expected_salary: number | null
  skills: string[] | null
  profile_score: number | null
  resume_url: string | null
  users?: { email: string; status: string; created_at: string }
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  border: '1.5px solid #e2e8f0',
  padding: 20,
  marginBottom: 16,
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f4ff', fontSize: 13 }}>
      <span style={{ color: '#6b7280', fontWeight: 600 }}>{label}</span>
      <span style={{ color: '#0d1f4e', fontWeight: 700, textAlign: 'right' }}>{value || '—'}</span>
    </div>
  )
}

export function CandidateDetail({ id }: { id: string }) {
  const [c, setC] = useState<Candidate | null>(null)
  const [loading, setLoading] = useState(true)
  const [resumeLoading, setResumeLoading] = useState(false)
  const toast = useToast()

  useEffect(() => {
    fetch(`/api/admin/candidates/${id}`)
      .then(r => (r.ok ? r.json() : { data: null }))
      .then(d => setC(d.data))
      .finally(() => setLoading(false))
  }, [id])

  const openResume = async () => {
    setResumeLoading(true)
    try {
      const res = await fetch(`/api/admin/candidates/${id}/resume-url`)
      const d = await res.json()
      if (res.ok && d.url) window.open(d.url, '_blank', 'noopener,noreferrer')
      else toast.error(d.error || 'Resume not available')
    } finally {
      setResumeLoading(false)
    }
  }

  if (loading) return <p style={{ color: '#6b7280', fontSize: 13 }}>Loading candidate…</p>
  if (!c) return <p style={{ color: '#6b7280', fontSize: 13 }}>Candidate not found.</p>

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={cardStyle}>
        <h2 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 22, marginBottom: 4 }}>
          {c.first_name} {c.last_name}
        </h2>
        <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 12 }}>{c.users?.email}</p>
        <Field label="Phone" value={c.phone} />
        <Field label="Location" value={[c.city, c.state].filter(Boolean).join(', ')} />
        <Field label="Category" value={c.category} />
        <Field label="Experience" value={c.experience_years} />
        <Field label="Expected salary" value={c.expected_salary ? `₹${c.expected_salary}` : ''} />
        <Field label="Skills" value={(c.skills || []).join(', ')} />
        <Field label="Profile score" value={`${c.profile_score ?? 0}%`} />
        <Field label="Account status" value={c.users?.status} />
      </div>

      <div style={cardStyle}>
        <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 15, marginBottom: 10 }}>
          Resume
        </h3>
        {c.resume_url ? (
          <button
            type="button"
            onClick={openResume}
            disabled={resumeLoading}
            style={{ background: '#1847d4', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
          >
            {resumeLoading ? 'Opening…' : 'Open / Download resume'}
          </button>
        ) : (
          <p style={{ color: '#6b7280', fontSize: 13 }}>No resume on file.</p>
        )}
      </div>
    </div>
  )
}
