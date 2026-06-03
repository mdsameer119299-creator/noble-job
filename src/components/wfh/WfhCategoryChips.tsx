'use client'

import { WFH_CATEGORY_LIST } from '@/lib/data/jobInventory'
import { CategoryIllustration } from '@/components/shared/CategoryIllustration'
import { resolveCategoryIllustrationSlug } from '@/lib/config/categoryIllustrations'
import '@/styles/category-illustrations.css'

interface WfhCategoryChipsProps {
  active: string
  onChange: (c: string) => void
}

export function WfhCategoryChips({ active, onChange }: WfhCategoryChipsProps) {
  return (
    <div className="wfh-categories">
      <button
        type="button"
        onClick={() => onChange('all')}
        className={`wfh-categories__chip${active === 'all' ? ' wfh-categories__chip--active' : ''}`}
      >
        <CategoryIllustration slug="work-from-home" size={40} alt="All categories" />
        All
      </button>
      {WFH_CATEGORY_LIST.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`wfh-categories__chip${active === c ? ' wfh-categories__chip--active' : ''}`}
        >
          <CategoryIllustration slug={resolveCategoryIllustrationSlug(c)} size={40} alt={c} />
          {c}
        </button>
      ))}
    </div>
  )
}
