// Build Supabase full-text search query from user input
export function buildSearchQuery(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(term => `${term}:*`)
    .join(" & ")
}

// Highlight search term in text
export function highlight(text: string, query: string): string {
  if (!query.trim()) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(`(${escaped})`, "gi"), "<mark>$1</mark>")
}
