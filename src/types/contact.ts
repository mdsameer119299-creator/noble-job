/**
 * types/contact.ts — Contact page types
 *
 * Contact form data, inquiry types, online status.
 * Matches the original 6 inquiry types and 9-field contact form exactly.
 */

export type InquiryType =
  | "general" | "support" | "employer"
  | "candidate" | "partnership" | "feedback"

export interface ContactFormData {
  firstName:    string
  lastName:     string
  email:        string
  phone?:       string
  subject:      string
  userType:     "candidate" | "employer" | "other"
  message:      string
  terms:        boolean
  inquiryType:  InquiryType
}

export interface OnlineStatus {
  isOpen:     boolean
  message:    string
  nextChange: string
}
