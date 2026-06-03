export interface PaginationMeta {
  page: number; limit: number; total: number; totalPages: number
}

export function getPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return { page, limit, total, totalPages: Math.ceil(total / limit) }
}

export function getPaginationRange(page: number, totalPages: number, delta = 2): number[] {
  const range: number[] = []
  for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) range.push(i)
  return range
}
