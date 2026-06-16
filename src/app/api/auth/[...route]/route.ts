import { NextRequest, NextResponse } from "next/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { supabaseUnavailableResponse } from "@/lib/supabase/guards"
import {
  candidateLoginSchema,
  employerLoginSchema,
  otpSchema,
  forgotPasswordSchema,
} from "@/lib/validations/authSchema"
import { rateLimit } from "@/lib/utils/rateLimit"
import {
  authRequestMeta,
  recordAuthFailure,
  isLockedOut,
  LOCKOUT_WINDOW_MINUTES,
} from "@/lib/services/authFailureService"
import { z } from "zod"

// Per-IP, per-minute throttle for each auth action: [maxRequests, windowMs].
const AUTH_RATE_LIMITS: Record<string, [number, number]> = {
  login: [5, 60_000],
  "register/candidate": [3, 60_000],
  "register/employer": [3, 60_000],
  "verify-otp": [10, 60_000],
  "forgot-password": [3, 60_000],
  "reset-password": [5, 60_000],
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ route: string[] }> }) {
  if (!isSupabaseConfigured()) return supabaseUnavailableResponse()

  const { route } = await params
  const action = route.join("/")

  let body: Record<string, unknown> = {}
  const contentType = req.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    try {
      body = await req.json()
    } catch {
      body = {}
    }
  }

  const { ip, userAgent } = authRequestMeta(req)
  const bodyEmail = typeof body.email === "string" ? body.email : null

  // Per-IP rate limiting for sensitive auth actions (brute-force protection).
  const limit = AUTH_RATE_LIMITS[action]
  if (limit) {
    const { success } = rateLimit(`auth:${action}:${ip}`, limit[0], limit[1])
    if (!success) {
      await recordAuthFailure("rate_limit", { email: bodyEmail, ip, userAgent })
      return NextResponse.json(
        { error: "Too many requests. Please try again in a minute." },
        { status: 429 }
      )
    }
  }

  const { createClient } = await import("@/lib/supabase/server")
  const { generateAndSendOtp, verifyOtp } = await import("@/lib/services/otpService")
  const { registerCandidate, registerEmployer } = await import("@/lib/auth/registerHandlers")
  const { supabaseAdmin } = await import("@/lib/supabase/admin")

  if (action === "logout") {
    const sb = await createClient()
    if (sb) await sb.auth.signOut()
    if (contentType.includes("application/json")) {
      return NextResponse.json({ success: true })
    }
    return NextResponse.redirect(new URL("/auth", req.url), { status: 303 })
  }

  const sb = await createClient()
  if (!sb) return supabaseUnavailableResponse()

  if (action === "login") {
    const parsed = candidateLoginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    const { email, password } = parsed.data
    if (await isLockedOut(email, "login")) {
      await recordAuthFailure("lockout", { email, ip, userAgent }, true)
      return NextResponse.json(
        { error: `Too many failed login attempts. Try again in ${LOCKOUT_WINDOW_MINUTES} minutes.` },
        { status: 429 }
      )
    }
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) {
      await recordAuthFailure("login", { email, ip, userAgent })
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    // Return the user's role so the client routes to the correct dashboard
    // instead of always pushing to /candidate/dashboard.
    const { data: profile } = await sb.from("users").select("role").eq("id", data.user.id).single()
    const role = (profile as { role?: string } | null)?.role ?? "candidate"
    return NextResponse.json({ user: data.user, role })
  }

  if (action === "register/employer") {
    const result = await registerEmployer(body)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ success: true, userId: result.userId })
  }

  if (action === "register/candidate") {
    const result = await registerCandidate(body)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ success: true, userId: result.userId })
  }

  if (action === "verify-otp") {
    const parsed = z
      .object({ email: z.string().email(), otp: otpSchema.shape.otp, type: z.string().optional() })
      .safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid OTP request" }, { status: 400 })
    }
    const { email, otp, type } = parsed.data
    const otpType = type || "email_verify"
    if (await isLockedOut(email, "otp_verify")) {
      await recordAuthFailure("lockout", { email, ip, userAgent }, true)
      return NextResponse.json(
        { error: `Too many incorrect codes. Try again in ${LOCKOUT_WINDOW_MINUTES} minutes.` },
        { status: 429 }
      )
    }
    const valid = await verifyOtp(email, otp, otpType)
    if (!valid) {
      await recordAuthFailure("otp_verify", { email, ip, userAgent })
      return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 })
    }

    if (otpType === "email_verify") {
      const { data: userRow, error: userErr } = await supabaseAdmin
        .from("users")
        .update({ email_verified: true, status: "active" })
        .eq("email", email)
        .select("id, role")
        .single()

      if (userErr || !userRow?.id) {
        return NextResponse.json({ error: "Account not found" }, { status: 404 })
      }

      const { error: authConfirmErr } = await supabaseAdmin.auth.admin.updateUserById(userRow.id, {
        email_confirm: true,
      })
      if (authConfirmErr) {
        return NextResponse.json({ error: authConfirmErr.message }, { status: 400 })
      }

      const { sendVerificationWelcomeEmail } = await import("@/lib/services/emailService")
      await sendVerificationWelcomeEmail(email)

      if (userRow.role === "employer") {
        await supabaseAdmin.from("employers").update({ status: "active" }).eq("user_id", userRow.id)
      }
    }
    return NextResponse.json({ success: true })
  }

  if (action === "forgot-password") {
    const parsed = forgotPasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 })
    }
    await generateAndSendOtp(parsed.data.email, "password_reset")
    return NextResponse.json({ success: true, message: "OTP sent to email" })
  }

  if (action === "reset-password") {
    const parsed = z
      .object({
        email: z.string().email(),
        otp: otpSchema.shape.otp,
        password: z.string().min(8),
        confirmPassword: z.string(),
      })
      .refine((d) => d.password === d.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
      })
      .safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    if (await isLockedOut(parsed.data.email, "password_reset")) {
      await recordAuthFailure("lockout", { email: parsed.data.email, ip, userAgent }, true)
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${LOCKOUT_WINDOW_MINUTES} minutes.` },
        { status: 429 }
      )
    }
    const valid = await verifyOtp(parsed.data.email, parsed.data.otp, "password_reset")
    if (!valid) {
      await recordAuthFailure("password_reset", { email: parsed.data.email, ip, userAgent })
      return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 })
    }

    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", parsed.data.email)
      .single()

    if (!userRow?.id) {
      return NextResponse.json({ error: "No account found for this email" }, { status: 404 })
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userRow.id, {
      password: parsed.data.password,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Unknown route" }, { status: 404 })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ route: string[] }> }) {
  const { route } = await params
  if (route[0] === "logout") {
    if (!isSupabaseConfigured()) {
      return NextResponse.redirect(new URL("/auth", req.url))
    }
    const { createClient } = await import("@/lib/supabase/server")
    const sb = await createClient()
    if (sb) await sb.auth.signOut()
    return NextResponse.redirect(new URL("/auth", req.url))
  }

  if (route[0] === "me") {
    if (!isSupabaseConfigured()) return NextResponse.json({ user: null })
    const { createClient } = await import("@/lib/supabase/server")
    const sb = await createClient()
    if (!sb) return NextResponse.json({ user: null })
    const {
      data: { user },
    } = await sb.auth.getUser()
    if (!user) return NextResponse.json({ user: null })
    const { data: profile } = await sb.from("users").select("id, email, role, status").eq("id", user.id).single()
    return NextResponse.json({ user: profile })
  }
  return NextResponse.json({ error: "Not found" }, { status: 404 })
}
