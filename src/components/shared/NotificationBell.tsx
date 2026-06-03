'use client'
import { useState, useRef, useEffect } from 'react'
import { useNotifications } from '@/hooks/useNotifications'
import { formatDate } from '@/lib/utils/formatters'

export function NotificationBell() {
  const { items, unread, markRead, refresh } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => {
          setOpen(o => !o)
          if (!open) refresh()
        }}
        aria-label="Notifications"
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 18,
          padding: 8,
        }}
      >
        🔔
        {unread > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              minWidth: 16,
              height: 16,
              background: '#dc2626',
              color: '#fff',
              borderRadius: 8,
              fontSize: 9,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
            }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: 8,
            width: 320,
            maxHeight: 360,
            overflow: 'auto',
            background: '#fff',
            borderRadius: 12,
            border: '1.5px solid #e2e8f0',
            boxShadow: '0 12px 40px rgba(13,31,78,.15)',
            zIndex: 9999,
          }}
        >
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #f0f4ff', fontWeight: 800, color: '#0d1f4e', fontSize: 13 }}>
            Notifications
          </div>
          {items.length === 0 ? (
            <p style={{ padding: 16, fontSize: 12, color: '#6b7280' }}>No notifications yet.</p>
          ) : (
            items.slice(0, 20).map(n => (
              <button
                key={n.id}
                type="button"
                onClick={() => !n.is_read && markRead(n.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 14px',
                  border: 'none',
                  borderBottom: '1px solid #f8faff',
                  background: n.is_read ? '#fff' : '#eff6ff',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 12, color: '#0d1f4e' }}>{n.title}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{n.message}</div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                  {n.created_at ? formatDate(n.created_at) : ''}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
