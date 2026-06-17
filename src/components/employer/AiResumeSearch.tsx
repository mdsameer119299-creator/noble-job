'use client'
import { useState } from 'react'
import { useToast } from '@/hooks/useToast'

type Candidate = {
  id: string
  first_name: string | null
  last_name: string | null
  skills: string[] | null
  city: string | null
  experience_years: string | null
  category: string | null
  has_resume: boolean
}

export function AiResumeSearch() {
  const [skill, setSkill] = useState('')
  const [location, setLocation] = useState('')
  const [results, setResults] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [resumeBusy, setResumeBusy] = useState<string | null>(null)
  const toast = useToast()

  const search = async () => {
    setLoading(true)
    setSearched(true)
    try {
      const sp = new URLSearchParams()
      if (skill.trim()) sp.set('skill', skill.trim())
      if (location.trim()) sp.set('location', location.trim())
      const res = await fetch(`/api/employer/ai-search?${sp}`)
      const d = await res.json().catch(() => ({}))
      setResults(res.ok ? d.data || [] : [])
      if (!res.ok) toast.error(d.error || 'Search failed')
    } finally { setLoading(false) }
  }

  const viewResume = async (id: string) => {
    setResumeBusy(id)
    try {
      const res = await fetch(`/api/employer/candidates/${id}/resume-url`)
      const d = await res.json().catch(() => ({}))
      if (res.ok && d.url) window.open(d.url, '_blank', 'noopener,noreferrer')
      else toast.error('Résumé available only after the candidate applies to you')
    } finally { setResumeBusy(null) }
  }

  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 18, marginBottom: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input value={skill} onChange={e => setSkill(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} placeholder="Skill (e.g. React, Tally, Sales)" style={input} />
        <input value={location} onChange={e => setLocation(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} placeholder="City" style={{ ...input, maxWidth: 200 }} />
        <button type="button" onClick={search} disabled={loading} style={{ background: '#1847d4', color: '#fff', border: 'none', padding: '11px 22px', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
          {loading ? 'Searching…' : 'Search candidates'}
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>Searching candidates…</p>
      ) : !searched ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>Search by skill and city to find matching candidates.</p>
      ) : results.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>No candidates match your search.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
          {results.map(c => (
            <div key={c.id} style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0d1f4e' }}>{c.first_name} {c.last_name}</div>
              <div style={{ fontSize: 12.5, color: '#6b7280', marginBottom: 8 }}>
                {[c.category, c.city, c.experience_years].filter(Boolean).join(' · ') || 'Candidate'}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {(c.skills || []).slice(0, 5).map(s => (
                  <span key={s} style={{ background: '#eff6ff', color: '#1847d4', border: '1px solid #bfdbfe', padding: '3px 9px', borderRadius: 12, fontSize: 11.5, fontWeight: 600 }}>{s}</span>
                ))}
              </div>
              {c.has_resume ? (
                <button type="button" onClick={() => viewResume(c.id)} disabled={resumeBusy === c.id}
                  style={{ background: '#f8faff', color: '#1847d4', border: '1.5px solid #bfdbfe', padding: '7px 14px', borderRadius: 9, fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>
                  {resumeBusy === c.id ? '…' : '📄 View résumé'}
                </button>
              ) : (
                <span style={{ fontSize: 12, color: '#94a3b8' }}>No résumé on file</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const input: React.CSSProperties = { flex: 1, minWidth: 180, border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, boxSizing: 'border-box', color: '#0d1f4e' }
