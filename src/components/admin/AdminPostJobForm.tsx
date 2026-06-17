'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useToast } from '@/hooks/useToast'
import { JOB_CATEGORIES, JOB_TYPES } from '@/lib/constants/jobCategories'

type Form = {
  title: string
  company: string
  job_type: string
  location: string
  salary_min: string
  salary_max: string
  experience_required: string
  category: string
  skills: string
  description: string
  apply_method: 'internal' | 'external'
  apply_url: string
  status: string
}

const EMPTY: Form = {
  title: '', company: '', job_type: 'Full Time', location: '', salary_min: '', salary_max: '',
  experience_required: '', category: '', skills: '', description: '', apply_method: 'internal', apply_url: '', status: 'active',
}

export function AdminPostJobForm() {
  const params = useParams()
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string | undefined)
  const isEdit = Boolean(id)
  const router = useRouter()
  const toast = useToast()

  const [form, setForm] = useState<Form>(EMPTY)
  const [loading, setLoading] = useState(isEdit)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    if (!isEdit) return
    setLoading(true)
    setError(false)
    fetch(`/api/admin/jobs/${id}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => {
        const j = d.data || {}
        setForm({
          title: j.title || '', company: j.company || '', job_type: j.job_type || 'Full Time',
          location: j.location || '', salary_min: j.salary_min?.toString() || '', salary_max: j.salary_max?.toString() || '',
          experience_required: j.experience_required || '', category: j.category || '', skills: (j.skills || []).join(', '),
          description: j.description || '', apply_method: j.apply_url ? 'external' : 'internal', apply_url: j.apply_url || '', status: j.status || 'active',
        })
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  const set = (k: keyof Form, v: string) => setForm(f => ({ ...f, [k]: v }))

  const validate = (): string | null => {
    if (!form.title.trim()) return 'Job title is required'
    if (!form.company.trim()) return 'Company name is required'
    if (!form.location.trim()) return 'Location is required'
    if (!form.category) return 'Category is required'
    if (form.description.trim().length < 30) return 'Description must be at least 30 characters'
    if (form.apply_method === 'external' && !/^https?:\/\//.test(form.apply_url.trim())) return 'Enter a valid Apply URL (https://…)'
    return null
  }

  const payload = (status: string) => ({
    title: form.title.trim(), company: form.company.trim(), job_type: form.job_type, location: form.location.trim(),
    salary_min: Number(form.salary_min) || null, salary_max: Number(form.salary_max) || null,
    experience_required: form.experience_required.trim() || null, category: form.category,
    skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
    description: form.description.trim(),
    apply_url: form.apply_method === 'external' ? form.apply_url.trim() : null,
    board: 'private', status,
  })

  const submit = async (status: string, label: string) => {
    const err = validate()
    if (err) { toast.error(err); return }
    setSaving(status)
    try {
      const res = isEdit
        ? await fetch(`/api/admin/jobs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload(status)) })
        : await fetch('/api/admin/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload(status)) })
      const d = await res.json().catch(() => ({}))
      if (res.ok && d.success !== false) { toast.success(label); router.push('/admin/jobs') }
      else toast.error(d.error || 'Save failed')
    } finally { setSaving(null) }
  }

  if (loading) return <p style={{ color: '#6b7280', fontSize: 13 }}>Loading job…</p>
  if (error) return (
    <div style={card}>
      <p style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>Could not load this job.</p>
      <button type="button" onClick={() => router.refresh()} style={primary}>Retry</button>
    </div>
  )

  const field = (label: string, key: keyof Form, opts: { textarea?: boolean; type?: string; placeholder?: string } = {}) => (
    <div>
      <label style={lbl}>{label}</label>
      {opts.textarea ? (
        <textarea value={form[key] as string} onChange={e => set(key, e.target.value)} placeholder={opts.placeholder}
          style={{ ...input, minHeight: 120, resize: 'vertical', fontFamily: 'inherit' }} />
      ) : (
        <input type={opts.type || 'text'} value={form[key] as string} onChange={e => set(key, e.target.value)} placeholder={opts.placeholder} style={input} />
      )}
    </div>
  )

  return (
    <div style={{ ...card, maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {field('Job Title *', 'title', { placeholder: 'e.g. Senior React Developer' })}
      <div style={grid2}>
        {field('Company Name *', 'company', { placeholder: 'e.g. Acme Corp' })}
        <div>
          <label style={lbl}>Job Type</label>
          <select value={form.job_type} onChange={e => set('job_type', e.target.value)} style={input}>
            {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div style={grid2}>
        {field('Location *', 'location', { placeholder: 'e.g. Bangalore / Remote' })}
        {field('Experience', 'experience_required', { placeholder: 'e.g. 2-4 Years' })}
      </div>
      <div>
        <label style={lbl}>Category *</label>
        <select value={form.category} onChange={e => set('category', e.target.value)} style={input}>
          <option value="">Select category</option>
          {JOB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div style={grid2}>
        {field('Min Salary (₹/yr)', 'salary_min', { type: 'number', placeholder: '600000' })}
        {field('Max Salary (₹/yr)', 'salary_max', { type: 'number', placeholder: '1200000' })}
      </div>
      {field('Skills (comma-separated)', 'skills', { placeholder: 'React, TypeScript, Node.js' })}
      {field('Description *', 'description', { textarea: true, placeholder: 'Role, responsibilities and requirements (min 30 chars)' })}
      <div>
        <label style={lbl}>Apply Method</label>
        <select value={form.apply_method} onChange={e => set('apply_method', e.target.value)} style={input}>
          <option value="internal">Internal — apply on Noble Job</option>
          <option value="external">External — employer URL</option>
        </select>
      </div>
      {form.apply_method === 'external' && field('Apply URL *', 'apply_url', { placeholder: 'https://company.com/careers/123' })}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
        <button type="button" onClick={() => submit('active', isEdit ? 'Job saved & published' : 'Job published')} disabled={!!saving} style={primary}>
          {saving === 'active' ? 'Saving…' : isEdit ? 'Save & Publish' : 'Publish job'}
        </button>
        <button type="button" onClick={() => submit('pending', 'Saved as draft')} disabled={!!saving} style={ghost}>
          {saving === 'pending' ? 'Saving…' : 'Save draft'}
        </button>
        {isEdit && (
          <button type="button" onClick={() => submit('closed', 'Job closed')} disabled={!!saving} style={danger}>
            {saving === 'closed' ? 'Closing…' : 'Close job'}
          </button>
        )}
      </div>
    </div>
  )
}

const card: React.CSSProperties = { background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 24 }
const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, color: '#0d1f4e', marginBottom: 6 }
const input: React.CSSProperties = { width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 14, boxSizing: 'border-box', color: '#0d1f4e' }
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }
const primary: React.CSSProperties = { background: '#1847d4', color: '#fff', border: 'none', padding: '11px 22px', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }
const ghost: React.CSSProperties = { background: 'transparent', color: '#64748b', border: '1.5px solid #e2e8f0', padding: '11px 22px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }
const danger: React.CSSProperties = { background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fca5a5', padding: '11px 22px', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }
