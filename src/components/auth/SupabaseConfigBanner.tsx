'use client'
import { useSearchParams } from 'next/navigation'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { AUTH_UNAVAILABLE_MESSAGE } from '@/lib/supabase/guards'

export function SupabaseConfigBanner() {
  const reason = useSearchParams().get('reason')
  const show = !isSupabaseConfigured() || reason === 'config'

  if (!show) return null

  return (
    <div
      role="alert"
      style={{
        background: '#fef3c7',
        border: '1.5px solid #fbbf24',
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 20,
        fontSize: 13,
        color: '#92400e',
        fontWeight: 600,
        lineHeight: 1.5,
      }}
    >
      {AUTH_UNAVAILABLE_MESSAGE}
    </div>
  )
}

export function useAuthConfigured(): boolean {
  return isSupabaseConfigured()
}
