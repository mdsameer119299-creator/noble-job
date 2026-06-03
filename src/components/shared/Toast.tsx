'use client'
import { useUIStore } from '@/store/uiStore'

const COLORS = {
  success: { bg: '#f0fdf4', border: '#86efac', text: '#15803d', icon: '✅' },
  error:   { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626', icon: '❌' },
  info:    { bg: '#eff6ff', border: '#93c5fd', text: '#1847d4', icon: 'ℹ️' },
  warning: { bg: '#fffbeb', border: '#fcd34d', text: '#d97706', icon: '⚠️' },
}

export function Toast() {
  const { toasts, removeToast } = useUIStore()
  if (!toasts.length) return null
  return (
    <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {toasts.map(t => {
        const c = COLORS[t.type]
        return (
          <div key={t.id}
            onClick={() => removeToast(t.id)}
            style={{
              background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 12,
              padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10,
              boxShadow: '0 4px 20px rgba(0,0,0,.12)', cursor: 'pointer',
              minWidth: 260, maxWidth: 400, animation: 'fadeIn .25s ease-out',
            }}>
            <span style={{ fontSize: 18 }}>{c.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: c.text, flex: 1 }}>{t.message}</span>
            <span style={{ fontSize: 18, color: c.text, opacity: .5 }}>×</span>
          </div>
        )
      })}
    </div>
  )
}
