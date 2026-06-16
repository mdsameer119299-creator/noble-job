'use client'
import { useAsyncData } from '@/hooks/useAsyncData'
import { LoadingState, EmptyState, ErrorState, PanelCard } from './AsyncStates'

type Module = {
  id: string
  title: string
  category: string | null
  content_json: unknown
}

export function InterviewPrepTab() {
  const { data, loading, error, reload } = useAsyncData<Module[]>('/api/candidate/interview-prep')

  if (loading) return <LoadingState label="Loading interview prep…" />
  if (error) return <ErrorState onRetry={reload} message={error} />
  const modules = data || []
  if (modules.length === 0) return <EmptyState message="No interview-prep modules available yet. Check back soon." />

  return (
    <PanelCard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {modules.map((m) => {
          const points = Array.isArray(m.content_json) ? (m.content_json as unknown[]) : []
          return (
            <div key={m.id} style={{ borderBottom: '1px solid #f0f4ff', paddingBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0d1f4e' }}>{m.title}</div>
              {m.category && (
                <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700, marginBottom: 4 }}>{m.category}</div>
              )}
              {points.length > 0 && (
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {points.slice(0, 8).map((p, i) => (
                    <li key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 2 }}>
                      {typeof p === 'string' ? p : JSON.stringify(p)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </PanelCard>
  )
}
