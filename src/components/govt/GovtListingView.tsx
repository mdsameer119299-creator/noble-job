import { Breadcrumbs, type Crumb } from "@/components/shared/Breadcrumbs"
import { CategoryHero } from "@/components/heroes/CategoryHero"
import { govtSlugToHeroVariant } from "@/lib/config/categoryHeroThemes"
import { GovtScopeHero } from "@/components/govt/GovtScopeHero"
import { GovtJobListCard } from "./GovtJobListCard"
import { GovtContentCard } from "./GovtContentCard"
import { GovtFilterBar } from "./GovtFilterBar"
import { GovtPagination } from "./GovtPagination"
import type { GovtJob, GovtContentItem } from "@/types/govtJob"

interface BaseProps {
  crumbs: Crumb[]
  title: string
  description: string
  icon?: string
  color?: string
  /** Category slug for premium sector heroes (banking, railway, etc.) */
  categorySlug?: string
  stateSlug?: string
  qualificationSlug?: string
  total: number
  vacanciesTotal?: number
  page: number
  totalPages: number
  basePath: string
  query: Record<string, string | undefined>
}

interface JobsProps extends BaseProps {
  kind: "jobs"
  items: GovtJob[]
  facets: { departments: string[]; experiences: string[] }
  hideFilters?: ("state" | "qualification")[]
}

interface ContentProps extends BaseProps {
  kind: "content"
  items: GovtContentItem[]
}

export function GovtListingView(props: JobsProps | ContentProps) {
  const { crumbs, title, description, categorySlug, stateSlug, qualificationSlug, total, vacanciesTotal, page, totalPages, basePath, query } = props
  const heroStats = vacanciesTotal != null ? { notifications: total, vacancies: vacanciesTotal } : undefined
  const heroVariant = categorySlug ? govtSlugToHeroVariant(categorySlug) : null

  return (
    <div style={{ background: "#f8faff", minHeight: "100vh" }}>
      {heroVariant ? (
        <CategoryHero variant={heroVariant} govtSlug={categorySlug} />
      ) : categorySlug || stateSlug || qualificationSlug ? (
        <GovtScopeHero
          crumbs={crumbs}
          title={title}
          description={description}
          categorySlug={categorySlug || (stateSlug ? "state-govt" : undefined)}
          stateSlug={stateSlug}
          qualificationSlug={qualificationSlug}
          statOverride={heroStats}
        />
      ) : null}

      <div className="wrap" style={{ paddingTop: 22, paddingBottom: 48 }} id="govt-jobs">
        {heroVariant && <Breadcrumbs items={crumbs} />}
        {props.kind === "jobs" && (
          <GovtFilterBar hide={props.hideFilters} departments={props.facets.departments} experiences={props.facets.experiences} />
        )}

        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>
          <strong style={{ color: "#0d1f4e" }}>{total}</strong> {props.kind === "jobs" ? "notifications" : "entries"} found
        </p>

        {total === 0 ? (
          <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0", padding: 40, textAlign: "center", color: "#6b7280" }}>
            No entries found. New notifications are imported and published automatically every day.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {props.kind === "jobs"
              ? props.items.map(j => <GovtJobListCard key={j.slug || j.id} job={j} />)
              : props.items.map(c => <GovtContentCard key={c.id} item={c} />)}
          </div>
        )}

        <GovtPagination basePath={basePath} page={page} totalPages={totalPages} query={query} />
      </div>
    </div>
  )
}
