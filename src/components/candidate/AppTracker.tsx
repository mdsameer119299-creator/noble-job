'use client'
import Link from 'next/link'
import { useApplications } from '@/hooks/useApplications'
import { ApplicationStatusBadge } from './ApplicationStatusBadge'
import { applicationJobTitle, applicationCompany, isDeliveredToEmployer, NOT_SENT_NOTE } from '@/lib/utils/applicationDisplay'
import { formatDate } from '@/lib/utils/formatters'

export function AppTracker() {
  const { apps, loading } = useApplications()

  if (loading) {
    return (
      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 20 }}>
        <p style={{ color: '#6b7280', fontSize: 13 }}>Loading applications…</p>
      </div>
    )
  }

  if (!apps.length) {
    return (
      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
        <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 18, marginBottom: 8 }}>
          No applications yet
        </h3>
        <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>Browse jobs and click Apply to track them here.</p>
        <Link href="/jobs/private" style={{ color: '#1847d4', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>
          Find jobs →
        </Link>
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f4ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 16, margin: 0 }}>
          Application tracker
        </h3>
        <Link href="/candidate/applications" style={{ fontSize: 12, fontWeight: 700, color: '#1847d4', textDecoration: 'none' }}>
          View all
        </Link>
      </div>
      <div>
        {apps.slice(0, 6).map(app => (
          <div
            key={app.id}
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid #f8faff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, color: '#0d1f4e', fontSize: 14, marginBottom: 2 }}>
                {applicationJobTitle(app)}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                {applicationCompany(app) || app.board}
                {app.applied_at ? ` · ${formatDate(app.applied_at)}` : ''}
              </div>
              {!isDeliveredToEmployer(app) && (
                <div style={{ fontSize: 12, color: '#b45309', marginTop: 4, lineHeight: 1.5, maxWidth: 420 }}>{NOT_SENT_NOTE}</div>
              )}
            </div>
            {isDeliveredToEmployer(app)
              ? <ApplicationStatusBadge status={app.status} />
              : <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800, background: '#f1f5f9', color: '#64748b' }}>Not sent</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
