import { requireRole, type UserRole } from "./requireRole"

export function withRole(role: UserRole) {
  return async function guard() {
    return requireRole(role)
  }
}
