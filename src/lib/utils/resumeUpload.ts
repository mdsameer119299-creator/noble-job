/**
 * Single resume upload limit for the whole product (UI hints, client validation, both scoring routes).
 * 4 MB (not 5) because Vercel rejects any request body over 4.5 MB at the platform edge with a non-JSON 413;
 * 4 MB + multipart framing stays safely under that, so users always get OUR friendly JSON error instead.
 */
export const RESUME_MAX_MB = 4
const MAX_BYTES = RESUME_MAX_MB * 1024 * 1024
export const RESUME_MAX_LABEL = `${RESUME_MAX_MB} MB`
export const RESUME_TOO_LARGE_MESSAGE = `Your resume is larger than ${RESUME_MAX_LABEL}. Please upload a smaller PDF, DOC or DOCX (try “Save as PDF” or compress images).`
export const RESUME_STORED_TOO_LARGE_MESSAGE = `Your saved resume is larger than ${RESUME_MAX_LABEL}. Please upload a smaller version in your profile and try again.`

/** Consistent JSON body for every "resume too large" response (HTTP 413). */
export function resumeTooLargeBody(message: string = RESUME_TOO_LARGE_MESSAGE) {
  return { error: message, code: "file_too_large" as const, maxBytes: MAX_BYTES }
}

const ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx"])
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
])

export type ResumeValidationResult =
  | { ok: true; ext: string }
  | { ok: false; error: string }

export function validateResumeFile(file: File): ResumeValidationResult {
  if (!file || file.size === 0) {
    return { ok: false, error: "No file provided" }
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: RESUME_TOO_LARGE_MESSAGE }
  }

  const name = file.name.trim().toLowerCase()
  const ext = name.includes(".") ? name.split(".").pop()! : ""
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return { ok: false, error: "Only PDF, DOC, and DOCX files are allowed" }
  }

  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return { ok: false, error: "Invalid file type" }
  }

  return { ok: true, ext }
}

export const RESUME_MAX_BYTES = MAX_BYTES
