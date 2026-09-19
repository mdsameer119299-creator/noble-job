import type { Metadata } from 'next'
import { Suspense } from 'react'
import { listingMeta, pageFromSearchParams } from '@/lib/seo/metadata'
import { CategoryHero } from '@/components/heroes/CategoryHero'
import { AbroadJobsPanel } from '@/components/abroad/AbroadJobsPanel'
import { JobsBrowseIndex } from '@/components/jobs/JobsBrowseIndex'
import { ScrollToTop } from '@/components/shared/ScrollToTop'
import { getAbroadCountryCounts } from '@/lib/data/jobInventory'

type SP = { searchParams: Promise<Record<string, string | string[] | undefined>> }

// Page-1 metadata comes from layout.tsx; page>=2 and filter/keyword params → noindex,follow.
export async function generateMetadata({ searchParams }: SP): Promise<Metadata> {
  return listingMeta('/jobs/abroad', await searchParams)
}

export default async function AbroadJobsPage({ searchParams }: SP) {
  const page = pageFromSearchParams(await searchParams)
  const countries = getAbroadCountryCounts()
  return (
    <div style={{ background: '#f8faff', minHeight: '100vh' }}>
      <CategoryHero variant="abroad" />
      <div id="abroad-jobs">
        <AbroadJobsPanel countries={countries} />
      </div>
      <div className="wrap">
        <Suspense fallback={null}>
          <JobsBrowseIndex board="abroad" page={page} basePath="/jobs/abroad" title="All Abroad Jobs — Full Directory" />
        </Suspense>
      </div>
      <ScrollToTop />
    </div>
  )
}
