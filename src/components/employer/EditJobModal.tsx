'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useToast } from '@/hooks/useToast'

type JobForm = {
  title: string
  location: string
  job_type: string
  category: string
  salary_min: string
  salary_max: string
  skills: string
  description: string
  status: string
}

const EMPTY: JobForm = { title: '', location: '', job_type: 'Full Time', category: '', salary_min: '', salary_max: '', skills: '', description: '', status: 'active' }

export function EditJobModal() {
  const params = useParams()
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string | undefined)
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
    fetch(`/api/employer/jobs/${id}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => {
        const j = d.data || {}
        setForm({
          title: j.title || '', location: j.location || '', job_type: j.job_type || 'Full Time',
          category: j.category || '', salary_min: j.salary_min?.toString() || '', salary_max: j.salary_max?.toString() || '',
          skills: (j.skills || []).join(', '), description: j.description || '', status: j.status || 'active',
        })
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/employer/jobs/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title, location: form.location, job_type: form.job_type, category: form.category,
          salary_min: Number(form.salary_min) || null, salary_max: Number(form.salary_max) || null,
          skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
          description: form.description, status: form.status,
        }),
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
      {field('Job title', 'title')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {field('Location', 'location')}
        {field('Job type', 'job_type')}
      </div>
      {field('Category', 'category')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {field('Min salary (₹/yr)', 'salary_min', false, 'number')}
        {field('Max salary (₹/yr)', 'salary_max', false, 'number')}
      </div>
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
