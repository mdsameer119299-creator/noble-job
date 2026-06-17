'use client'
import { useEffect, useState } from 'react'

type Plan = { plan_type?: string; jobs_limit?: number; expires_at?: string | null }

const PLAN_LABEL: Record<string, string> = { free: 'Free', basic: 'Basic', pro: 'Pro', enterprise: 'Enterprise' }

export function CurrentPlan() {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = () => {
    setLoading(true)
    setError(false)
    fetch('/api/employer/billing')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => setPlan(d.data || { plan_type: 'free', jobs_limit: 3 }))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading) return <p style={{ color: '#6b7280', fontSize: 13 }}>Loading current plan…</p>
  if (error) return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 20 }}>
      <p style={{ color: '#b91c1c', fontSize: 13, marginBottom: 10 }}>Could not load your plan.</p>
      <button type="button" onClick={load} style={{ background: '#1847d4', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>Retry</button>
    </div>
  )

  const type = plan?.plan_type || 'free'
  return (
    <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'linear-gradient(135deg,#0d1f4e,#1847d4)', borderRadius: 16, padding: 24, color: '#fff' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', opacity: 0.8 }}>Current plan</div>
        <div style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, fontSize: 30, margin: '6px 0 14px' }}>{PLAN_LABEL[type] || type}</div>
        <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
          <div><div style={{ opacity: 0.75 }}>Active job limit</div><div style={{ fontWeight: 800, fontSize: 18 }}>{plan?.jobs_limit ?? 3}</div></div>
          <div><div style={{ opacity: 0.75 }}>Renews</div><div style={{ fontWeight: 800, fontSize: 18 }}>{plan?.expires_at ? new Date(plan.expires_at).toLocaleDateString() : '—'}</div></div>
        </div>
      </div>
      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 20 }}>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
          Need more active postings or premium candidate search? Contact us at{' '}
          <a href="mailto:support@noblejob.in" style={{ color: '#1847d4', fontWeight: 700 }}>support@noblejob.in</a> to upgrade.
        </p>
      </div>
    </div>
  )
}
