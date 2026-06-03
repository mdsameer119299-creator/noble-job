import { EmployerDashboardStats } from '@/components/employer/EmployerDashboardStats'
import { RecentJobsTable } from '@/components/employer/RecentJobsTable'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export default async function EmployerDashboardPage() {
  let companyName = 'Employer'
  if (isSupabaseConfigured()) {
    const sb = await createClient()
    if (sb) {
      const { data: { user } } = await sb.auth.getUser()
      if (user) {
        const { data: employer } = await sb
          .from('employers')
          .select('company_name')
          .eq('user_id', user.id)
          .single()
        companyName = (employer as { company_name?: string } | null)?.company_name || companyName
      }
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', fontSize: 28, marginBottom: 4 }}>
          Welcome back, {companyName}!
        </h1>
        <p style={{ color: '#6b7280', fontSize: 14 }}>Here&apos;s an overview of your hiring activity on Noble Job.</p>
      </div>
      <EmployerDashboardStats />
      <RecentJobsTable />
    </div>
  )
}
