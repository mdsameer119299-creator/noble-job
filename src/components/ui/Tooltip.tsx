'use client'
import { useState } from 'react'

interface TooltipProps { text: string; children: React.ReactNode }

export function Tooltip({ text, children }: TooltipProps) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-block"
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-noble-navy text-white text-xs rounded-lg whitespace-nowrap shadow-lg pointer-events-none">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-noble-navy" />
        </span>
      )}
    </span>
  )
}
