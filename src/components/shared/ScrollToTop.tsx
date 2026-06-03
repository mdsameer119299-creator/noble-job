'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Scroll-to-top control — bottom-left on homepage to avoid overlapping
 * AI CV Upload CTA, footer, and OS watermarks (bottom-right).
 */
export function ScrollToTop() {
  const pathname = usePathname()
  const isHome = pathname === '/'
  const [show, setShow] = useState(false)
  const [cvVisible, setCvVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!isHome) {
      setCvVisible(false)
      return
    }
    const el = document.getElementById('cv-analysis-section')
    if (!el) return

    const io = new IntersectionObserver(
      ([entry]) => setCvVisible(entry.isIntersecting),
      { root: null, threshold: 0.15, rootMargin: '0px 0px -80px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [isHome])

  if (!show) return null

  const liftAboveCv = isHome && cvVisible

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={`scroll-to-top-btn${liftAboveCv ? ' scroll-to-top-btn--lifted' : ''}${isHome ? ' scroll-to-top-btn--home' : ''}`}
      aria-label="Scroll to top"
    >
      ↑
    </button>
  )
}
