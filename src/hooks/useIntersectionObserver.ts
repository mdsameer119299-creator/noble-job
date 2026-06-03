"use client"
import { useEffect, useRef, useState } from "react"

export function useIntersectionObserver(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null)
  const [isIntersecting, setIsIntersecting] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const observer = new IntersectionObserver(([entry]) => setIsIntersecting(entry.isIntersecting), options)
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [options])
  return { ref, isIntersecting }
}
