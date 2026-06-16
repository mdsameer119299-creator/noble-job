/**
 * adminNotifyService — server-side notification fan-out (service-role).
 *
 * Two audiences:
 *   - alertAdmins(): in-app notification row for every admin user + (optional) a
 *     branded email to ADMIN_NOTIFICATION_EMAIL.
 *   - notifyUser(): in-app notification for a specific user (e.g. an employer),
 *     written with the service-role client so it bypasses RLS regardless of who
 *     triggered it.
 *
 * Every function is fire-and-forget safe: a notification/email failure must never
 * block registration, uploads, job posts, or admin actions.
 */
import { supabaseAdmin } from "@/lib/supabase/admin"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { sendEmail, renderEmail } from "./emailService"

/** Configurable admin alert recipient (falls back to existing admin/support vars). */
export function adminAlertEmail(): string {
  return (
    process.env.ADMIN_NOTIFICATION_EMAIL?.trim() ||
    process.env.ADMIN_EMAIL?.trim() ||
    process.env.EMAIL_SUPPORT?.trim() ||
    "support@noblejob.in"
  )
}

async function getAdminUserIds(): Promise<string[]> {
  if (!isSupabaseConfigured()) return []
  try {
    const { data } = await supabaseAdmin.from("users").select("id").eq("role", "admin")
    return (data || []).map((r) => (r as { id: string }).id)
  } catch {
    return []
  }
}

/** Insert one in-app notification per admin user. */
export async function notifyAdmins(type: string, title: string, message: string): Promise<void> {
  if (!isSupabaseConfigured()) return
  try {
    const ids = await getAdminUserIds()
    if (!ids.length) return
    const rows = ids.map((user_id) => ({ user_id, type, title, message }))
    await supabaseAdmin.from("notifications").insert(rows)
  } catch (e) {
    console.warn("[admin-notify] db insert failed:", e instanceof Error ? e.message : e)
  }
}

/** Send a branded alert email to the configured admin address. */
export async function emailAdmins(subject: string, bodyHtml: string): Promise<void> {
  try {
    await sendEmail({ to: adminAlertEmail(), subject, html: renderEmail(subject, bodyHtml) })
  } catch (e) {
    console.warn("[admin-notify] email failed:", e instanceof Error ? e.message : e)
  }
}

/**
 * Notify admins via in-app notification, optionally also by email.
 * Pass `emailHtml` to send the email; omit it for in-app only.
 */
export async function alertAdmins(opts: {
  type: string
  title: string
  message: string
  email?: boolean
  emailHtml?: string
}): Promise<void> {
  await notifyAdmins(opts.type, opts.title, opts.message)
  if (opts.email) {
    await emailAdmins(opts.title, opts.emailHtml ?? `<p style="color:#374151">${opts.message}</p>`)
  }
}

/** In-app notification for a single user (service-role; bypasses RLS). */
export async function notifyUser(
  userId: string,
  type: string,
  title: string,
  message: string
): Promise<void> {
  if (!isSupabaseConfigured() || !userId) return
  try {
    await supabaseAdmin.from("notifications").insert({ user_id: userId, type, title, message })
  } catch (e) {
    console.warn("[notify-user] failed:", e instanceof Error ? e.message : e)
  }
}
