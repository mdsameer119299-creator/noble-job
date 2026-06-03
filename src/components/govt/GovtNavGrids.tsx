import Link from "next/link"
import { GOVT_TOP_CATEGORIES, INDIAN_STATES, GOVT_QUALIFICATIONS } from "@/lib/config/govtTaxonomy"
import { getGovtCategoryTheme } from "@/lib/config/govtCategoryTheme"
import { GOVT_NAV_STATS } from "@/lib/services/govtNavStats"
import { CategoryIllustration } from "@/components/shared/CategoryIllustration"
import { resolveCategoryIllustrationSlug } from "@/lib/config/categoryIllustrations"
import "@/styles/govt-nav.css"

function fmt(n: number) {
  return n.toLocaleString("en-IN")
}

/** Premium browse grid with live notification & vacancy counts. */
export function GovtNavGrids() {
  const { categories, states, qualifications } = GOVT_NAV_STATS

  return (
    <div>
      <h2 className="govt-nav-section-title">Browse by Category</h2>
      <div className="govt-nav-cat-grid">
        {GOVT_TOP_CATEGORIES.map(c => {
          const theme = getGovtCategoryTheme(c.slug)
          const stat = categories[c.slug] ?? { notifications: 0, vacancies: 0 }
          return (
            <Link key={c.slug} href={`/jobs/govt/category/${c.slug}`} className="govt-nav-cat-card">
              <div className="govt-nav-cat-card__banner" style={{ background: theme.gradient }} />
              <div className="govt-nav-cat-card__body">
                <div className="govt-nav-cat-card__row">
                  <div className="govt-nav-cat-card__illus">
                    <CategoryIllustration
                      slug={resolveCategoryIllustrationSlug(c.slug)}
                      size={88}
                      alt={c.label}
                    />
                  </div>
                  <span className="govt-nav-cat-card__label">{c.label}</span>
                </div>
                <div className="govt-nav-cat-card__meta">
                  <span className="govt-nav-pill govt-nav-pill--jobs">{fmt(stat.notifications)}+ notices</span>
                  <span className="govt-nav-pill govt-nav-pill--vac">{fmt(stat.vacancies)}+ posts</span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      <h2 className="govt-nav-section-title">Govt Jobs by State / UT</h2>
      <div className="govt-nav-state-grid">
        {INDIAN_STATES.map(s => {
          const stat = states[s.slug] ?? { notifications: 0, vacancies: 0 }
          return (
            <Link key={s.slug} href={`/jobs/govt/state/${s.slug}`} className="govt-nav-state-card">
              <div className="govt-nav-state-card__name">{s.label}</div>
              <div className="govt-nav-state-card__stats">
                {fmt(stat.notifications)} notices · {fmt(stat.vacancies)} vacancies
              </div>
            </Link>
          )
        })}
      </div>

      <h2 className="govt-nav-section-title">Govt Jobs by Qualification</h2>
      <div className="govt-nav-qual-grid">
        {GOVT_QUALIFICATIONS.map(q => {
          const stat = qualifications[q.slug] ?? { notifications: 0, vacancies: 0 }
          return (
            <Link key={q.slug} href={`/jobs/govt/qualification/${q.slug}`} className="govt-nav-qual-chip">
              <span className="govt-nav-qual-chip__icon">{q.label.slice(0, 1)}</span>
              <span className="govt-nav-qual-chip__label">{q.label}</span>
              <span className="govt-nav-qual-chip__count">
                {fmt(stat.notifications)} · {fmt(stat.vacancies)} vac.
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
