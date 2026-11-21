import assert from "node:assert/strict"
import { candidateRegisterStep1Schema as reg } from "./authSchema"
import { parseCandidateProfileUpdate as parse, missingProfileSteps as missing, EXPERIENCE_VALUES } from "./candidateProfile"

let n = 0
const t = (name: string, fn: () => void) => { fn(); n++; console.log("  PASS ", name) }
const base = { firstName: "Asha", lastName: "Rao", email: "asha@example.com", password: "Passw0rdx", terms: true }

// ── registration: name + email + password only ────────────────────────────────
t("registration succeeds with only name, email, password and terms", () => assert.equal(reg.safeParse(base).success, true))
t("phone is optional: omitted and empty string are both accepted", () => {
  assert.equal(reg.safeParse({ ...base, phone: "" }).success, true)
  assert.equal(reg.safeParse({ ...base, phone: "9876543210" }).success, true)
  assert.equal(reg.safeParse({ ...base, phone: "+919876543210" }).success, true)
})
t("a provided phone must still be valid", () => assert.equal(reg.safeParse({ ...base, phone: "12345" }).success, false))
t("category / experience / skills are NOT required (and not accepted as a reason to fail)", () => {
  const r = reg.safeParse({ ...base, category: undefined, skills: [], experienceYears: "fresher" })
  assert.equal(r.success, true) // unknown extras are stripped, never fail registration (the old schema rejected 'fresher' with 'Expected number, received nan')
})
t("password rules and terms are still enforced", () => {
  assert.equal(reg.safeParse({ ...base, password: "short1A" }).success, false)
  assert.equal(reg.safeParse({ ...base, password: "alllowercase1" }).success, false)
  assert.equal(reg.safeParse({ ...base, password: "NoDigitsHere" }).success, false)
  assert.equal(reg.safeParse({ ...base, terms: false }).success, false)
})
t("invalid email / too-short names are rejected with a readable message", () => {
  const e = reg.safeParse({ ...base, email: "nope" }); assert.ok(!e.success && /valid email/.test(e.error.errors[0].message))
  assert.equal(reg.safeParse({ ...base, firstName: "A" }).success, false)
})
t("parsed registration output never contains unvalidated extras (role escalation etc.)", () => {
  const r = reg.safeParse({ ...base, role: "admin", status: "active" }); assert.ok(r.success)
  assert.deepEqual(Object.keys(r.data).sort(), ["email", "firstName", "lastName", "password", "terms"])
})

// ── profile update whitelist (post-signup completion + mass-assignment fix) ───────
t("every experience level the UI dropdown offers is accepted", () => {
  for (const v of EXPERIENCE_VALUES) { const r = parse({ experience_years: v }); assert.ok(r.ok, v) }
})
t("numeric years (older forms) are stored as text", () => {
  const r = parse({ experience_years: 4 }); assert.ok(r.ok); assert.equal(r.data.experience_years, "4")
})
t("category + experience + skills are accepted together", () => {
  const r = parse({ category: "IT & Software", experience_years: "1-3", skills: ["SQL", "React"] }); assert.ok(r.ok)
  assert.deepEqual(r.data.skills, ["SQL", "React"])
})
t("MASS ASSIGNMENT: protected columns are dropped, allowed ones kept", () => {
  const r = parse({ category: "Sales", profile_score: 100, resume_url: "https://evil", user_id: "x", id: "y", status: "active", is_verified: true, role: "admin" })
  assert.ok(r.ok); assert.deepEqual(Object.keys(r.data), ["category"])
})
t("a body with only protected/unknown fields is rejected (nothing to update)", () => {
  assert.deepEqual(parse({ profile_score: 100, resume_url: "x" }), { ok: false, error: "No profile fields to update" })
})
t("non-object bodies are rejected", () => { for (const b of [null, undefined, "x", 5, [1]]) assert.equal(parse(b).ok, false) })
t("limits: >30 skills, over-long skill, bad phone, negative salary are rejected", () => {
  assert.equal(parse({ skills: Array.from({ length: 31 }, (_, i) => "s" + i) }).ok, false)
  assert.equal(parse({ skills: ["x".repeat(51)] }).ok, false)
  assert.equal(parse({ phone: "abc" }).ok, false)
  assert.equal(parse({ expected_salary: -1 }).ok, false)
})
t("clearing phone with an empty string stores null; nulls allowed for experience", () => {
  const r = parse({ phone: "", experience_years: null }); assert.ok(r.ok); assert.equal(r.data.phone, null); assert.equal(r.data.experience_years, null)
})

t("existing PersonalInfoForm payload (empty category for a new candidate) still saves", () => {
  const r = parse({ first_name: "Asha", last_name: "Rao", phone: "", city: "Delhi", category: "", experience_years: null })
  assert.ok(r.ok); assert.ok(!("category" in r.data)); assert.equal(r.data.city, "Delhi")
})

// ── completion indicator input ───────────────────────────────────────────────────
t("missingProfileSteps: new account misses all three; completed misses none", () => {
  assert.deepEqual(missing({ category: null, experience_years: null, skills: [] }), ["category", "experience", "skills"])
  assert.deepEqual(missing({ category: "IT", experience_years: "fresher", skills: ["SQL"] }), [])
  assert.deepEqual(missing({ category: "IT", experience_years: 0, skills: ["SQL"] }), [], "0 years is a valid answer, not missing")
  assert.deepEqual(missing({ category: "IT", experience_years: "", skills: null }), ["experience", "skills"])
})
console.log(`candidate onboarding: ${n} passed`)
