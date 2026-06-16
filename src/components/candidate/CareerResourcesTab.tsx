'use client'
import { useAsyncData } from '@/hooks/useAsyncData'
import { LoadingState, EmptyState, ErrorState, PanelCard } from './AsyncStates'

type Resource = {
  id: string
  title: string
  type: string | null
  description: string | null
  url: string | null
}

export function CareerResourcesTab() {
  const { data, loading, error, reload } = useAsyncData<Resource[]>('/api/candidate/resources')

  if (loading) return <LoadingState label="Loading career resources…" />
  if (error) return <ErrorState onRetry={reload} message={error} />
  const resources = data || []
  if (resources.length === 0) return <EmptyState message="No career resources available yet. Check back soon." />

  return (
    <PanelCard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {resources.map((r) => (
          <div key={r.id} style={{ borderBottom: '1px solid #f0f4ff', paddingBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0d1f4e' }}>{r.title}</div>
            {r.type && <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700, marginBottom: 4 }}>{r.type}</div>}
            {r.description && <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0' }}>{r.description}</p>}
            {r.url && (
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 13, color: '#1847d4', fontWeight: 700, textDecoration: 'none' }}
              >
                Open resource →
              </a>
            )}
          </div>
        ))}
      </div>
    </PanelCard>
  )
}
