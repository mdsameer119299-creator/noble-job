'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import { NobleJobLogoMark } from './NobleJobLogoMark'

type BrandLogoProps = {
  /** Light = navbar (navy text). Dark = footer (white text). */
  variant?: 'light' | 'dark'
  /** Logo image diameter in px */
  logoSize?: number
  className?: string
  style?: CSSProperties
}

export function BrandLogo({ variant = 'light', logoSize = 70, className = '', style }: BrandLogoProps) {
  const isDark = variant === 'dark'
  const titleSize = logoSize >= 64 ? 24 : 26

  return (
    <Link
      href="/"
      className={`flex items-center no-underline flex-shrink-0 ${className}`}
      style={{ gap: logoSize >= 64 ? 14 : 16, ...style }}
      aria-label="Noble Job — Home"
    >
      <NobleJobLogoMark size={logoSize} className="rounded-full" />
      <div className="flex flex-col items-start justify-center flex-shrink-0">
        <span
          style={{
            fontFamily: '"DM Sans", sans-serif',
            fontSize: titleSize,
            fontWeight: 900,
            color: isDark ? '#ffffff' : '#0d1f4e',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            lineHeight: 1,
            paddingBottom: 7,
            borderBottom: '2.5px solid #1847d4',
            display: 'inline-block',
            whiteSpace: 'nowrap',
          }}
        >
          Noble Job
        </span>
        <span
          style={{
            fontFamily: '"DM Sans", sans-serif',
            fontSize: 12,
            fontWeight: 400,
            color: isDark ? 'rgba(203, 213, 225, 0.92)' : '#4b5e7e',
            lineHeight: 1.35,
            marginTop: 7,
            whiteSpace: 'nowrap',
            letterSpacing: '0.02em',
          }}
        >
          Connecting Talent with Opportunity
        </span>
      </div>
    </Link>
  )
}
