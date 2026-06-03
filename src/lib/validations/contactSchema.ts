/**
 * validations/contactSchema.ts — Contact form Zod schema
 *
 * Validates the 9-field contact form + inquiry type selector.
 * Ported from the inline validation in the original submitContactForm().
 * Used in: ContactForm.tsx (client-side) + POST /api/contact (server-side).
 */

import { z } from "zod"

export const contactSchema = z.object({
  firstName:   z.string().min(2, "First name must be at least 2 characters"),
  lastName:    z.string().min(2, "Last name must be at least 2 characters"),
  email:       z.string().email("Please enter a valid email address"),
  phone:       z.string().optional(),
  subject:     z.string().min(3, "Please enter a subject"),
  userType:    z.enum(["candidate", "employer", "other"]),
  message:     z.string().min(20, "Message must be at least 20 characters"),
  terms:       z.boolean().refine(v => v === true, "You must accept the terms"),
  inquiryType: z.enum(["general","support","employer","candidate","partnership","feedback"]),
})

export type ContactFormData = z.infer<typeof contactSchema>
