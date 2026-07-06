import '@/styles/category-hero.css'
import { getHeroTheme } from '@/lib/config/categoryHeroThemes'
import {
  getHeroStats,
  getVerifiedEmployerCount,
  type HeroVariant,
  type HeroStatsPayload,
} from '@/lib/services/heroStatsService'
import { CategoryHeroView } from './CategoryHeroView'

interface CategoryHeroProps {
  variant: HeroVariant
  /** Govt category slug for sector-specific stats */
  govtSlug?: string
}

function buildDynamicBullets(variant: HeroVariant, stats: HeroStatsPayload, govtSlug?: string) {
  const n = (key: string) => stats.counters.find(c => c.key === key)?.value ?? 0
  if (variant === 'private') {
    return [
      `${n('all').toLocaleString('en-IN')}+ Opportunities`,
      `${n('live').toLocaleString('en-IN')}+ Live Jobs`,
      `${n('verified').toLocaleString('en-IN')}+ Verified Jobs`,
    ]
  }
  if (variant === 'wfh') {
    return [
      `${n('all').toLocaleString('en-IN')}+ Opportunities`,
      `${n('live').toLocaleString('en-IN')}+ Live Remote Jobs`,
      `${n('verified').toLocaleString('en-IN')}+ Verified Companies`,
    ]
  }
  if (variant === 'abroad') {
    const top = stats.countryCards?.slice(0, 3).map(c => c.name) ?? []
    return [`${n('countries')}+ Countries`, ...top, `${n('all').toLocaleString('en-IN')}+ Global Jobs`].filter(Boolean)
  }
  if (variant === 'govt' || !!govtSlug) {
    return [
      `${n('vacancies').toLocaleString('en-IN')}+ Vacancies`,
      `${n('notifications').toLocaleString('en-IN')}+ Notifications`,
      `${n('departments')}+ Departments`,
      `${n('states')} States Covered`,
    ]
  }
  return getHeroTheme(variant).bullets
}

export async function CategoryHero({ variant, govtSlug }: CategoryHeroProps) {
  const base = getHeroTheme(variant)
  const stats = await getHeroStats(variant, { govtSlug })
  const theme = { ...base, bullets: buildDynamicBullets(variant, stats, govtSlug) }
  // Only show a verified-employer stat when there is a genuine DB count to show.
  // Never pad it with a synthetic catalog figure or a fabricated marketing target.
  const genuineEmployers =
    variant === 'private' || variant === 'wfh' ? await getVerifiedEmployerCount() : 0
  const showEmployers = genuineEmployers > 0 ? genuineEmployers : undefined

  return (
    <CategoryHeroView
      theme={theme}
      stats={stats}
      showEmployers={showEmployers}
      variantClass={variant === 'wfh' ? 'category-hero--wfh' : undefined}
    />
  )
}
