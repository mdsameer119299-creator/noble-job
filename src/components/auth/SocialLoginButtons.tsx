'use client'
import { signInWithGoogle, signInWithLinkedIn } from '@/lib/auth/oauthProviders'
import { useToast } from '@/hooks/useToast'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export function SocialLoginButtons({ role = 'candidate' }: { role?: 'employer' | 'candidate' }) {
  const toast = useToast()
  const configured = isSupabaseConfigured()

  const handleGoogle = async () => {
    if (!configured) {
      toast.error('Login unavailable until authentication is configured')
      return
    }
    const { error } = await signInWithGoogle(role)
    if (error) toast.error(error.message)
  }
  const handleLinkedIn = async () => {
    if (!configured) {
      toast.error('Login unavailable until authentication is configured')
      return
    }
    const { error } = await signInWithLinkedIn(role)
    if (error) toast.error(error.message)
  }

  if (!configured) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
        <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
        <span style={{ color: '#9ca3af', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '.04em' }}>or continue with</span>
        <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
      </div>
      <button onClick={handleGoogle}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '11px 16px', border: '1.5px solid #e2e8f0', borderRadius: 10, background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#374151', transition: 'all .2s' }}>
        <span style={{ fontWeight: 900, fontSize: 16, color: '#ea4335' }}>G</span> Continue with Google
      </button>
      <button onClick={handleLinkedIn}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '11px 16px', border: '1.5px solid #e2e8f0', borderRadius: 10, background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#374151' }}>
        <span style={{ fontWeight: 900, fontSize: 16, color: '#0077b5' }}>in</span> Continue with LinkedIn
      </button>
    </div>
  )
}
