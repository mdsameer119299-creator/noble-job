import { AppTracker } from '@/components/candidate/AppTracker'
import { CandidateDashboardAI } from '@/components/candidate/CandidateDashboardAI'
import { statusMeta } from '@/lib/candidate/status'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export default async function CandidateDashboardPage() {
  let firstName = 'Job Seeker'
  let status: string | null = null
  if (isSupabaseConfigured()) {
    const sb = await createClient()
    if (sb) {
      const { data: { user } } = await sb.auth.getUser()
      if (user) {
        const { data: cand } = await sb.from('candidates').select('*').eq('user_id', user.id).single()
        const c = cand as { first_name?: string; availability_status?: string } | null
        firstName = c?.first_name || firstName
        status = c?.availability_status ?? null
      }
    }
  }
  const sm = statusMeta(status)

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 28, marginBottom: 4 }}>
            Hello, {firstName}! 👋
          </h1>
          <p style={{ color: '#6b7280', fontSize: 14 }}>Your personal AI career coach — score, matches, and next best actions.</p>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 999, padding: '7px 14px' }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: sm.color, display: 'inline-block' }} />
          <span style={{ fontWeight: 800, color: sm.color, fontSize: 13 }}>{sm.label}</span>
        </span>
      </div>

      <div style={{ marginBottom: 18 }}>
        <AppTracker />
      </div>

      <CandidateDashboardAI />
    </div>
  )
}
