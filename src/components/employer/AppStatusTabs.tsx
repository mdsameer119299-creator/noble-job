'use client'
import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/useToast'
import type { Application, ApplicationStatus } from '@/types/application'
import { applicationJobTitle } from '@/lib/utils/applicationDisplay'

const TABS: { id: ApplicationStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'shortlisted', label: 'Shortlisted' },
  { id: 'interview', label: 'Interview' },
  { id: 'hired', label: 'Hired' },
  { id: 'rejected', label: 'Rejected' },
]

const NEXT_STATUS: ApplicationStatus[] = ['shortlisted', 'interview', 'hired', 'rejected']

export function AppStatusTabs() {
  const [tab, setTab] = useState<ApplicationStatus | 'all'>('all')
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const load = () => {
    setLoading(true)
    const q = tab === 'all' ? '' : `?status=${tab}`
    fetch(`/api/applications/employer${q}`)
      .then(r => (r.ok ? r.json() : { data: [] }))
      .then(d => setApps(d.data || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [tab])

  const updateStatus = async (id: string, status: ApplicationStatus) => {
    const res = await fetch(`/api/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      toast.success(`Marked as ${status}`)
      load()
    } else toast.error('Update failed')
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 16px',
              borderRadius: 20,
              border: '1.5px solid',
              borderColor: tab === t.id ? '#1847d4' : '#e2e8f0',
              background: tab === t.id ? '#eff6ff' : '#fff',
              color: tab === t.id ? '#1847d4' : '#374151',
              fontWeight: 800,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>Loading applications…</p>
      ) : apps.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>No applications in this tab.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {apps.map(app => (
            <div
              key={app.id}
              style={{
                background: '#fff',
                borderRadius: 12,
                border: '1.5px solid #e2e8f0',
                padding: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontWeight: 800, color: '#0d1f4e' }}>{applicationJobTitle(app)}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                  {(app.candidate as { first_name?: string; last_name?: string })?.first_name}{' '}
                  {(app.candidate as { last_name?: string })?.last_name} · {app.status}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {NEXT_STATUS.filter(s => s !== app.status).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => updateStatus(app.id, s)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      background: '#f8faff',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    → {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
