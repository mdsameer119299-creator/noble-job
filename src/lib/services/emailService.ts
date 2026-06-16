import { Resend } from "resend"

export type EmailType =
  | "otp"
  | "contact_form"
  | "job_alert"
  | "interview_reminder"
  | "application_update"
  | "password_reset"
  | "welcome"
  | "employer_approval"

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
}

function fromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || "Noble Job <onboarding@resend.dev>"
}

function resendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key || key.includes("your_resend") || key.startsWith("re_your")) return null
  return new Resend(key)
}

export async function sendEmail(
  options: SendEmailOptions
): Promise<{ success: boolean; error?: string }> {
  const resend = resendClient()
  if (!resend) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[email] RESEND_API_KEY not set — email not sent:", options.subject)
    }
    return { success: false, error: "RESEND_API_KEY not configured" }
  }

  try {
    const { error } = await resend.emails.send({
      from: fromAddress(),
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Send failed" }
  }
}

function layout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#f0f4ff;padding:24px">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #e2e8f0">
<h1 style="color:#0d1f4e;font-size:20px;margin:0 0 16px">${title}</h1>
${bodyHtml}
<p style="color:#9ca3af;font-size:12px;margin-top:24px">Noble Job — An Initiative of NCC Foundation</p>
</div></body></html>`
}

/** Public wrapper around the branded email layout (used by notification services). */
export function renderEmail(title: string, bodyHtml: string): string {
  return layout(title, bodyHtml)
}

export async function sendOtpEmail(
  to: string,
  otp: string,
  type: "email_verify" | "password_reset"
): Promise<{ success: boolean; error?: string }> {
  const isReset = type === "password_reset"
  const title = isReset ? "Reset your password" : "Verify your email"
  const body = isReset
    ? `<p style="color:#374151">Use this code to reset your Noble Job password:</p>`
    : `<p style="color:#374151">Welcome to Noble Job. Enter this code to verify your email:</p>`
  return sendEmail({
    to,
    subject: isReset ? "Noble Job — Password reset code" : "Noble Job — Email verification code",
    html: layout(
      title,
      `${body}
<p style="font-size:28px;font-weight:800;letter-spacing:6px;color:#1847d4;margin:16px 0">${otp}</p>
<p style="color:#6b7280;font-size:13px">Valid for 10 minutes. Do not share this code.</p>`
    ),
    text: `${title}: ${otp} (valid 10 minutes)`,
  })
}

/** Sent after successful email verification (account active). */
export async function sendVerificationWelcomeEmail(
  to: string,
  firstName?: string
): Promise<{ success: boolean; error?: string }> {
  const name = firstName?.trim() || "there"
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://www.noblejob.in"
  return sendEmail({
    to,
    subject: "Welcome to Noble Job — your email is verified",
    html: layout(
      "You're all set",
      `<p style="color:#374151">Hi ${name}, your email is verified and your account is active.</p>
<p style="color:#374151"><a href="${appUrl}/auth" style="color:#1847d4;font-weight:700">Sign in</a> to continue.</p>`
    ),
    text: `Hi ${name}, your Noble Job email is verified. Sign in at ${appUrl}/auth`,
  })
}

export async function sendPasswordResetEmail(
  to: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  return sendOtpEmail(to, otp, "password_reset")
}

export async function sendEmployerApprovalEmail(
  to: string,
  companyName?: string
): Promise<{ success: boolean; error?: string }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://www.noblejob.in"
  const company = companyName?.trim() || "your company"
  return sendEmail({
    to,
    subject: "Noble Job — Employer account approved",
    html: layout(
      "Account approved",
      `<p style="color:#374151">Your employer account for <strong>${company}</strong> has been approved on Noble Job.</p>
<p style="color:#374151">You can now post jobs and manage applications.</p>
<p><a href="${appUrl}/employer/dashboard" style="display:inline-block;background:#1847d4;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Go to employer dashboard</a></p>`
    ),
    text: `Your Noble Job employer account for ${company} is approved. Dashboard: ${appUrl}/employer/dashboard`,
  })
}

export async function sendJobDecisionEmail(
  to: string,
  jobTitle: string,
  approved: boolean
): Promise<{ success: boolean; error?: string }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://www.noblejob.in"
  const title = approved ? "Your job is now live" : "Job not approved"
  const body = approved
    ? `<p style="color:#374151">Your job posting <strong>${jobTitle}</strong> has been approved and is now live on Noble Job.</p>
<p><a href="${appUrl}/employer/jobs" style="color:#1847d4;font-weight:700">View your jobs</a></p>`
    : `<p style="color:#374151">Your job posting <strong>${jobTitle}</strong> was not approved. Please review our posting guidelines and try again.</p>
<p><a href="${appUrl}/employer/jobs" style="color:#1847d4;font-weight:700">Manage your jobs</a></p>`
  return sendEmail({
    to,
    subject: approved ? "Noble Job — Job approved" : "Noble Job — Job not approved",
    html: layout(title, body),
    text: `${title}: ${jobTitle}`,
  })
}

export async function sendEmployerSuspendedEmail(
  to: string,
  companyName?: string
): Promise<{ success: boolean; error?: string }> {
  const company = companyName?.trim() || "your company"
  return sendEmail({
    to,
    subject: "Noble Job — Employer account suspended",
    html: layout(
      "Account suspended",
      `<p style="color:#374151">Your employer account for <strong>${company}</strong> has been suspended. Please contact support if you believe this is a mistake.</p>`
    ),
    text: `Your Noble Job employer account for ${company} has been suspended.`,
  })
}
