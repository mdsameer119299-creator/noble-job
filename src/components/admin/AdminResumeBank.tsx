'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useToast } from '@/hooks/useToast'

type Candidate = {
  id: string
  first_name: string | null
  last_name: string | null
  name?: string
  city: string | null
  state: string | null
  skills: string[] | null
  experience_years: string | null
  expected_salary: number | null
  category: string | null
  /** Presence flag from /api/admin/candidates — the raw storage path is never
   *  exposed; resumes are only reachable via the signed-URL endpoint. */
  resumeUploaded: boolean
  email?: string | null
  users?: { email?: string }
}

export function AdminResumeBank() {
  const [all, setAll] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [city, setCity] = useState('')
  const [skill, setSkill] = useState('')
  const [exp, setExp] = useState('')
  const [maxSalary, setMaxSalary] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const toast = useToast()

  const load = () => {
    setLoading(true)
    setError(false)
    fetch('/api/admin/candidates')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => setAll((d.data || []).filter((c: Candidate) => c.resumeUploaded)))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const results = useMemo(() => {
    return all.filter(c => {
      if (city && !(c.city || '').toLowerCase().includes(city.toLowerCase())) return false
      if (skill && !(c.skills || []).some(s => s.toLowerCase().includes(skill.toLowerCase()))) return false
      if (exp && !(c.experience_years || '').toLowerCase().includes(exp.toLowerCase())) return false
      if (maxSalary && c.expected_salary && c.expected_salary > Number(maxSalary)) return false
      return true
    })
  }, [all, city, skill, exp, maxSalary])

  const resumeUrl = async (id: string): Promise<string | null> => {
    const res = await fetch(`/api/admin/candidates/${id}/resume-url`)
    const d = await res.json().catch(() => ({}))
    return res.ok ? d.url || null : null
  }

  const view = async (id: string) => {
    setBusy(id)
    try {
      const url = await resumeUrl(id)
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
      else toast.error('Résumé not available')
    } finally { setBusy(null) }
  }

  const download = async (id: string, name: string) => {
    setBusy(id)
    try {
      const url = await resumeUrl(id)
      if (!url) { toast.error('Résumé not available'); return }
      const a = document.createElement('a')
      a.href = url; a.download = `${name || 'candidate'}-resume`; a.target = '_blank'; a.rel = 'noopener noreferrer'
      document.body.appendChild(a); a.click(); a.remove()
    } finally { setBusy(null) }
  }

  if (loading) return <p style={{ color: '#6b7280', fontSize: 13 }}>Loading resume bank…</p>
  if (error) return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 20 }}>
      <p style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>Could not load candidates.</p>
      <button type="button" onClick={load} style={primary}>Retry</button>
    </div>
  )

  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 16, marginBottom: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input value={skill} onChange={e => setSkill(e.target.value)} placeholder="Skill" style={input} />
        <input value={city} onChange={e => setCity(e.target.value)} placeholder="City" style={input} />
        <input value={exp} onChange={e => setExp(e.target.value)} placeholder="Experience (e.g. 2)" style={input} />
        <input value={maxSalary} onChange={e => setMaxSalary(e.target.value)} placeholder="Max expected salary" type="number" style={input} />
      </div>

      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
        <strong style={{ color: '#0d1f4e' }}>{results.length}</strong> résumé{results.length === 1 ? '' : 's'}
      </p>

      {results.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>No résumés match your filters.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
          {results.map(c => {
            const name = (c.name || `${c.first_name ?? ''} ${c.last_name ?? ''}`).trim() || 'Candidate'
            return (
              <div key={c.id} style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 18 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0d1f4e' }}>{name}</div>
                <div style={{ fontSize: 12.5, color: '#6b7280', marginBottom: 8 }}>
                  {[c.category, c.city, c.experience_years].filter(Boolean).join(' · ') || '—'}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {(c.skills || []).slice(0, 5).map(s => (
                    <span key={s} style={{ background: '#eff6ff', color: '#1847d4', border: '1px solid #bfdbfe', padding: '3px 9px', borderRadius: 12, fontSize: 11.5, fontWeight: 600 }}>{s}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => view(c.id)} disabled={busy === c.id} style={btn('#1847d4', '#eff6ff', '#bfdbfe')}>View</button>
                  <button type="button" onClick={() => download(c.id, name)} disabled={busy === c.id} style={btn('#15803d', '#f0fdf4', '#bbf7d0')}>Download</button>
                  <Link href={`/admin/candidates/${c.id}`} style={{ ...btn('#7c3aed', '#f5f3ff', '#ddd6fe'), textDecoration: 'none' }}>Profile</Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const input: React.CSSProperties = { flex: 1, minWidth: 140, border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 13, boxSizing: 'border-box', color: '#0d1f4e' }
const primary: React.CSSProperties = { background: '#1847d4', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: 'pointer' }
const btn = (color: string, bg: string, border: string): React.CSSProperties => ({ background: bg, color, border: `1.5px solid ${border}`, padding: '7px 14px', borderRadius: 9, fontWeight: 800, fontSize: 12.5, cursor: 'pointer' })
