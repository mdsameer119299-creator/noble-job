'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/useToast'

/**
 * Clears the Supabase session server-side (POST /api/auth/logout) and returns the
 * user to the homepage. Because the session cookie is cleared on the server, the
 * logout survives a refresh and protected /candidate routes redirect to /auth
 * afterwards (enforced by requireRole + middleware).
 */
export function LogoutButton({ style }: { style?: React.CSSProperties }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const toast = useToast()

  const logout = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        toast.error('Could not log out. Please try again.')
        return
      }
      router.push('/')
      router.refresh()
    } catch {
      toast.error('Could not log out. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      style={{
        width: '100%',
        background: '#fef2f2',
        border: '1.5px solid #fca5a5',
        color: '#dc2626',
        padding: '9px 14px',
        borderRadius: 9,
        fontWeight: 800,
        fontSize: 13,
        cursor: loading ? 'wait' : 'pointer',
        ...style,
      }}
    >
      {loading ? 'Logging out…' : '🚪 Logout'}
    </button>
  )
}
