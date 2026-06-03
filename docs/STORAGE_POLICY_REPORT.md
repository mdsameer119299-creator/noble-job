# Storage policy report — resumes (Priority 2)

**Bucket:** `resumes` (env: `SUPABASE_STORAGE_BUCKET_RESUMES`)  
**Migration:** `src/database/migrations/006_storage_resumes.sql`  
**Object layout:** `{candidate_id}/resume.{pdf|doc|docx}`

---

## Bucket configuration

| Setting | Value |
|---------|--------|
| `public` | **false** (private bucket) |
| `file_size_limit` | 5 MB (5,248,800 bytes) |
| Allowed MIME types | PDF, DOC, DOCX |

**Dashboard check:** Storage → `resumes` → ensure **Public bucket** is **OFF**. Run migration `006` if the bucket was created earlier as public.

---

## Storage policies (`storage.objects`)

| Policy name | Operation | Role | Rule summary |
|-------------|-----------|------|----------------|
| `resumes_candidate_select` | SELECT | `authenticated` | Path folder `[1]` = own `candidates.id` where `candidates.user_id = auth.uid()` |
| `resumes_candidate_insert` | INSERT | `authenticated` | Same folder ownership (WITH CHECK) |
| `resumes_candidate_update` | UPDATE | `authenticated` | Same (USING + WITH CHECK) |
| `resumes_candidate_delete` | DELETE | `authenticated` | Same |
| `resumes_employer_select_applicant` | SELECT | `authenticated` | Folder `[1]` = `candidate_id` with ≥1 `applications` row linking that candidate to `employers.user_id = auth.uid()` |

**Not granted (by design):**

- Anonymous read/write on `resumes`
- Employer upload/update/delete on resume objects
- Cross-candidate access for employers without an application
- Candidate read of other candidates’ files

**Service role:** Server routes using `SUPABASE_SERVICE_ROLE_KEY` bypass storage RLS (admin/cron only; never expose to the browser).

---

## Application behavior (code)

| Requirement | Implementation |
|-------------|----------------|
| Bucket not public | Migration sets `public = false`; no `getPublicUrl` for resumes |
| Signed URLs only | `createResumeSignedUrl()` / `resolveResumeSignedUrl()` (1h TTL) |
| Candidate views own resume | `GET /api/candidate/resume-url` + storage `resumes_candidate_select` |
| Candidate uploads | `POST /api/candidate/resume` stores **path** in `candidates.resume_url`, returns signed URL |
| Employer views after apply | `GET /api/employer/applications/{id}/resume-url` or `.../candidates/{id}/resume-url` + `resumes_employer_select_applicant` |
| No resume URL in listings | Employer applications map `has_resume` only; AI search omits `resume_url` |

**Legacy data:** `normalizeResumeStoragePath()` accepts old public URLs in `resume_url` and resolves the object path for signing.

---

## API endpoints (resume access)

| Endpoint | Who | Access rule |
|----------|-----|-------------|
| `GET /api/candidate/resume-url` | Candidate (session) | Own profile only |
| `POST /api/candidate/resume` | Candidate (session) | Upload to own folder |
| `GET /api/employer/applications/{applicationId}/resume-url` | Employer (session) | Application must belong to employer |
| `GET /api/employer/candidates/{candidateId}/resume-url` | Employer (session) | Must have any application from that candidate |

---

## Deploy checklist

1. Run `006_storage_resumes.sql` in Supabase SQL Editor.
2. Confirm bucket `resumes` is **private** in the dashboard.
3. Re-upload resumes if old rows still store full public URLs (optional; normalizer handles many cases).
4. Verify: candidate signed URL works; employer gets 404 without application; direct public URL returns 403/404.

---

## Related files

- `src/lib/storage/resumeStorage.ts` — paths, signing, legacy URL normalization
- `src/lib/storage/employerResumeAccess.ts` — employer + application checks
- `src/lib/services/storageService.ts` — client upload (path only, no public URL)
- `src/database/migrations/006_storage_resumes.sql` — bucket + policies
