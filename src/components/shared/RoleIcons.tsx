type IconProps = { size?: number; className?: string }

/** Job seeker — person with résumé badge */
export function JobSeekerIcon({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="9" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M3.5 20v-.75c0-2.9 2.46-5.25 5.5-5.25s5.5 2.35 5.5 5.25V20"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <rect
        x="14.5"
        y="5.5"
        width="6.5"
        height="8.5"
        rx="1.25"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <path d="M16 8.2h3.5M16 10.4h2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

/** Employer — corporate building */
export function EmployerIcon({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4.5 20.5V10.2L12 6l7.5 4.2v10.3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.1"
      />
      <path d="M3.5 20.5h17" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M9.25 20.5v-4.5h2.5v4.5M13.25 20.5v-6.5h2.5v6.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <rect
        x="10.25"
        y="11.5"
        width="3.5"
        height="2.75"
        rx="0.4"
        fill="currentColor"
        fillOpacity="0.25"
      />
      <path d="M12 4.5V6.2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}
