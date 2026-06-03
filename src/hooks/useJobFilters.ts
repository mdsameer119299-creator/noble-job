"use client"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

export function useJobFilters() {
  const router = useRouter()
  const params = useSearchParams()

  const setFilter = useCallback((key: string, value: string) => {
    const p = new URLSearchParams(params.toString())
    if (value) p.set(key, value); else p.delete(key)
    p.delete("page")
    router.push(`?${p}`, { scroll: false })
  }, [router, params])

  const setPage = useCallback((value: number) => {
    const p = new URLSearchParams(params.toString())
    if (value > 1) p.set("page", String(value)); else p.delete("page")
    router.push(`?${p}`, { scroll: false })
  }, [router, params])

  const clearFilters = useCallback(() => {
    router.push("?", { scroll: false })
  }, [router])

  return {
    q: params.get("q") || "",
    category: params.get("category") || "all",
    location: params.get("location") || "",
    salary: params.get("salary") || "",
    exp: params.get("exp") || "",
    type: params.get("type") || "",
    status: params.get("status") || "all",
    sort: params.get("sort") || "latest",
    page: Number(params.get("page") || 1),
    setFilter, setPage, clearFilters,
  }
}
