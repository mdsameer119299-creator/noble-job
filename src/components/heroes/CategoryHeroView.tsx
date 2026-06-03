'use client'

import Link from 'next/link'
import type { HeroTheme } from '@/lib/config/categoryHeroThemes'
import type { HeroStatsPayload } from '@/lib/services/heroStatsService'
import { AnimatedCounter } from './AnimatedCounter'
import { CategoryHeroVisual } from './CategoryHeroVisual'

interface CategoryHeroViewProps {
  theme: HeroTheme
  stats: HeroStatsPayload
  showEmployers?: number
  variantClass?: string
}

export function CategoryHeroView({ theme, stats, showEmployers, variantClass }: CategoryHeroViewProps) {
  const cards = stats.floatingCards.map(c => ({
    label: c.label,
    sub: c.sub,
    extra: c.accent,
  }))

  return (
    <section
      className={`category-hero ${variantClass ?? ''}`.trim()}
      style={{ background: theme.gradient }}
      aria-label={`${theme.title} hero`}
    >
      <div className="category-hero__orb" style={{ width: 320, height: 320, top: -80, right: -60, background: theme.accentMuted }} />
      <div
        className="category-hero__orb"
        style={{
          width: 200,
          height: 200,
          bottom: -40,
          left: -40,
          background: 'rgba(255,255,255,.06)',
          animationDelay: '2s',
        }}
      />

      {theme.visual === 'govt' && (
        <div
          className="category-hero__silhouette"
          style={{
            backgroundImage: `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 200 120\'><path d=\'M20 110 L100 15 L180 110 Z\' fill=\'%23fbbf24\' opacity=\'0.5\'/></svg>')}")`,
          }}
        />
      )}

      <div className="wrap category-hero__grid">
        <div>
          <div
            className="category-hero__badge"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(255,255,255,.1)',
              border: '1px solid rgba(255,255,255,.2)',
              borderRadius: 24,
              padding: '6px 16px',
              marginBottom: 16,
            }}
          >
            <span className="category-hero__live-dot" aria-hidden />
            <span style={{ color: '#e0e8ff', fontWeight: 700 }}>{theme.badge}</span>
          </div>

          <h1
            style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: 'clamp(34px, 4.2vw, 50px)',
              fontWeight: 900,
              color: '#fff',
              lineHeight: 1.1,
              marginBottom: 12,
            }}
          >
            {theme.title}
            {theme.titleAccent && (
              <>
                <br />
                <span style={{ color: theme.accent }}>{theme.titleAccent}</span>
              </>
            )}
          </h1>

          {theme.bullets && theme.bullets.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {theme.bullets.map((b, i) => (
                <span
                  key={`${b}-${i}`}
                  className="category-hero__bullet"
                  style={{
                    background: theme.accentMuted,
                    color: '#fff',
                    border: `1px solid ${theme.accent}44`,
                    padding: '5px 12px',
                    borderRadius: 20,
                    fontWeight: 700,
                  }}
                >
                  {b}
                </span>
              ))}
            </div>
          )}

          <p
            className="category-hero__desc"
            style={{
              color: 'rgba(255,255,255,.82)',
              lineHeight: 1.65,
              maxWidth: 500,
              marginBottom: 20,
            }}
          >
            {theme.description}
          </p>

          {showEmployers != null && showEmployers > 0 && (
            <p style={{ color: 'rgba(255,255,255,.7)', fontSize: 14, marginBottom: 14, fontWeight: 600 }}>
              {showEmployers.toLocaleString('en-IN')}+ verified employer partners hiring remotely
            </p>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Link
              href={theme.primaryCta.href}
              className="category-hero__cta-primary"
              style={{ background: '#f07020', color: '#fff' }}
            >
              {theme.primaryCta.label} →
            </Link>
            {theme.secondaryCta && (
              <Link href={theme.secondaryCta.href} className="category-hero__cta-secondary">
                {theme.secondaryCta.label}
              </Link>
            )}
          </div>
        </div>

        <div className="category-hero__visual-scene category-hero__visual-scene--desktop">
          <CategoryHeroVisual variant={theme.visual} />
        </div>

        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 10,
              marginBottom: 14,
            }}
          >
            {stats.counters.map(c => (
              <div key={c.key} className="category-hero__stat-box">
                <div
                  style={{
                    fontFamily: 'Playfair Display, serif',
                    fontSize: 'clamp(24px, 2.8vw, 30px)',
                    fontWeight: 900,
                    color: theme.accent,
                    lineHeight: 1.1,
                  }}
                >
                  <AnimatedCounter value={c.value} />
                  <span style={{ fontSize: 15, color: 'rgba(255,255,255,.7)' }}>+</span>
                </div>
                <div className="category-hero__stat-label" style={{
                  color: 'rgba(255,255,255,.7)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '.05em',
                  marginTop: 4,
                }}>
                  {c.label}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 10,
            }}
          >
            {cards.slice(0, 6).map((card, i) => (
              <div key={`${card.label}-${i}`} className="category-hero__float-card">
                {card.extra && <span style={{ fontSize: 18, marginRight: 6 }}>{card.extra}</span>}
                <div className="category-hero__float-card-title" style={{ fontWeight: 800, color: '#fff' }}>
                  {card.label}
                </div>
                {card.sub && (
                  <div className="category-hero__float-card-sub" style={{ color: 'rgba(255,255,255,.7)', marginTop: 2 }}>
                    {card.sub}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
