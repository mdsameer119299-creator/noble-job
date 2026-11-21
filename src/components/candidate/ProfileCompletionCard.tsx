'use client'
import { useEffect, useState } from 'react'
import { CandidateRegisterStep2 } from '@/components/auth/CandidateRegisterStep2'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/hooks/useToast'
import { track, AcqEvent } from '@/lib/analytics/events'
import { missingProfileSteps } from '@/lib/validations/candidateProfile'

type Profile = { category?: string | null; experience_years?: string | number | null; skills?: string[] | null; resume_url?: string | null }

const LABEL = { category: 'Your field', experience: 'Experience level', skills: 'Key skills' } as const

/**
 * Shown on the candidate dashboard until category, experience and skills are filled in (collected AFTER sign-up).
 * Visible completion indicator: 3 required steps + the resume. Saves through the whitelisted PUT /api/candidate/profile.
 */
export function ProfileCompletionCard() {
  const toast = useToast()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/candidate/profile')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.data) { setProfile(d.data); setForm({ category: d.data.category || '', experienceYears: d.data.experience_years ?? '', skills: d.data.skills || [] }) } })
      .catch(() => {})
  }, [])

  if (!profile) return null
  const missing = missingProfileSteps(profile)
  const total = 3
  const done = total - missing.length
  if (missing.length === 0) return null
  const pct = Math.round((done / total) * 100)

  const save = async () => {
    const payload: Record<string, unknown> = {}
    if (form.category) payload.category = form.category
    if (form.experienceYears !== '' && form.experienceYears !== undefined) payload.experience_years = String(form.experienceYears)
    if (form.skills?.length) payload.skills = form.skills
    if (!Object.keys(payload).length) { toast.error('Choose at least one option'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/candidate/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error || 'Could not save. Please try again.'); return }
      const next: Profile = { ...profile, category: (payload.category as string | undefined) ?? profile.category, experience_years: (payload.experience_years as string) ?? profile.experience_years, skills: (payload.skills as string[]) ?? profile.skills }
      setProfile(next)
      track(AcqEvent.PROFILE_STEP_SAVED, { remaining: missingProfileSteps(next).length })
      if (missingProfileSteps(next).length === 0) { track(AcqEvent.PROFILE_COMPLETED, {}); toast.success('Profile complete — nice!') } else toast.success('Saved')
    } catch { toast.error('Network error. Please try again.') } finally { setSaving(false) }
  }

  return (
    <section aria-label="Complete your profile" style={{ background: 'linear-gradient(135deg,#eff6ff,#f5f3ff)', border: '1.5px solid #c7d2fe', borderRadius: 16, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 18, margin: 0 }}>Finish your profile — {pct}% done</h2>
        <span style={{ fontSize: 12.5, color: '#4b5e7e' }}>{done} of {total} steps · takes about 30 seconds</span>
      </div>
      <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} style={{ height: 10, background: '#e2e8f0', borderRadius: 8, overflow: 'hidden', margin: '12px 0' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#1847d4,#7c3aed)', transition: 'width .3s' }} />
      </div>
      <ul style={{ display: 'flex', gap: 14, flexWrap: 'wrap', listStyle: 'none', padding: 0, margin: '0 0 16px', fontSize: 13 }}>
        {(['category', 'experience', 'skills'] as const).map(k => (
          <li key={k} style={{ color: missing.includes(k) ? '#92400e' : '#15803d', fontWeight: 700 }}>{missing.includes(k) ? '○' : '✓'} {LABEL[k]}</li>
        ))}
        <li style={{ color: profile.resume_url ? '#15803d' : '#6b7280', fontWeight: 700 }}>{profile.resume_url ? '✓' : '○'} Resume (needed to apply)</li>
      </ul>
      <CandidateRegisterStep2 form={form} onChange={(k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))} errors={{}} />
      <Button variant="blue" onClick={save} loading={saving} className="mt-4">Save and continue</Button>
    </section>
  )
}
