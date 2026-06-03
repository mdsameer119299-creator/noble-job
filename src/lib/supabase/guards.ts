import { NextResponse } from "next/server"

export const AUTH_UNAVAILABLE_MESSAGE =
  "Login unavailable until authentication is configured"

/** JSON 503 for auth/database API routes when Supabase env is missing. */
export function supabaseUnavailableResponse() {
  return NextResponse.json({ error: AUTH_UNAVAILABLE_MESSAGE }, { status: 503 })
}
