import Link from "next/link"
import { Breadcrumbs, type Crumb } from "@/components/shared/Breadcrumbs"
import { getGovtCategoryTheme } from "@/lib/config/govtCategoryTheme"
import { getCategoryNavStat, getStateNavStat, getQualificationNavStat } from "@/lib/services/govtNavStats"
import { CategoryIllustration } from "@/components/shared/CategoryIllustration"
import { resolveCategoryIllustrationSlug } from "@/lib/config/categoryIllustrations"
import { CategoryHeroVisual } from "@/components/heroes/CategoryHeroVisual"
import { govtSlugToHeroVariant } from "@/lib/config/categoryHeroThemes"
import type { HeroVariant } from "@/lib/services/heroStatsService"
import "@/styles/category-hero.css"

type GovtScopeHeroProps = {
  crumbs: Crumb[]
  title: string
  description: string
  /** Category slug for theme + icon */
  categorySlug?: string
  stateSlug?: string
  qualificationSlug?: string
  /** When set, hero counters match the current filtered listing (not global nav stats). */
  statOverride?: { notifications: number; vacancies: number }
}

function fmt(n: number) {
  return n.toLocaleString("en-IN")
}

/** Premium banner for state / qualification / scope category pages without sector hero variant. */
export function GovtScopeHero({ crumbs, title, description, categorySlug, stateSlug, qualificationSlug, statOverride }: GovtScopeHeroProps) {
  const slug = qualificationSlug || categorySlug || "state-govt"
  const theme = getGovtCategoryTheme(slug)
  const stat = statOverride ?? (categorySlug
    ? getCategoryNavStat(categorySlug)
    : stateSlug
      ? getStateNavStat(stateSlug)
      : qualificationSlug
        ? getQualificationNavStat(qualificationSlug)
        : { notifications: 0, vacancies: 0 })

  const heroVariant = (categorySlug ? govtSlugToHeroVariant(categorySlug) : null) as HeroVariant | null

  return (
    <section className="category-hero" style={{ background: theme.gradient, minHeight: 320 }}>
      <div className="wrap category-hero__grid" style={{ paddingTop: 28, paddingBottom: 36 }}>
        <div>
          <Breadcrumbs items={crumbs} />
          <h1
            style={{
              fontFamily: "Playfair Display,serif",
              fontSize: "clamp(26px,3.2vw,38px)",
              fontWeight: 900,
              color: "#fff",
              margin: "12px 0 10px",
              lineHeight: 1.15,
            }}
          >
            {title}
          </h1>
          <p style={{ color: "rgba(255,255,255,.88)", fontSize: 15, lineHeight: 1.55, maxWidth: 520, marginBottom: 20 }}>
            {description}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
            {[
              { label: "Notifications", value: stat.notifications > 0 ? `${fmt(stat.notifications)}+` : "0" },
              { label: "Vacancies", value: stat.vacancies > 0 ? `${fmt(stat.vacancies)}+` : "0" },
            ].map(item => (
              <div
                key={item.label}
                className="category-hero__stat-box"
                style={{ minWidth: 120 }}
              >
                <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{item.value}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.7)", textTransform: "uppercase", letterSpacing: ".06em" }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
          <Link
            href="#govt-jobs"
            className="category-hero__cta-primary"
            style={{ background: "#fff", color: "#0d1f4e" }}
          >
            View listings
          </Link>
        </div>

        <div className="category-hero__visual-scene category-hero__visual-scene--desktop">
          {heroVariant ? (
            <CategoryHeroVisual variant={heroVariant} />
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                background: "rgba(255,255,255,.08)",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,.15)",
                minWidth: 200,
              }}
            >
              <CategoryIllustration
                slug={resolveCategoryIllustrationSlug(qualificationSlug || categorySlug || "government-jobs")}
                size={100}
                priority
                alt={title}
              />
              <p style={{ color: "rgba(255,255,255,.85)", fontSize: 12, fontWeight: 600, textAlign: "center", margin: 0 }}>
                Verified sarkari notifications
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
