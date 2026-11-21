import { z } from "zod"
import { EXPERIENCE_LEVELS } from "@/lib/constants/jobCategories"

/**
 * Whitelist for PUT /api/candidate/profile.
 * Previously the raw request body was passed to `.update(body)`, letting a signed-in candidate overwrite ANY column of
 * their own row (e.g. profile_score, resume_url, user_id). Only these fields can now be changed, each validated.
 * Unknown keys are dropped silently.
 */
export const EXPERIENCE_VALUES = EXPERIENCE_LEVELS.map(e => e.value) as readonly string[]

const text = (max: number) => z.string().trim().max(max)
/** Existing forms submit "" for untouched fields (e.g. a new candidate has no category yet): treat as "not provided". */
const optionalNonEmpty = (max: number) => z.preprocess(v => (typeof v === "string" && v.trim() === "" ? undefined : v), text(max).min(1).optional())

export const candidateProfileUpdateSchema = z.object({
  first_name: optionalNonEmpty(60),
  last_name: optionalNonEmpty(60),
  phone: z.string().regex(/^\+?[0-9]{10,14}$/, "Enter a valid phone number").nullable().optional().or(z.literal("").transform(() => null)),
  city: text(80).optional(),
  state: text(80).optional(),
  category: optionalNonEmpty(80),
  // Stored as TEXT. The UI's dropdown uses level values ('fresher','0-1',…); older forms send a number of years.
  experience_years: z
    .union([z.number().min(0).max(60), z.string().trim().min(1).max(20)])
    .nullable()
    .optional()
    .transform(v => (v === null || v === undefined ? v : String(v))),
  expected_salary: z.number().int().min(0).max(100_000_000).nullable().optional(),
  skills: z.array(text(50).min(1)).max(30).optional(),
})

export type CandidateProfileUpdate = z.infer<typeof candidateProfileUpdateSchema>

export type ProfileParse = { ok: true; data: CandidateProfileUpdate } | { ok: false; error: string }

export function parseCandidateProfileUpdate(body: unknown): ProfileParse {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "Invalid profile data" }
  const r = candidateProfileUpdateSchema.safeParse(body)
  if (!r.success) return { ok: false, error: r.error.errors[0]?.message ?? "Invalid profile data" }
  const data = Object.fromEntries(Object.entries(r.data).filter(([, v]) => v !== undefined)) as CandidateProfileUpdate
  if (Object.keys(data).length === 0) return { ok: false, error: "No profile fields to update" }
  return { ok: true, data }
}

/** What the dashboard asks a new candidate to add after sign-up. */
export function missingProfileSteps(p: { category?: string | null; experience_years?: string | number | null; skills?: string[] | null }) {
  const steps: Array<"category" | "experience" | "skills"> = []
  if (!p.category) steps.push("category")
  if (p.experience_years === null || p.experience_years === undefined || p.experience_years === "") steps.push("experience")
  if (!p.skills || p.skills.length === 0) steps.push("skills")
  return steps
}
