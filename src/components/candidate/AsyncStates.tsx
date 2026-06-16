'use client'
import type { ReactNode } from 'react'

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  border: '1.5px solid #e2e8f0',
  padding: 20,
  marginBottom: 16,
}

export function PanelCard({ children }: { children: ReactNode }) {
  return <div style={card}>{children}</div>
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <PanelCard>
      <p style={{ color: '#6b7280', fontSize: 13 }}>{label}</p>
    </PanelCard>
  )
}

export function EmptyState({ message = 'No data available.' }: { message?: string }) {
  return (
    <PanelCard>
      <p style={{ color: '#6b7280', fontSize: 13 }}>{message}</p>
    </PanelCard>
  )
}

export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  return (
    <PanelCard>
      <p style={{ color: '#b91c1c', fontSize: 13, fontWeight: 600, marginBottom: onRetry ? 10 : 0 }}>
        {message || 'Something went wrong.'}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            background: '#1847d4',
            color: '#fff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 9,
            fontWeight: 800,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      )}
    </PanelCard>
  )
}
