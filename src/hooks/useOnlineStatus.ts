/**
 * hooks/useOnlineStatus.ts — Office online/offline status
 *
 * Real-time IST timezone check for the OnlineStatusBadge component.
 * Replicates the original updateOnlineStatus() JavaScript function exactly:
 *   - Checks current IST time (UTC+5:30)
 *   - Mon–Sat 10:00 AM – 6:30 PM = online
 *   - Sunday / after hours = offline
 * Updates every 60 seconds (same as original setInterval(60000)).
 */

"use client"
import { useState, useEffect } from "react"
import { isOfficeOpen } from "@/lib/constants/officeHours"

export function useOnlineStatus() {
  const [online, setOnline] = useState(false)
  useEffect(() => {
    const check = () => setOnline(isOfficeOpen())
    check()
    const timer = setInterval(check, 60_000)
    return () => clearInterval(timer)
  }, [])
  return online
}
