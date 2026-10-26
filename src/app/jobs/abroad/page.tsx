import type { Metadata } from 'next'
import { Suspense } from 'react'
import { listingMeta, pageFromSearchParams } from '@/lib/seo/metadata'
import { CategoryHero } from '@/components/heroes/CategoryHero'
import { AbroadJobsPanel, type InitialAbroadData } from '@/components/abroad/AbroadJobsPanel'
import { JobsBrowseIndex } from '@/components/jobs/JobsBrowseIndex'
import { ScrollToTop } from '@/components/shared/ScrollToTop'
import { getVisibleAbroadCountryCounts } from '@/lib/services/visibleCounts'
import { getAbroadJobsPaginated } from '@/lib/services/abroadJobService'
import { abroadViewFromSearchParams, abroadQueryFor } from '@/lib/jobs/abroadView'

export const dynamic = "force-dynamic"

type SP = { searchParams: Promise<Record<string, string | string[] | undefined>> }

// Page-1 metadata comes from layout.tsx; page>=2 and filter/keyword params → noindex,follow.
export async function generateMetadata({ searchParams }: SP): Promise<Metadata> {
  return listingMeta('/jobs/abroad', await searchParams)
}

export default async function AbroadJobsPage({ searchParams }: SP) {
  const sp = await searchParams
  const page = pageFromSearchParams(sp)
  // The exact view the URL asks for (country / category / search / status / page) — rendered here, not
  // after hydration, so a filtered deep link never flashes the unfiltered totals first.
  const view = abroadViewFromSearchParams(sp)
  const countries = await getVisibleAbroadCountryCounts()

  // Server-side initial data fetch so search engines see real job content.
  let initialData: InitialAbroadData | undefined
  try {
    const result = await getAbroadJobsPaginated({ ...abroadQueryFor(view), limit: 20 } as Parameters<typeof getAbroadJobsPaginated>[0])
    initialData = {
      jobs: result.items,
      total: result.total,
      totalPages: result.totalPages,
      counts: result.counts,
      page,
      view,
    }
  } catch {
    // SSR fetch failed — the client component will re-fetch on mount.
  }

  return (
    <div style={{ background: '#f8faff', minHeight: '100vh' }}>
      <CategoryHero variant="abroad" />
      <div id="abroad-jobs">
        <AbroadJobsPanel countries={countries} initialData={initialData} />
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
