'use client'
import { useAsyncData } from '@/hooks/useAsyncData'
import { LoadingState, EmptyState, ErrorState, PanelCard } from './AsyncStates'

type Message = {
  id: string
  content: string
  is_read: boolean
  sent_at: string
  sender_id: string
  recipient_id: string
}

export function MessagesTab() {
  const { data, loading, error, reload } = useAsyncData<Message[]>('/api/messages')

  if (loading) return <LoadingState label="Loading messages…" />
  if (error) return <ErrorState onRetry={reload} message={error} />
  const messages = data || []
  if (messages.length === 0) return <EmptyState message="You have no messages yet." />

  return (
    <PanelCard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              borderBottom: '1px solid #f0f4ff',
              paddingBottom: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: m.is_read ? '#6b7280' : '#1847d4' }}>
                {m.is_read ? 'Read' : 'New'}
              </span>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>
                {m.sent_at ? new Date(m.sent_at).toLocaleString() : ''}
              </span>
            </div>
            <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>{m.content}</p>
          </div>
        ))}
      </div>
    </PanelCard>
  )
}
