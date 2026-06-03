'use client'

import Image from 'next/image'
import Link from 'next/link'

/** Compact centered logo for auth — original PNG only. */
export function AuthBrandHeader() {
  return (
    <Link href="/" className="auth-page__logo-row">
      <Image
        src="/images/noble-job-logo.png"
        alt="Noble Job"
        width={52}
        height={52}
        className="rounded-full flex-shrink-0"
        style={{ objectFit: 'contain' }}
        priority
      />
      <span
        style={{
          fontFamily: '"DM Sans", sans-serif',
          fontSize: 22,
          fontWeight: 900,
          color: '#0d1f4e',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          lineHeight: 1,
          paddingBottom: 5,
          borderBottom: '2.5px solid #1847d4',
        }}
      >
        Noble Job
      </span>
    </Link>
  )
}
