import type { Metadata } from 'next'
import { Suspense } from 'react'
import { paginationMeta } from '@/lib/seo/metadata'
import { CategoryHero } from '@/components/heroes/CategoryHero'
import { WfhJobsPanel } from '@/components/wfh/WfhJobsPanel'
import { JobsBrowseIndex } from '@/components/jobs/JobsBrowseIndex'
import { ScrollToTop } from '@/components/shared/ScrollToTop'
import '@/styles/wfh-jobs.css'

type SP = { searchParams: Promise<{ page?: string }> }

// Page-1 metadata comes from layout.tsx; add pagination canonical/robots for page 2+.
export async function generateMetadata({ searchParams }: SP): Promise<Metadata> {
  const page = Math.max(1, Number((await searchParams).page) || 1)
  return paginationMeta('/jobs/wfh', page)
}

export default async function WfhJobsPage({ searchParams }: SP) {
  const page = Math.max(1, Number((await searchParams).page) || 1)
  return (
    <div className="wfh-page">
      <CategoryHero variant="wfh" />
      <WfhJobsPanel />
      <div className="wrap">
        <Suspense fallback={null}>
          <JobsBrowseIndex board="wfh" page={page} basePath="/jobs/wfh" title="All Work From Home Jobs — Full Directory" />
        </Suspense>
      </div>
      <ScrollToTop />
    </div>
  )
}
