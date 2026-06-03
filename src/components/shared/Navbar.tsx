'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NavLogo } from './NavLogo'
import { TopUtilityBarMobile } from './TopUtilityBar'
import { JobSeekerIcon, EmployerIcon } from './RoleIcons'
import { HeaderNotifications } from './HeaderNotifications'
const NAV_ITEMS = [
  { label: 'Home', href: '/' },
  { label: 'Private Jobs', href: '/jobs/private' },
  { label: 'Govt Jobs', href: '/jobs/govt' },
  { label: 'Abroad Jobs', href: '/jobs/abroad' },
  { label: '🏠 WFH', href: '/jobs/wfh', pill: true },
  { label: 'Contact Us', href: '/contact' },
]

const HEADER_GRID =
  'grid items-center w-full gap-x-4 lg:grid-cols-[minmax(0,auto)_minmax(0,1fr)_minmax(200px,max-content)]'

export function Navbar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="site-header">
      <TopUtilityBarMobile />

      <div className="site-header__utility">
        <div className="site-header__utility-inner">
          <div aria-hidden className="hidden lg:block" />
          <p className="site-header__utility-msg">
            <span style={{ marginRight: 5 }} aria-hidden>🏛</span>
            A Livelihood Initiative by{' '}
            <strong style={{ color: '#fbbf24', fontWeight: 800 }}>NCC FOUNDATION</strong>
            <span style={{ color: 'rgba(224,232,255,.55)', margin: '0 6px' }}>·</span>
            Building India&apos;s Workforce
          </p>
          <HeaderAuthLinks />
        </div>
      </div>

      <nav className="site-header__nav" aria-label="Main">
        <div className="site-header__nav-inner">
          <NavLogo />

          <div className="hidden lg:flex items-center justify-center min-w-0 gap-2 overflow-hidden">
            {NAV_ITEMS.map(item => {
              const active =
                pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href))
              if (item.pill) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="no-underline flex-shrink-0 mx-1"
                    style={{
                      background: 'linear-gradient(135deg,#1847d4,#7c3aed)',
                      color: '#fff',
                      padding: '8px 15px',
                      borderRadius: '22px',
                      fontSize: '14px',
                      fontWeight: 800,
                      boxShadow: '0 4px 14px rgba(124,58,237,.28)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.label}
                  </Link>
                )
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="no-underline flex-shrink-0 transition-all duration-200"
                  style={{
                    fontSize: '15px',
                    fontWeight: 800,
                    color: active ? '#1847d4' : '#2d3748',
                    padding: '8px 12px',
                    borderRadius: '9px',
                    border: active ? '2px solid #1847d4' : '2px solid transparent',
                    background: active ? '#eff6ff' : 'transparent',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>

          <div className="hidden lg:flex justify-end items-center flex-shrink-0">
            <Link
              href="/employer/jobs/new"
              className="no-underline inline-flex items-center"
              style={{
                background: '#f07020',
                color: '#fff',
                padding: '9px 18px',
                borderRadius: 9,
                fontSize: 14,
                fontWeight: 800,
                boxShadow: '0 3px 10px rgba(240,112,32,.3)',
                whiteSpace: 'nowrap',
              }}
            >
              Post a Job for Free
            </Link>
          </div>

          <button
            type="button"
            className="lg:hidden ml-auto p-2 flex-shrink-0 col-start-3"
            onClick={() => setOpen(!open)}
            aria-label="Open menu"
            aria-expanded={open}
          >
            <span className="block w-6 h-0.5 bg-noble-navy mb-1" />
            <span className="block w-6 h-0.5 bg-noble-navy mb-1" />
            <span className="block w-6 h-0.5 bg-noble-navy" />
          </button>
        </div>
      </nav>

      {open && (
        <div className="lg:hidden border-t border-noble-border pb-4 px-4 bg-white">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block py-2 text-sm font-bold no-underline"
              style={{ color: '#0d1f4e' }}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/employer/jobs/new"
            onClick={() => setOpen(false)}
            className="block mt-3 text-center py-2.5 rounded-lg text-sm font-bold no-underline"
            style={{ background: '#f07020', color: '#fff' }}
          >
            Post a Job for Free
          </Link>
        </div>
      )}
    </header>
  )
}

function HeaderAuthLinks() {
  return (
    <div className="site-header__auth" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <HeaderNotifications />
      <Link href="/auth?role=candidate" className="site-header__auth-link site-header__auth-link--seeker no-underline">
        <JobSeekerIcon size={15} />
        Job Seeker
      </Link>
      <Link href="/auth?role=employer" className="site-header__auth-link site-header__auth-link--employer no-underline">
        <EmployerIcon size={15} />
        Employer
      </Link>
    </div>
  )
}
