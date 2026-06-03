'use client'
import { CountryCard } from './CountryCard'

export interface CountryCount { name: string; flag: string; jobs: number; desc: string }

export function AbroadCountriesClient({
  countries,
  onCountry = () => {},
}: {
  countries: CountryCount[]
  onCountry?: (c: string) => void
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontFamily: 'Playfair Display,serif', fontWeight: 900, color: '#0d1f4e', marginBottom: 14 }}>Top Hiring Countries</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
        {countries.map(c => (
          <CountryCard key={c.name} country={c} onClick={() => onCountry(c.name)} />
        ))}
      </div>
    </div>
  )
}
