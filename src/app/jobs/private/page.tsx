import type { Metadata } from 'next'
import { buildPageMetadata, listingMeta, pageFromSearchParams } from '@/lib/seo/metadata'
import { Suspense } from 'react'
import { CategoryHero } from '@/components/heroes/CategoryHero'
import { JobSearchBar } from '@/components/jobs/JobSearchBar'
import { FilterSidebar } from '@/components/jobs/FilterSidebar'
import { LiveJobsList, type InitialJobData } from '@/components/jobs/LiveJobsList'
import { JobsBrowseIndex } from '@/components/jobs/JobsBrowseIndex'
import { AiMatchingSidebar } from '@/components/jobs/AiMatchingSidebar'
import { EmailAlertForm } from '@/components/jobs/EmailAlertForm'
import { ScrollToTop } from '@/components/shared/ScrollToTop'
import { getJobs } from '@/lib/services/jobService'

export const dynamic = "force-dynamic"

type SP = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ searchParams }: SP): Promise<Metadata> {
  const sp = await searchParams
  return {
    ...buildPageMetadata({
      title: 'Private Jobs in India — IT, Banking, Fresher & More | Noble Job',
      description:
        'Browse Private Jobs from top companies across India. Live verified openings on Job Portal India Noble Job.',
      path: '/jobs/private',
      keywords: ['Private Jobs', 'Jobs in India', 'fresher jobs', 'IT jobs India'],
    }),
    // page>=2 and any filter/keyword param → noindex,follow (see listingMeta).
    ...listingMeta('/jobs/private', sp),
  }
}

export default async function PrivateJobsPage({ searchParams }: SP) {
  const page = pageFromSearchParams(await searchParams)

  // Server-side initial data fetch so search engines see real job content.
  let initialData: InitialJobData | undefined
  try {
    const result = await getJobs({ page, limit: 20 })
    initialData = {
      jobs: result.jobs,
      total: result.total,
      totalPages: result.totalPages,
      counts: result.counts ?? { all: result.total, live: 0, verified: 0, archived: 0 },
    }
  } catch {
    // SSR fetch failed — the client component will re-fetch on mount.
  }

  return (
    <div style={{ background: '#f8faff', minHeight: '100vh' }}>
      <CategoryHero variant="private" />

      <div className="wrap" style={{ paddingTop: 28, paddingBottom: 40 }} id="private-jobs">
        <JobSearchBar />
        <div className="jobs-layout-3col">
          <Suspense fallback={null}><FilterSidebar /></Suspense>
          <Suspense fallback={<div style={{ color: '#6b7280', padding: 20 }}>Loading jobs…</div>}>
            <LiveJobsList initialData={initialData} />
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
        <Suspense fallback={null}>
          <JobsBrowseIndex board="private" page={page} basePath="/jobs/private" title="All Private Jobs — Full Directory" />
        </Suspense>
      </div>
      <ScrollToTop />
    </div>
  )
}
