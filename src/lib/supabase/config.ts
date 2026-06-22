/** True when Supabase URL and anon key are set to real values (not placeholders). */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !key) return false
  if (url.includes('your-project') || key.includes('your-anon-key')) return false
  return url.startsWith('http')
}

/**
 * True when the URL + SERVICE-ROLE key are real (not placeholders). Use this for
 * server-only write paths that go through supabaseAdmin (ingestion, expiry,
 * monitoring) — they never touch the anon key, so gating them on
 * isSupabaseConfigured() (which requires the anon key) wrongly disables writes
 * in environments that only provide the service role (e.g. GitHub Actions),
 * yielding fetched>0 / published=0.
 */
export function isSupabaseAdminConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return false
  if (url.includes('your-project') || url.includes('placeholder')) return false
  if (key.includes('placeholder')) return false
  return url.startsWith('http')
}
