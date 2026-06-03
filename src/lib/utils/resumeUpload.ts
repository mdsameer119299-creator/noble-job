const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

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
    return { ok: false, error: "File must be 5 MB or smaller" }
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
