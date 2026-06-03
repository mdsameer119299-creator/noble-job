/**
 * hooks/useDebounce.ts — Debounce hook
 *
 * Delays updating a value until the user stops typing.
 * Used in: JobSearchBar, GovtSearchBar, AiResumeSearch input fields.
 * Delay: 400ms (matches original oninput handler feel).
 */

"use client"
import { useState, useEffect } from "react"

export function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
