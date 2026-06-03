/**
 * types/api.ts — API response wrappers
 *
 * Standard response shapes for all 80 API routes.
 * Ensures consistent error handling across the frontend.
 */

export interface ApiResponse<T = unknown> {
  data?:    T
  error?:   string
  message?: string
  status:   number
}

export interface PaginatedResponse<T> {
  data:        T[]
  total:       number
  page:        number
  limit:       number
  totalPages:  number
}

export interface ApiError {
  error:   string
  code?:   string
  status:  number
}
