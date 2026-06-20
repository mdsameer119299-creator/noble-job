import type { Metadata } from 'next'
import { buildPageMetadata, paginationMeta } from '@/lib/seo/metadata'
import { Suspense } from 'react'
import { CategoryHero } from '@/components/heroes/CategoryHero'
import { JobSearchBar } from '@/components/jobs/JobSearchBar'
import { FilterSidebar } from '@/components/jobs/FilterSidebar'
import { LiveJobsList } from '@/components/jobs/LiveJobsList'
import { JobsBrowseIndex } from '@/components/jobs/JobsBrowseIndex'
import { AiMatchingSidebar } from '@/components/jobs/AiMatchingSidebar'
import { EmailAlertForm } from '@/components/jobs/EmailAlertForm'
import { ScrollToTop } from '@/components/shared/ScrollToTop'

export const revalidate = 3600

type SP = { searchParams: Promise<{ page?: string }> }

export async function generateMetadata({ searchParams }: SP): Promise<Metadata> {
  const page = Math.max(1, Number((await searchParams).page) || 1)
  return {
    ...buildPageMetadata({
      title: 'Private Jobs in India — IT, Banking, Fresher & More | Noble Job',
      description:
        'Browse Private Jobs from TCS, Infosys, Amazon, Wipro, HCL and 2,500+ companies. Live verified openings across India on Job Portal India Noble Job.',
      path: '/jobs/private',
      keywords: ['Private Jobs', 'Jobs in India', 'fresher jobs', 'IT jobs India'],
    }),
    ...paginationMeta('/jobs/private', page),
  }
}

export default async function PrivateJobsPage({ searchParams }: SP) {
  const page = Math.max(1, Number((await searchParams).page) || 1)
  return (
    <div style={{ background: '#f8faff', minHeight: '100vh' }}>
      <CategoryHero variant="private" />

      <div className="wrap" style={{ paddingTop: 28, paddingBottom: 40 }} id="private-jobs">
        <JobSearchBar />
        <div className="jobs-layout-3col">
          <Suspense fallback={null}><FilterSidebar /></Suspense>
          <Suspense fallback={<div style={{ color: '#6b7280', padding: 20 }}>Loading jobs…</div>}>
            <LiveJobsList />
          </Suspense>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <AiMatchingSidebar />
            <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: '18px 16px' }}>
              <h4 style={{ fontWeight: 800, color: '#0d1f4e', marginBottom: 10, fontSize: 14 }}>📬 Daily Job Alerts</h4>
              <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>Get matching jobs delivered to your inbox daily.</p>
              <EmailAlertForm board="private" placeholder="Your email address" />
            </div>
          </div>
        </div>
        <JobsBrowseIndex board="private" page={page} basePath="/jobs/private" title="All Private Jobs — Full Directory" />
      </div>
      <ScrollToTop />
    </div>
  )
}
