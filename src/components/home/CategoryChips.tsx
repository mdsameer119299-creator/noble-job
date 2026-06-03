import Link from "next/link"
import { CategoryIllustration } from "@/components/shared/CategoryIllustration"
import { buildPremiumCategoryCards } from "@/lib/services/categoryMarketplaceStats"
import "@/styles/category-illustrations.css"

/** Visual-first: illustration dominates the card (~55–60% height). */
const ILLUS_SIZE = 108

export function CategoryChips() {
  const cards = buildPremiumCategoryCards()

  return (
    <section className="cat-section-premium">
      <div className="cat-section-premium__wrap">
        <div className="cat-section-premium__header">
          <h2 className="cat-section-premium__title">Browse Jobs By Category</h2>
        </div>

        <div className="cat-section-premium__grid">
          {cards.map((cat, i) => (
            <Link key={cat.slug} href={cat.href} className="cat-card-premium">
              {cat.badge && (
                <span className="cat-card-premium__badge">
                  <span aria-hidden>{cat.badge.emoji}</span> {cat.badge.label}
                </span>
              )}
              <div className="cat-card-premium__illus">
                <CategoryIllustration slug={cat.slug} size={ILLUS_SIZE} priority={i < 4} alt={cat.name} />
              </div>
              <div className="cat-card-premium__title">{cat.name}</div>
              {cat.count && <div className="cat-card-premium__count">{cat.count}</div>}
            </Link>
          ))}

          <Link href="/jobs/private" className="cat-card-premium cat-card-premium--view-all">
            <div className="cat-card-premium__illus">
              <CategoryIllustration slug="it-software" size={100} alt="View all categories" />
            </div>
            <span className="cat-card-premium__view-all-label">View All Categories</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
