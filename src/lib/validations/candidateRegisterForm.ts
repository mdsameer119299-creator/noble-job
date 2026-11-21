import { candidateRegisterStep1Schema } from "./authSchema"

export type CandidateRegisterField = "firstName" | "lastName" | "email" | "phone" | "password" | "terms"
export type CandidateRegisterErrors = Partial<Record<CandidateRegisterField, string>>
export const CANDIDATE_REGISTER_FIELD_ORDER: CandidateRegisterField[] = ["firstName", "lastName", "email", "phone", "password", "terms"]

/** Trim text, drop spaces/dashes/brackets from phone ("+91 98765 43210" is what the placeholder shows), coerce terms to boolean. */
export function normalizeCandidateRegisterForm(form: Record<string, unknown>) {
  const str = (v: unknown) => (typeof v === "string" ? v : "")
  return {
    firstName: str(form.firstName).trim(),
    lastName: str(form.lastName).trim(),
    email: str(form.email).trim(),
    phone: str(form.phone).replace(/[\s\-().]/g, ""),
    password: str(form.password),
    terms: form.terms === true,
  }
}

/**
 * Same zod schema the server uses; returns ONE human message per field (never zod's default "Required",
 * which appeared for untouched fields because they were `undefined`).
 */
export function validateCandidateRegisterForm(form: Record<string, unknown>):
  | { ok: true; data: ReturnType<typeof normalizeCandidateRegisterForm> }
  | { ok: false; errors: CandidateRegisterErrors } {
  const data = normalizeCandidateRegisterForm(form)
  const parsed = candidateRegisterStep1Schema.safeParse(data)
  if (parsed.success) return { ok: true, data }
  const errors: CandidateRegisterErrors = {}
  for (const issue of parsed.error.issues) {
    const k = issue.path[0] as CandidateRegisterField
    if (k && !errors[k]) errors[k] = issue.message
  }
  return { ok: false, errors }
}
