/**
 * officeHours.ts
 *
 * Noble Job office hours — used by:
 *  - Contact page OfficeHours component
 *  - OnlineStatusBadge (IST real-time check)
 *  - /api/contact/status endpoint
 *
 * Preserves the exact schedule from the original HTML:
 * Mon–Sat 10:00 AM – 6:30 PM, Sunday Closed.
 */

export const OFFICE_HOURS = {
  weekdays: { label: 'Monday – Saturday', open: '10:00 AM', close: '6:30 PM' },
  sunday:   { label: 'Sunday', closed: true },
  timezone: 'Asia/Kolkata',  // IST = UTC+5:30
  openHour:  10,             // 10:00 AM IST
  openMin:   0,
  closeHour: 18,             // 6:30 PM IST
  closeMin:  30,
} as const

/** Returns true if the current IST time is within office hours */
export function isOfficeOpen(): boolean {
  const now    = new Date()
  const utc    = now.getTime() + now.getTimezoneOffset() * 60_000
  const ist    = new Date(utc + 5.5 * 3_600_000)
  const day    = ist.getDay()           // 0=Sun, 1=Mon…6=Sat
  const mins   = ist.getHours() * 60 + ist.getMinutes()
  const open   = OFFICE_HOURS.openHour  * 60 + OFFICE_HOURS.openMin
  const close  = OFFICE_HOURS.closeHour * 60 + OFFICE_HOURS.closeMin
  return day >= 1 && day <= 6 && mins >= open && mins < close
}
