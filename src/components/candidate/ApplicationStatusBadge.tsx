'use client'
import type { ApplicationStatus } from '@/types/application'

const STYLES: Record<ApplicationStatus, { bg: string; color: string; label: string }> = {
  new: { bg: '#eff6ff', color: '#1847d4', label: 'New' },
  shortlisted: { bg: '#fef3c7', color: '#b45309', label: 'Shortlisted' },
  interview: { bg: '#f3e8ff', color: '#7c3aed', label: 'Interview' },
  hired: { bg: '#dcfce7', color: '#15803d', label: 'Hired' },
  rejected: { bg: '#fef2f2', color: '#dc2626', label: 'Rejected' },
}

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const s = STYLES[status] || STYLES.new
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 800,
        background: s.bg,
        color: s.color,
      }}
    >
      {s.label}
    </span>
  )
}
