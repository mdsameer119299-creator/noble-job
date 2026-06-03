import { CategoryHero } from '@/components/heroes/CategoryHero'
import { WfhJobsPanel } from '@/components/wfh/WfhJobsPanel'
import { ScrollToTop } from '@/components/shared/ScrollToTop'
import '@/styles/wfh-jobs.css'

export default function WfhJobsPage() {
  return (
    <div className="wfh-page">
      <CategoryHero variant="wfh" />
      <WfhJobsPanel />
      <ScrollToTop />
    </div>
  )
}
