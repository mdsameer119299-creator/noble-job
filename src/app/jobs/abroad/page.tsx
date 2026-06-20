import type { Metadata } from 'next'
import { paginationMeta } from '@/lib/seo/metadata'
import { CategoryHero } from '@/components/heroes/CategoryHero'
import { AbroadJobsPanel } from '@/components/abroad/AbroadJobsPanel'
import { JobsBrowseIndex } from '@/components/jobs/JobsBrowseIndex'
import { ScrollToTop } from '@/components/shared/ScrollToTop'
import { getAbroadCountryCounts } from '@/lib/data/jobInventory'

type SP = { searchParams: Promise<{ page?: string }> }

// Page-1 metadata comes from layout.tsx; add pagination canonical/robots for page 2+.
export async function generateMetadata({ searchParams }: SP): Promise<Metadata> {
  const page = Math.max(1, Number((await searchParams).page) || 1)
  return paginationMeta('/jobs/abroad', page)
}

export default async function AbroadJobsPage({ searchParams }: SP) {
  const page = Math.max(1, Number((await searchParams).page) || 1)
  const countries = getAbroadCountryCounts()
  return (
    <div style={{ background: '#f8faff', minHeight: '100vh' }}>
      <CategoryHero variant="abroad" />
      <div id="abroad-jobs">
        <AbroadJobsPanel countries={countries} />
      </div>
      <div className="wrap">
        <JobsBrowseIndex board="abroad" page={page} basePath="/jobs/abroad" title="All Abroad Jobs — Full Directory" />
      </div>
      <ScrollToTop />
    </div>
  )
}
