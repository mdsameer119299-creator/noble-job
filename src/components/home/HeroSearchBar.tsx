// HeroSearchBar — exact replica of original .search-section
// 4 fields: Job Title, Location, Category, Experience + Search button
// Below: Popular tags: Fresher, WFH, Part Time, IT Jobs, Banking Jobs
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CATEGORIES = ['IT / Software', 'Banking', 'Teaching', 'Engineering', 'Healthcare', 'Sales & Marketing', 'Finance', 'HR / Recruitment', 'Design', 'Operations']
const POP_TAGS = ['🎓 Fresher', '🏠 WFH Jobs', '⏰ Part Time', '💻 IT Jobs', '🏦 Banking Jobs', '🌍 Abroad Jobs', '📚 Teaching', '⚙️ Engineering']

export function HeroSearchBar() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [loc, setLoc] = useState('')
  const [cat, setCat] = useState('')
  const [exp, setExp] = useState('')

  const handleSearch = () => {
    const params = new URLSearchParams()
    if (q)   params.set('q', q)
    if (loc) params.set('location', loc)
    if (cat) params.set('category', cat)
    if (exp) params.set('exp', exp)
    router.push(`/jobs/private?${params}`)
  }

  const handleTag = (tag: string) => {
    const clean = tag.replace(/^[^\w]*/, '').trim()
    if (clean.toLowerCase().includes('wfh')) { router.push('/jobs/wfh'); return }
    if (clean.toLowerCase().includes('abroad')) { router.push('/jobs/abroad'); return }
    if (clean.toLowerCase().includes('fresher')) { router.push('/jobs/private?exp=fresher'); return }
    router.push(`/jobs/private?q=${encodeURIComponent(clean)}`)
  }

  return (
    <div style={{ position: 'relative', zIndex: 30, marginTop: -60, padding: '0 0 4px', background: 'transparent' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>

        {/* Search box */}
        <div
          className="hero-search-grid"
          style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
          border: '2px solid #b8cde4',
          borderRadius: 16,
          overflow: 'hidden',
          background: '#fff',
          boxShadow: '0 6px 28px rgba(13,31,78,.11)',
        }}>
          {/* Job Title */}
          <div style={{ flex: 1, padding: '20px 22px', borderRight: '1px solid #e2e8f0', display: 'flex', gap: 13, alignItems: 'center', minWidth: 0 }}>
            <div style={{ width: 42, height: 42, background: '#eff6ff', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg fill="currentColor" viewBox="0 0 24 24" width={20} height={20} style={{ color: '#1847d4' }}>
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: '#0d1f4e', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 5 }}>Job Title, Keywords</label>
              <input
                type="text"
                placeholder="e.g. Software Engineer"
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                style={{ width: '100%', border: 'none', outline: 'none', fontSize: 17, color: '#0d1f4e', background: 'transparent', fontFamily: '"DM Sans", sans-serif', fontWeight: 600 }}
              />
            </div>
          </div>

          {/* Location */}
          <div style={{ flex: 1, padding: '20px 22px', borderRight: '1px solid #e2e8f0', display: 'flex', gap: 13, alignItems: 'center', minWidth: 0 }}>
            <div style={{ width: 42, height: 42, background: '#eff6ff', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg fill="currentColor" viewBox="0 0 24 24" width={20} height={20} style={{ color: '#1847d4' }}>
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: '#0d1f4e', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 5 }}>Job Location</label>
              <input
                type="text"
                placeholder="City, State or Remote"
                value={loc}
                onChange={e => setLoc(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                style={{ width: '100%', border: 'none', outline: 'none', fontSize: 17, color: '#0d1f4e', background: 'transparent', fontFamily: '"DM Sans", sans-serif', fontWeight: 600 }}
              />
            </div>
          </div>

          {/* Category */}
          <div style={{ flex: 1, padding: '20px 22px', borderRight: '1px solid #e2e8f0', display: 'flex', gap: 13, alignItems: 'center', minWidth: 0 }}>
            <div style={{ width: 42, height: 42, background: '#eff6ff', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg fill="currentColor" viewBox="0 0 24 24" width={20} height={20} style={{ color: '#1847d4' }}>
                <path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm13 0h-3v3h-3v3h3v-3h3v3h3v-3h-3z"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: '#0d1f4e', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 5 }}>Job Category</label>
              <select
                value={cat}
                onChange={e => setCat(e.target.value)}
                style={{ width: '100%', border: 'none', outline: 'none', fontSize: 17, color: cat ? '#0d1f4e' : '#888', background: 'transparent', fontFamily: '"DM Sans", sans-serif', fontWeight: 600, cursor: 'pointer' }}
              >
                <option value="">Select Category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Experience */}
          <div style={{ flex: 1, padding: '20px 22px', borderRight: '1px solid #e2e8f0', display: 'flex', gap: 13, alignItems: 'center', minWidth: 0 }}>
            <div style={{ width: 42, height: 42, background: '#eff6ff', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg fill="currentColor" viewBox="0 0 24 24" width={20} height={20} style={{ color: '#1847d4' }}>
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: '#0d1f4e', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 5 }}>Experience Level</label>
              <select
                value={exp}
                onChange={e => setExp(e.target.value)}
                style={{ width: '100%', border: 'none', outline: 'none', fontSize: 17, color: exp ? '#0d1f4e' : '#888', background: 'transparent', fontFamily: '"DM Sans", sans-serif', fontWeight: 600, cursor: 'pointer' }}
              >
                <option value="">Select Experience</option>
                <option value="fresher">Fresher</option>
                <option value="1-3">1-3 Years</option>
                <option value="3-5">3-5 Years</option>
                <option value="5+">5+ Years</option>
              </select>
            </div>
          </div>

          {/* Search CTA button */}
          <button
            onClick={handleSearch}
            style={{
              background: '#1847d4',
              color: '#fff',
              padding: '0 44px',
              fontSize: 20,
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              width: '100%',
              justifyContent: 'center',
              fontFamily: '"Playfair Display", serif',
              letterSpacing: '-.01em',
            }}
          >
            <svg fill="currentColor" viewBox="0 0 24 24" width={22} height={22}>
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            Search Jobs
          </button>
        </div>

        {/* Popular tags row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 0', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#0d1f4e' }}>Popular:</span>
          {POP_TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => handleTag(tag)}
              style={{
                background: '#fff',
                border: '1.5px solid #b8cde4',
                borderRadius: 100,
                padding: '8px 20px',
                fontSize: 14,
                color: '#0d1f4e',
                cursor: 'pointer',
                fontFamily: '"DM Sans", sans-serif',
                fontWeight: 600,
                boxShadow: '0 1px 4px rgba(13,31,78,.06)',
              }}
            >
              {tag}
            </button>
          ))}
        </div>

      </div>
    </div>
  )
}
