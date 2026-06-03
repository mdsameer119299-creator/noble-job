/**
 * validations/authSchema.ts — Authentication form schemas
 *
 * All auth form validations:
 *  - Employer login, Employer register step 1 + step 2
 *  - Candidate login, Candidate register step 1 + step 2
 *  - OTP verification, Forgot password, Reset password
 */

import { z } from "zod"

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[0-9]/, "Must contain at least one number")

export const employerLoginSchema = z.object({
  email:    z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

export const employerRegisterStep1Schema = z.object({
  firstName: z.string().min(2),
  lastName:  z.string().min(2),
  email:     z.string().email(),
  phone:     z.string().regex(/^\+?[0-9]{10,14}$/, "Invalid phone number"),
  password:  passwordSchema,
  terms:     z.boolean().refine(v => v, "You must accept terms"),
})

export const employerRegisterStep2Schema = z.object({
  companyName:  z.string().min(2),
  website:      z.string().url().optional().or(z.literal("")),
  city:         z.string().min(2),
  industry:     z.string().min(1),
  companySize:  z.string().min(1),
  designation:  z.string().min(2),
})

export const candidateLoginSchema = employerLoginSchema

export const candidateRegisterStep1Schema = employerRegisterStep1Schema

export const candidateRegisterStep2Schema = z.object({
  experienceYears:  z.number().min(0).max(50),
  category:         z.string().min(1),
  expectedSalary:   z.number().optional(),
  skills:           z.array(z.string()).min(1),
})

export const otpSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits").regex(/^\d{6}$/, "OTP must be numeric"),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

export const resetPasswordSchema = z.object({
  password:        passwordSchema,
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})
