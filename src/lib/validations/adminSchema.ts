import { z } from "zod"

export const adminLoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
})

export const adminContentSchema = z.object({
  sitename:  z.string().min(2).optional(),
  tagline:   z.string().optional(),
  hero_text: z.string().optional(),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().optional(),
})

export const adminSettingsSchema = z.object({
  maintenance_mode:  z.boolean().optional(),
  registrations:     z.boolean().optional(),
  job_approvals:     z.boolean().optional(),
  featured_jobs:     z.boolean().optional(),
})
