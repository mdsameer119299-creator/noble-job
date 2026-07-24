'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@/hooks/useToast'

type Board = 'private' | 'wfh' | 'abroad'

type JobForm = {
  title: string
  company: string
  location: string
  country: string
  job_type: string
  category: string
  salary_min: string
  salary_max: string
  salary: string
  qualification: string
  experience: string
  skills: string
  description: string
  status: string
}

const EMPTY: JobForm = {
  title: '', company: '', location: '', country: '', job_type: 'Full Time', category: '',
  salary_min: '', salary_max: '', salary: '', qualification: '', experience: '',
  skills: '', description: '', status: 'active',
}

export function EditJobModal() {
  const params = useParams()
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string | undefined)
  const board = ((useSearchParams().get('board') as Board | null) || 'private') as Board
  const router = useRouter()
  const toast = useToast()
  const [form, setForm] = useState<JobForm>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = () => {
    if (!id) return
    setLoading(true)
    setError(false)
    fetch(`/api/employer/jobs/${id}?board=${board}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => {
        const j = d.data || {}
        setForm({
          title: j.title || '', company: j.company || '', location: j.location || '', country: j.country || '',
          job_type: j.job_type || j.type || 'Full Time', category: j.category || j.cat || '',
          salary_min: j.salary_min?.toString() || '', salary_max: j.salary_max?.toString() || '', salary: j.salary || '',
          qualification: j.qualification || '', experience: j.experience || j.experience_required || '',
          skills: (j.skills || []).join(', '), description: j.description || '', status: j.status || 'active',
        })
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id, board]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setSaving(true)
    try {
      const skills = form.skills.split(',').map(s => s.trim()).filter(Boolean)
      const payload: Record<string, unknown> = {
        title: form.title, company: form.company, skills, description: form.description, status: form.status,
      }
      if (board === 'private') {
        Object.assign(payload, {
          location: form.location, job_type: form.job_type, category: form.category,
          salary_min: Number(form.salary_min) || null, salary_max: Number(form.salary_max) || null,
        })
      } else if (board === 'wfh') {
        Object.assign(payload, { category: form.category, qualification: form.qualification, experience: form.experience, salary: form.salary, type: form.job_type })
      } else {
        Object.assign(payload, { country: form.country, location: form.location, category: form.category, experience: form.experience, salary: form.salary, type: form.job_type })
      }
      const res = await fetch(`/api/employer/jobs/${id}?board=${board}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok && d.success !== false) { toast.success('Job updated'); router.push('/employer/jobs') }
      else toast.error('Update failed')
    } finally { setSaving(false) }
  }

  if (loading) return <p style={{ color: '#6b7280', fontSize: 13 }}>Loading job…</p>
  if (error) return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 20 }}>
      <p style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>Could not load this job.</p>
      <button type="button" onClick={load} style={primary}>Retry</button>
    </div>
  )

  const field = (label: string, key: keyof JobForm, textarea = false, type = 'text') => (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0d1f4e', marginBottom: 6 }}>{label}</label>
      {textarea ? (
        <textarea value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          style={{ ...input, minHeight: 110, resize: 'vertical', fontFamily: 'inherit' }} />
      ) : (
        <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={input} />
      )}
    </div>
  )

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 24, maxWidth: 620, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: '#1847d4' }}>
        {board === 'private' ? 'Private Job' : board === 'wfh' ? 'Work From Home' : 'Abroad Job'}
      </div>
      {field('Job title', 'title')}
      {field('Company', 'company')}
      {board === 'private' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {field('Location', 'location')}
          {field('Job type', 'job_type')}
        </div>
      )}
      {board === 'abroad' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {field('Country', 'country')}
          {field('City / Location', 'location')}
        </div>
      )}
      {field('Category', 'category')}
      {board === 'private' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {field('Min salary (₹/yr)', 'salary_min', false, 'number')}
          {field('Max salary (₹/yr)', 'salary_max', false, 'number')}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {field('Experience', 'experience')}
          {field('Salary', 'salary')}
        </div>
      )}
      {board === 'wfh' && field('Qualification', 'qualification')}
      {field('Skills (comma-separated)', 'skills')}
      {field('Description', 'description', true)}
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0d1f4e', marginBottom: 6 }}>Status</label>
        <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={input}>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button type="button" onClick={() => router.push('/employer/jobs')} style={ghost}>Cancel</button>
        <button type="button" onClick={save} disabled={saving} style={primary}>{saving ? 'Saving…' : 'Save changes'}</button>
      </div>
    </div>
  )
}

const input: React.CSSProperties = { width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, boxSizing: 'border-box', color: '#0d1f4e' }
const primary: React.CSSProperties = { background: '#1847d4', color: '#fff', border: 'none', padding: '11px 22px', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }
const ghost: React.CSSProperties = { background: 'transparent', color: '#64748b', border: '1.5px solid #e2e8f0', padding: '11px 22px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }
