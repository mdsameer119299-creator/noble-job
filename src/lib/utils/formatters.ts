/**
 * formatters.ts — Shared formatting utilities
 *
 * Currency, date, salary, number formatting used across all pages.
 */

export function formatSalary(
  min?: number,
  max?: number,
  currency = "INR"
): string {
  if (!min && !max) return "Competitive"
  const fmt = (n: number) => {
    if (currency === "INR") {
      if (n >= 100_000) return `₹${(n / 100_000).toFixed(n % 100_000 === 0 ? 0 : 1)}L`
      return `₹${(n / 1000).toFixed(0)}K`
    }
    if (n >= 1000) return `$${Math.round(n / 1000)}K`
    return `$${n}`
  }
  if (min && max) return `${fmt(min)}-${fmt(max)}/yr`
  if (min) return `${fmt(min)}+/yr`
  return `Up to ${fmt(max!)}/yr`
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now  = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 86_400_000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 7)  return `${diff} days ago`
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

export function formatNumber(n: number): string {
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`
  if (n >= 1_000)   return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export function truncate(str: string, max = 100): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str
}
