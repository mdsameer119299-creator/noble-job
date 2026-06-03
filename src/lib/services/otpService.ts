import { supabaseAdmin } from "@/lib/supabase/admin"
import { sendOtpEmail } from "./emailService"
import * as crypto from "crypto"

export async function generateAndSendOtp(email: string, type: "email_verify" | "password_reset"): Promise<void> {
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const hash = crypto.createHash("sha256").update(otp).digest("hex")
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  await supabaseAdmin.from("otp_tokens").insert({ email, otp_hash: hash, type, expires_at: expiresAt })

  await sendOtpEmail(email, otp, type)
}

export async function verifyOtp(email: string, otp: string, type: string): Promise<boolean> {
  const hash = crypto.createHash("sha256").update(otp).digest("hex")
  const { data } = await supabaseAdmin.from("otp_tokens")
    .select("id, expires_at")
    .eq("email", email).eq("otp_hash", hash).eq("type", type).eq("is_used", false)
    .gt("expires_at", new Date().toISOString())
    .single()
  if (!data) return false
  await supabaseAdmin.from("otp_tokens").update({ is_used: true }).eq("id", data.id)
  return true
}
