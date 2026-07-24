import Link from 'next/link'
import { CITY_LANDINGS } from '@/lib/data/landingCities'
import { getTailCityBySlug } from '@/lib/data/cityTaxonomy'
import { getQualifyingTailCitySlugs } from '@/lib/seo/tailCityLanding'

/**
 * Internal-link entry point for the tail-city pages under /jobs-in/[city] —
 * generated pages with no other on-site link to them would be crawlable only
 * via the sitemap, which search engines treat as a weak discovery signal
 * (this site has hit "Discovered — not indexed" before for exactly that
 * reason). Only ever links to tail cities confirmed to clear the min-job
 * gate, same rule as every other generated-page link on the site.
 */
export async function PopularCitiesSection() {
  const qualifyingSlugs = await getQualifyingTailCitySlugs()
  const tailCities = qualifyingSlugs.map(s => getTailCityBySlug(s)).filter((c): c is NonNullable<typeof c> => Boolean(c))
  if (tailCities.length === 0 && CITY_LANDINGS.length === 0) return null

  return (
    <section style={{ padding: '44px 0' }}>
      <div className="wrap">
        <div style={{ marginBottom: 22 }}>
          <h2 style={{ fontFamily: '"Playfair Display",serif', fontSize: 'clamp(20px,2.4vw,26px)', fontWeight: 900, color: '#0d1f4e', marginBottom: 4 }}>
            🏙️ Browse Jobs by City
          </h2>
          <p style={{ color: '#6b7280', fontSize: 13.5 }}>Find local openings across India&apos;s major cities and metros</p>
        </div>

        <div style={{ marginBottom: tailCities.length ? 20 : 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>
            Major Metros
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
            {CITY_LANDINGS.map(c => (
              <Link key={c.slug} href={`/${c.slug}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#eff6ff,#f5f8ff)', color: '#1847d4',
                  border: '1.5px solid #bfdbfe', padding: '11px 14px', borderRadius: 12, fontSize: 13.5, fontWeight: 800, textDecoration: 'none',
                }}>
                <span aria-hidden>📍</span> {c.city}
              </Link>
            ))}
          </div>
        </div>

        {tailCities.length > 0 && (
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>
              More Cities
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {tailCities.map(c => (
                <Link key={c.slug} href={`/jobs-in/${c.slug}`}
                  style={{ background: '#f8faff', color: '#374151', border: '1px solid #e2e8f0', padding: '7px 14px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, textDecoration: 'none' }}>
                  {c.city}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
