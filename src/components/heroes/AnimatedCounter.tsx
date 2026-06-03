'use client'

import { useEffect, useRef, useState } from 'react'

interface AnimatedCounterProps {
  value: number
  duration?: number
  className?: string
  style?: React.CSSProperties
}

export function AnimatedCounter({ value, duration = 1400, className, style }: AnimatedCounterProps) {
  const [display, setDisplay] = useState(value)
  const prev = useRef(value)

  useEffect(() => {
    const start = prev.current
    const diff = value - start
    if (diff === 0) {
      setDisplay(value)
      return
    }
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(start + diff * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
      else {
        prev.current = value
        setDisplay(value)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return (
    <span className={className} style={style}>
      {display.toLocaleString('en-IN')}
    </span>
  )
}
