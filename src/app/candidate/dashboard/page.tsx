import { ProfileCompleteness } from '@/components/candidate/ProfileCompleteness'
import { RecommendedJobsList } from '@/components/candidate/RecommendedJobsList'
import { AppTracker } from '@/components/candidate/AppTracker'
import { AiScoreChart } from '@/components/candidate/AiScoreChart'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export default async function CandidateDashboardPage() {
  let firstName = 'Job Seeker'
  if (isSupabaseConfigured()) {
    const sb = await createClient()
    if (sb) {
      const { data: { user } } = await sb.auth.getUser()
      if (user) {
        const { data: cand } = await sb
          .from('candidates')
          .select('first_name,profile_score')
          .eq('user_id', user.id)
          .single()
        firstName = (cand as { first_name?: string } | null)?.first_name || firstName
      }
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 28, marginBottom: 4 }}>
          Hello, {firstName}! 👋
        </h1>
        <p style={{ color: '#6b7280', fontSize: 14 }}>Your personalised Noble Job dashboard.</p>
      </div>
      <div className="dashboard-content-grid">
        <div>
          <AppTracker />
          <RecommendedJobsList />
        </div>
        <div>
          <AiScoreChart />
          <ProfileCompleteness />
        </div>
      </div>
    </div>
  )
}
