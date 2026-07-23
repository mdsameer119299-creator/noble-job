'use client'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { SaveResumePopup } from './SaveResumePopup'

interface GovtApplyLinkButtonProps {
  href: string
  jobTitle?: string
  /** Only the primary "Apply Online" link is intercepted; secondary links
   * (Check Result, Admit Card, etc.) navigate straight through. */
  intercept: boolean
  style: CSSProperties
  children: ReactNode
}

/**
 * Renders exactly like the plain `<a target="_blank">` it replaces. When
 * `intercept` is true, clicking opens SaveResumePopup first; any path through
 * that popup (save, skip, or guest) ends by opening the real link in a new
 * tab, so the government destination is unchanged either way.
 */
export function GovtApplyLinkButton({ href, jobTitle, intercept, style, children }: GovtApplyLinkButtonProps) {
  const [open, setOpen] = useState(false)

  if (!intercept) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" style={style}>
        {children}
      </a>
    )
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={{ ...style, fontFamily: 'inherit', cursor: 'pointer' }}>
        {children}
      </button>
      <SaveResumePopup
        open={open}
        onClose={() => setOpen(false)}
        onContinue={() => window.open(href, '_blank', 'noopener,noreferrer')}
        jobTitle={jobTitle}
      />
    </>
  )
}
