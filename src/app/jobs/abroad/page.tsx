import { CategoryHero } from '@/components/heroes/CategoryHero'
import { AbroadJobsPanel } from '@/components/abroad/AbroadJobsPanel'
import { ScrollToTop } from '@/components/shared/ScrollToTop'
import { getAbroadCountryCounts } from '@/lib/data/jobInventory'

export default function AbroadJobsPage() {
  const countries = getAbroadCountryCounts()
  return (
    <div style={{ background: '#f8faff', minHeight: '100vh' }}>
      <CategoryHero variant="abroad" />
      <div id="abroad-jobs">
        <AbroadJobsPanel countries={countries} />
      </div>
      <ScrollToTop />
    </div>
  )
}
