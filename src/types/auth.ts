/**
 * types/auth.ts — Authentication types
 *
 * User roles, registration steps, OTP, session types.
 * Used across all auth components and API routes.
 */

export type UserRole = "admin" | "employer" | "candidate"
export type UserStatus = "active" | "suspended" | "pending"

export interface AuthUser {
  id:     string
  email:  string
  role:   UserRole
  status: UserStatus
}

export interface EmployerRegisterStep1 {
  firstName:  string
  lastName:   string
  email:      string
  phone:      string
  password:   string
  terms:      boolean
}

export interface EmployerRegisterStep2 {
  companyName:  string
  website?:     string
  city:         string
  industry:     string
  companySize:  string
  designation:  string
}

export interface CandidateRegisterStep1 {
  firstName:  string
  lastName:   string
  email:      string
  phone:      string
  password:   string
  terms:      boolean
}

export interface CandidateRegisterStep2 {
  experienceYears:  number
  category:         string
  expectedSalary?:  number
  skills:           string[]
}

export type OtpPurpose = "email_verify" | "phone_verify" | "password_reset"
