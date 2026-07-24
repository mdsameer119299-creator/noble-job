// app/page.tsx — Home page
// Restores exact original Noble Job homepage layout:
// HeroSection → HeroSearchBar → StatsStrip → AiEmployerTeaser →
// LatestJobsGrid → CategoryChips → AiCandidateTeaser → EmployerCta
import { HeroSection } from '@/components/home/HeroSection'
import { JsonLd } from '@/components/seo/JsonLd'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { faqPageSchema } from '@/lib/seo/schema'
import { SITE_FAQ } from '@/lib/seo/faq'
import { HeroSearchBar } from '@/components/home/HeroSearchBar'
import { StatsStrip } from '@/components/home/StatsStrip'
import { AiEmployerTeaser } from '@/components/home/AiEmployerTeaser'
import { FeaturedJobsSection } from '@/components/home/FeaturedJobsSection'
import { LatestJobsGrid } from '@/components/home/LatestJobsGrid'
import { BlueCollarJobsSection } from '@/components/home/BlueCollarJobsSection'
import { CategoryChips } from '@/components/home/CategoryChips'
import { AiCandidateTeaser } from '@/components/home/AiCandidateTeaser'
import { EmployerCta } from '@/components/home/EmployerCta'
import { ScrollToTop } from '@/components/shared/ScrollToTop'

export const metadata = buildPageMetadata({
  title: 'Jobs in India — Government, Private, WFH & Abroad | Noble Job',
  description:
    'Job Portal India: search Jobs in India — Government Jobs, Private Jobs, Work From Home Jobs, and Abroad Jobs. Free registration, verified employers, daily updates.',
  path: '/',
  keywords: ['Jobs in India', 'Job Portal India', 'Government Jobs', 'Private Jobs', 'Work From Home Jobs', 'Abroad Jobs'],
})

// Refresh so homepage category cards (CategoryChips) reflect govt_jobs without a redeploy.
export const revalidate = 600

export default function HomePage() {
  return (
    <div id="page-home">
      <JsonLd data={faqPageSchema(SITE_FAQ.map(f => ({ question: f.question, answer: f.answer })))} />
      {/* 1. Hero — real professionals image + gradient + AI CV Score card */}
      <HeroSection />

      {/* 2. Search bar — 4 fields + popular tags */}
      <HeroSearchBar />

      {/* 3. Stats strip — dark navy, 5 counters */}
      <StatsStrip />

      {/* Featured Jobs — genuine-employer jobs only, hides itself when empty */}
      <FeaturedJobsSection />

      {/* 4. AI Employer Teaser — dark card, 3-col: steps + JD card + candidates */}
      <AiEmployerTeaser />

      {/* 5. Latest Jobs Grid — 4 cols: Private, Govt, WFH, Abroad */}
      <LatestJobsGrid />

      {/* Blue Collar Jobs — Driver, Delivery, Security, Housekeeping, etc. */}
      <BlueCollarJobsSection />

      {/* 6. Category Chips — expanded categories + View All */}
      <CategoryChips />

      {/* 7. AI Candidate (cv-strip) — ring chart + features + Upload CTA */}
      <AiCandidateTeaser />

      {/* 8. Employer CTA (hiring section) — dark card + 4 feature tiles */}
      <EmployerCta />

      <ScrollToTop />
    </div>
  )
}
