'use client'
import { useState } from 'react'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useToast } from '@/hooks/useToast'
import { LoadingState, EmptyState, ErrorState, PanelCard } from './AsyncStates'

type Alert = {
  id: string
  keywords: string | null
  location: string | null
  category: string | null
  job_type: string | null
  frequency: string | null
}

export function JobAlertsTab() {
  const { data, loading, error, reload } = useAsyncData<Alert[]>('/api/alerts')
  const [removing, setRemoving] = useState<string | null>(null)
  const toast = useToast()

  const remove = async (id: string) => {
    setRemoving(id)
    try {
      const res = await fetch(`/api/alerts/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Alert removed')
        reload()
      } else {
        toast.error('Could not remove alert')
      }
    } finally {
      setRemoving(null)
    }
  }

  if (loading) return <LoadingState label="Loading job alerts…" />
  if (error) return <ErrorState onRetry={reload} message={error} />
  const alerts = data || []
  if (alerts.length === 0) return <EmptyState message="You have no active job alerts." />

  return (
    <PanelCard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {alerts.map((a) => (
          <div
            key={a.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #f0f4ff',
              paddingBottom: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0d1f4e' }}>
                {a.keywords || a.category || 'All jobs'}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                {[a.location, a.job_type, a.frequency].filter(Boolean).join(' · ') || 'Any location'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => remove(a.id)}
              disabled={removing === a.id}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '6px 12px',
                borderRadius: 8,
                border: '1.5px solid #fca5a5',
                background: '#fef2f2',
                color: '#dc2626',
                cursor: removing === a.id ? 'wait' : 'pointer',
              }}
            >
              {removing === a.id ? 'Removing…' : 'Remove'}
            </button>
          </div>
        ))}
      </div>
    </PanelCard>
  )
}
