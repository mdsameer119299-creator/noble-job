// TopUtilityBar — compact strip: centered NCC initiative + Job Seeker / Employer CTAs
import Link from 'next/link'
import { JobSeekerIcon, EmployerIcon } from './RoleIcons'

export function TopUtilityBar() {
  return (
    <div
      className="w-full hidden lg:block"
      style={{
        height: 44,
        background: 'linear-gradient(135deg, #0a1635 0%, #0d1f4e 55%, #122a5c 100%)',
        borderBottom: '1px solid rgba(255,255,255,.06)',
      }}
    >
      <div
        className="wrap relative flex items-center h-full"
        style={{ maxWidth: 1360, margin: '0 auto', padding: '0 24px' }}
      >
        {/* Centered NCC message — absolute for true horizontal center */}
        <p
          className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none"
          style={{
            margin: 0,
            fontSize: 11.5,
            fontWeight: 600,
            color: 'rgba(224,232,255,.92)',
            letterSpacing: '.03em',
            lineHeight: 1.35,
            whiteSpace: 'nowrap',
            maxWidth: 'calc(100% - 280px)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <span style={{ marginRight: 5 }} aria-hidden>🏛</span>
          A Livelihood Initiative by{' '}
          <strong style={{ color: '#fbbf24', fontWeight: 800 }}>NCC FOUNDATION</strong>
          <span style={{ color: 'rgba(224,232,255,.55)', margin: '0 6px' }}>·</span>
          Building India&apos;s Workforce
        </p>

        {/* Auth CTAs — right aligned */}
        <div className="ml-auto flex items-center flex-shrink-0" style={{ gap: 8, zIndex: 1 }}>
          <Link
            href="/auth?role=candidate"
            className="no-underline flex items-center transition-all"
            style={{
              padding: '5px 12px 5px 8px',
              borderRadius: 8,
              border: '1.5px solid rgba(240,112,32,.55)',
              color: '#fdba74',
              background: 'rgba(240,112,32,.1)',
              fontSize: 11.5,
              fontWeight: 800,
              whiteSpace: 'nowrap',
              gap: 6,
            }}
          >
            <JobSeekerIcon size={15} />
            Job Seeker
          </Link>
          <Link
            href="/auth?role=employer"
            className="no-underline flex items-center transition-all"
            style={{
              padding: '5px 12px 5px 8px',
              borderRadius: 8,
              background: '#f07020',
              color: '#fff',
              border: '1.5px solid #f07020',
              fontSize: 11.5,
              fontWeight: 800,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(240,112,32,.35)',
              gap: 6,
            }}
          >
            <EmployerIcon size={15} />
            Employer
          </Link>
        </div>
      </div>
    </div>
  )
}

/** Mobile-only compact utility row (shown inside nav drawer area via Navbar) */
export function TopUtilityBarMobile() {
  return (
    <div
      className="lg:hidden w-full"
      style={{
        background: 'linear-gradient(135deg, #0a1635 0%, #0d1f4e 100%)',
        borderBottom: '1px solid rgba(255,255,255,.06)',
        padding: '10px 16px',
      }}
    >
      <p
        style={{
          margin: '0 0 10px',
          fontSize: 10.5,
          fontWeight: 600,
          color: 'rgba(224,232,255,.9)',
          textAlign: 'center',
          lineHeight: 1.45,
          letterSpacing: '.02em',
        }}
      >
        <span aria-hidden>🏛 </span>
        A Livelihood Initiative by{' '}
        <strong style={{ color: '#fbbf24', fontWeight: 800 }}>NCC FOUNDATION</strong>
        {' '}· Building India&apos;s Workforce
      </p>
      <div className="flex items-center justify-center gap-2">
        <Link
          href="/auth?role=candidate"
          className="no-underline flex-1 flex items-center justify-center"
          style={{
            padding: '7px 10px',
            borderRadius: 8,
            border: '1.5px solid rgba(240,112,32,.55)',
            color: '#fdba74',
            background: 'rgba(240,112,32,.1)',
            fontSize: 11.5,
            fontWeight: 800,
            gap: 6,
          }}
        >
          <JobSeekerIcon size={14} />
          Job Seeker
        </Link>
        <Link
          href="/auth?role=employer"
          className="no-underline flex-1 flex items-center justify-center"
          style={{
            padding: '7px 10px',
            borderRadius: 8,
            background: '#f07020',
            color: '#fff',
            fontSize: 11.5,
            fontWeight: 800,
            gap: 6,
          }}
        >
          <EmployerIcon size={14} />
          Employer
        </Link>
      </div>
    </div>
  )
}
