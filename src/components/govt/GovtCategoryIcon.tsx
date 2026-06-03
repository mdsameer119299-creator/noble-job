import type { ReactNode } from "react"

/** Unified line icons for govt browse cards (SVG — consistent enterprise style). */
export function GovtCategoryIcon({ slug, size = 28 }: { slug: string; size?: number }) {
  const s = size
  const stroke = "currentColor"
  const sw = 1.75

  const icons: Record<string, ReactNode> = {
    "latest-notifications": (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" stroke={stroke} strokeWidth={sw} />
        <path d="M8 9h8M8 13h5" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        <circle cx="17" cy="7" r="3" fill="currentColor" opacity=".25" />
      </svg>
    ),
    "all-india": (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke={stroke} strokeWidth={sw} />
        <path d="M8 12h8M12 8v8" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    ),
    "state-govt": (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 18V8l8-4 8 4v10" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        <path d="M9 18v-5h6v5" stroke={stroke} strokeWidth={sw} />
      </svg>
    ),
    banking: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M12 4l9 6H3l9-6z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      </svg>
    ),
    railway: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="4" y="8" width="16" height="8" rx="2" stroke={stroke} strokeWidth={sw} />
        <circle cx="8" cy="18" r="2" stroke={stroke} strokeWidth={sw} />
        <circle cx="16" cy="18" r="2" stroke={stroke} strokeWidth={sw} />
        <path d="M8 8V6h8v2" stroke={stroke} strokeWidth={sw} />
      </svg>
    ),
    ssc: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="5" y="3" width="14" height="18" rx="2" stroke={stroke} strokeWidth={sw} />
        <path d="M8 8h8M8 12h8M8 16h5" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    ),
    upsc: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 18h16M6 18V10l6-5 6 5v8" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        <path d="M10 18v-4h4v4" stroke={stroke} strokeWidth={sw} />
      </svg>
    ),
    defence: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 3l8 4v6c0 4-3.5 7-8 8-4.5-1-8-4-8-8V7l8-4z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      </svg>
    ),
    police: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 2l3 6h6l-5 4 2 7-6-4-6 4 2-7-5-4h6l3-6z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      </svg>
    ),
    teaching: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 3L2 8l10 5 10-5-10-5z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        <path d="M6 11v5c0 2 2.5 4 6 4s6-2 6-4v-5" stroke={stroke} strokeWidth={sw} />
      </svg>
    ),
    psu: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="10" width="7" height="10" stroke={stroke} strokeWidth={sw} />
        <rect x="10" y="6" width="7" height="14" stroke={stroke} strokeWidth={sw} />
        <rect x="17" y="12" width="4" height="8" stroke={stroke} strokeWidth={sw} />
      </svg>
    ),
    engineering: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M14 4l6 6-8 10H6v-6l8-10z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        <circle cx="9" cy="9" r="1.5" fill="currentColor" />
      </svg>
    ),
    "admit-cards": (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="4" y="5" width="16" height="14" rx="2" stroke={stroke} strokeWidth={sw} />
        <path d="M8 10h8M8 14h4" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        <path d="M16 8l2 2" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    ),
    results: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M8 20h8M10 16h4M12 4v2M6 8l1.5 1.5M18 8L16.5 9.5" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        <circle cx="12" cy="11" r="4" stroke={stroke} strokeWidth={sw} />
      </svg>
    ),
    "answer-keys": (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="8" cy="15" r="4" stroke={stroke} strokeWidth={sw} />
        <path d="M11 12l9-7M16 3l4 4M20 3l-4 4" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    ),
    syllabus: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M6 4h12v16H6z" stroke={stroke} strokeWidth={sw} />
        <path d="M9 8h6M9 12h6M9 16h4" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    ),
    "previous-papers": (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M8 4h11v16H5V7l3-3z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        <path d="M8 7H5M8 11h7M8 15h7" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    ),
    "8th-pass": (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 20h16M8 20V10l4-3 4 3v10" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        <path d="M10 14h4" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        <circle cx="12" cy="6" r="2" stroke={stroke} strokeWidth={sw} />
      </svg>
    ),
    "10th-pass": (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="6" y="4" width="12" height="16" rx="2" stroke={stroke} strokeWidth={sw} />
        <path d="M9 8h6M9 12h6M9 16h4" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    ),
    "12th-pass": (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 3l7 4v10l-7 4-7-4V7l7-4z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        <path d="M9 11h6M9 14h4" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    ),
    iti: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M8 12h8l-2 8H10l-2-8z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        <circle cx="12" cy="7" r="3" stroke={stroke} strokeWidth={sw} />
      </svg>
    ),
    diploma: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 14l8-4-8-4-8 4 8 4z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        <path d="M6 18h12" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    ),
    graduate: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 3L2 9l10 6 10-6-10-6z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        <path d="M6 12v4c0 2 2.5 4 6 4s6-2 6-4v-4" stroke={stroke} strokeWidth={sw} />
      </svg>
    ),
    "post-graduate": (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 2l8 4v6c0 4-3.5 7-8 8-4.5-1-8-8-8V6l8-4z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        <path d="M8 22h8" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    ),
    "b-tech": (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 2l9 5v6c0 5-4 9-9 9s-9-4-9-9V7l9-5z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        <path d="M9 14h6" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    ),
    mba: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="4" y="6" width="16" height="12" rx="2" stroke={stroke} strokeWidth={sw} />
        <path d="M8 10h8M8 14h5" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    ),
    mca: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="5" width="18" height="12" rx="2" stroke={stroke} strokeWidth={sw} />
        <path d="M7 9h3v3H7zM14 9h3v3h-3z" stroke={stroke} strokeWidth={1.5} fill="currentColor" fillOpacity="0.2" />
      </svg>
    ),
  }

  return <span className="govt-cat-icon">{icons[slug] ?? icons["latest-notifications"]}</span>
}
