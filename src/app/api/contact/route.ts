import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { contactSchema } from "@/lib/validations/contactSchema"
import { sendEmail } from "@/lib/services/emailService"
import { INQUIRY_EMAIL_MAP } from "@/lib/constants/contactInfo"
import { rateLimit } from "@/lib/utils/rateLimit"

export async function GET() {
  const { isOfficeOpen } = await import("@/lib/constants/officeHours")
  return NextResponse.json({ isOpen: isOfficeOpen() })
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown"
  const { success } = rateLimit(`contact:${ip}`, 3, 60000)
  if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const body = await req.json()
  const parsed = contactSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 })

  const d = parsed.data
  const routeTo = INQUIRY_EMAIL_MAP[d.inquiryType] || "support@noblejob.in"

  if (isSupabaseConfigured()) {
    const sb = await createClient()
    if (sb) {
      const { error } = await sb.from("contact_messages").insert({
        first_name: d.firstName,
        last_name: d.lastName,
        email: d.email,
        phone: d.phone,
        subject: d.subject,
        message: d.message,
        inquiry_type: d.inquiryType,
        user_type: d.userType,
        routed_to_email: routeTo,
        status: "unread",
      })
      if (error) return NextResponse.json({ error: "Failed to save message" }, { status: 500 })
    }
  }

  await sendEmail({
    to: routeTo,
    subject: `[Noble Job Contact] ${d.subject} — ${d.inquiryType}`,
    html: `<p><strong>From:</strong> ${d.firstName} ${d.lastName} (${d.email})<br><strong>Type:</strong> ${d.inquiryType}<br><strong>User Type:</strong> ${d.userType}</p><p>${d.message.replace(/\n/g, "<br>")}</p>`,
    replyTo: d.email,
  })

  return NextResponse.json({ success: true, message: "Message sent successfully" })
}
