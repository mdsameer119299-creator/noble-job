import type { NextResponse } from "next/server"
import { createClient, type ServerSupabaseClient } from "./server"
import { isSupabaseConfigured } from "./config"
import { supabaseUnavailableResponse } from "./guards"

type ApiClientResult =
  | { sb: ServerSupabaseClient; error?: undefined }
  | { sb?: undefined; error: NextResponse }

/** Returns Supabase client for API routes, or a 503 response. */
export async function requireApiSupabase(): Promise<ApiClientResult> {
  if (!isSupabaseConfigured()) {
    return { error: supabaseUnavailableResponse() }
  }
  const sb = await createClient()
  if (!sb) {
    return { error: supabaseUnavailableResponse() }
  }
  return { sb }
}
