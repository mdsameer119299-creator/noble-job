import type { Metadata } from 'next'
import { Suspense } from 'react'
import { listingMeta, pageFromSearchParams } from '@/lib/seo/metadata'
import { CategoryHero } from '@/components/heroes/CategoryHero'
import { WfhJobsPanel } from '@/components/wfh/WfhJobsPanel'
import { JobsBrowseIndex } from '@/components/jobs/JobsBrowseIndex'
import { ScrollToTop } from '@/components/shared/ScrollToTop'
import '@/styles/wfh-jobs.css'

type SP = { searchParams: Promise<Record<string, string | string[] | undefined>> }

// Page-1 metadata comes from layout.tsx; page>=2 and filter/keyword params → noindex,follow.
export async function generateMetadata({ searchParams }: SP): Promise<Metadata> {
  return listingMeta('/jobs/wfh', await searchParams)
}

export default async function WfhJobsPage({ searchParams }: SP) {
  const page = pageFromSearchParams(await searchParams)
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
