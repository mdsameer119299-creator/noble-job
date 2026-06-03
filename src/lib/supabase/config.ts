/** True when Supabase URL and anon key are set to real values (not placeholders). */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !key) return false
  if (url.includes('your-project') || key.includes('your-anon-key')) return false
  return url.startsWith('http')
}
