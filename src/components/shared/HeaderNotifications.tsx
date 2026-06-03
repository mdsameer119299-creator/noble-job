'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { NotificationBell } from './NotificationBell'

/** Shows notification bell only when Supabase is configured and user is logged in. */
export function HeaderNotifications() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    const sb = createClient()
    if (!sb) return
    sb.auth.getUser().then(({ data: { user } }) => setShow(!!user))
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setShow(!!session?.user)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!show) return null
  return <NotificationBell />
}
