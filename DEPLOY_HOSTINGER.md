# Noble Job — Hostinger Node.js Deployment Guide

Next.js **15.5** with **`output: 'standalone'`** for Hostinger **Node.js Web Apps** (Business / Cloud plans).

Production domain: **https://www.noblejob.in**

---

## 1. Pre-flight checklist (local)

Run on your machine before deploying:

```bash
node -v
# Must be v20+ (Hostinger supports 18.x, 20.x, 22.x, 24.x — use 20 LTS)

npm ci
npm run type-check
npm run verify:seo
npm run verify:rls
npm run verify:storage
npm run verify:resend
npm run build
```

Optional standalone bundle test:

```bash
npm run build:hostinger
set HOSTNAME=0.0.0.0
set PORT=3000
npm run start:hostinger
```

Open `http://localhost:3000` — confirm home, `/robots.txt`, `/sitemap.xml`.

---

## 2. `next.config.ts` (verified)

| Setting | Status |
|---------|--------|
| `output: 'standalone'` | Enabled — produces `.next/standalone/server.js` |
| Security headers | X-Frame-Options, CSP, Referrer-Policy |
| Image remote patterns | `*.supabase.co`, `himalayas.app` |
| `poweredByHeader: false` | Enabled |
| `compress: true` | Enabled |
| Redirects | `/jobs` → `/jobs/private`, dashboard shortcuts |

**Note:** Do **not** use `next export` — this app requires a Node server (SSR, API routes, middleware, Supabase cookies).

---

## 3. Hostinger hPanel — create Node.js app

1. **Websites** → **Add Website** → **Node.js Apps**
2. **Import Git Repository** (recommended) or upload ZIP
3. Framework: **Next.js** (auto-detected)

### Deployment strategy

| Method | Who builds? | Use when |
|--------|-------------|----------|
| **Git (recommended)** | Hostinger builds from full repo | Repo includes `scripts/`, `src/`, `package-lock.json` |
| **ZIP (`hostinger-standalone.zip`)** | You build locally (`npm run pack:hostinger`) | Upload pre-built bundle only — **do not** run `npm run build` on Hostinger |

**Do not** upload only `.next/standalone` with the root `package.json` copied by Next.js — it still references `scripts/prebuild.mjs`. Always run `npm run build:hostinger` (or `prepare-hostinger-standalone`) before zipping.

### Build settings — Git deploy (recommended)

| Field | Value |
|-------|--------|
| Node.js version | **20** |
| Root directory | `/` |
| Install command | `npm ci` |
| Build command | `npm run build:hostinger` |
| Output directory | `.next/standalone` |
| Start command | `HOSTNAME=0.0.0.0 node .next/standalone/server.js` |

Hostinger injects **`PORT`** — standalone `server.js` reads `process.env.PORT`.

Reference: `hostinger.json` in the repo root.

### Build settings — ZIP upload (pre-built standalone)

Create the archive locally:

```bash
npm run pack:hostinger
```

Upload **`hostinger-standalone.zip`** (zip root = `server.js`, not a nested folder).

| Field | Value |
|-------|--------|
| Node.js version | **20** |
| Root directory | `/` |
| Install command | *(empty)* |
| Build command | *(empty — switch off **Default** in Build and output settings)* |
| Output directory | *(empty)* |
| Start command | `HOSTNAME=0.0.0.0 node server.js` |

The ZIP includes `hostinger.json` with these values. **Default** preset runs `npm run build` and will fail — use **Change** to set empty build command.

### Alternative Git start (`next start`)

| Field | Value |
|-------|--------|
| Build command | `npm run build` |
| Output directory | `.next` |
| Start command | `HOSTNAME=0.0.0.0 npm run start -- -p $PORT` |

Uses the full `.next` tree (larger deploy). No `prepare-hostinger-standalone` required.

---

## 4. Environment variables (Hostinger app settings)

Copy from `.env.example`. Set **every** required variable in hPanel — **never** commit `.env.local`.

### Required (runtime)

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://jpdxyysijvqfrwnabenk.supabase.co` (your project URL) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase **anon** / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server only — **secret**) |
| `NEXT_PUBLIC_APP_URL` | `https://www.noblejob.in` (no trailing slash) |
| `RESEND_API_KEY` | Resend API key for OTP / transactional email |
| `EMAIL_FROM` | Verified sender, e.g. `Noble Job <noreply@noblejob.in>` |

### Strongly recommended (production)

| Variable | Description |
|----------|-------------|
| `CRON_SECRET` | Long random string; secures `GET /api/cron/govt-jobs` |
| `NEXT_PUBLIC_JOB_DATA_SOURCE` | `supabase` when DB is seeded; omit or `local` for fallback inventories |
| `SUPABASE_STORAGE_BUCKET_RESUMES` | `resumes` (default) |

### Optional

| Variable | Description |
|----------|-------------|
| `EMAIL_SUPPORT` | `support@noblejob.in` |
| `HOSTNAME` | `0.0.0.0` (standalone; default in server.js) |
| `SUPABASE_DB_PASSWORD` | Only for `npm run db:apply` from CI/local — **not** needed at runtime |
| `TWILIO_*` | Optional SMS backup |

### Not used in app code (safe to omit)

`RATE_LIMIT_*`, `HIMALAYAS_CACHE_*` — documented in `.env.example` for future use.

---

## 5. Supabase production configuration

In [Supabase Dashboard](https://supabase.com/dashboard) → your project:

### Authentication → URL Configuration

| Field | Value |
|-------|--------|
| **Site URL** | `https://www.noblejob.in` |
| **Redirect URLs** | `https://www.noblejob.in/auth/callback` |
| | `http://localhost:3000/auth/callback` (local dev only) |

### Authentication → Providers

| Provider | Action |
|----------|--------|
| **Google** | Enabled; Client ID + Secret from Google Cloud |
| **LinkedIn** | Optional; disable UI button until `linkedin_oidc` is enabled |

### Storage

- Bucket **`resumes`** — private; policies from migrations `006` + `008`
- Verify: `npm run verify:storage` (from machine with env vars)

### Database

- Apply migrations: `npm run db:apply` (uses `SUPABASE_DB_PASSWORD`, run locally or CI — not on Hostinger runtime)

---

## 6. Google OAuth production URLs

### Google Cloud Console

**APIs & Services** → **Credentials** → OAuth 2.0 Client:

| Setting | Value |
|---------|--------|
| Authorized JavaScript origins | `https://www.noblejob.in` |
| Authorized redirect URIs | `https://jpdxyysijvqfrwnabenk.supabase.co/auth/v1/callback` |

(Replace `jpdxyysijvqfrwnabenk` with your Supabase project ref.)

### Supabase

Provider **Google** must use the same Google OAuth client. User flow:

1. App → `signInWithGoogle()` → Supabase authorize
2. Redirect → `https://www.noblejob.in/auth/callback?code=...`
3. Route handler `src/app/auth/callback/route.ts` exchanges code + sets cookies

Verify (local with env):

```bash
npm run verify:oauth
```

---

## 7. SEO routes (post-deploy)

Confirm live URLs:

```text
https://www.noblejob.in/robots.txt
https://www.noblejob.in/sitemap.xml
https://www.noblejob.in/manifest.webmanifest
```

`robots.txt` disallows `/admin/`, `/api/`, `/auth`, `/employer/`, `/candidate/`.

`sitemap.xml` uses `NEXT_PUBLIC_APP_URL` for all URLs.

Canonical / OG tags use `buildPageMetadata()` + `metadataBase` in root layout.

---

## 8. Build output for Hostinger

After `npm run build`:

```text
.next/
├── standalone/          ← minimal Node server (output: 'standalone')
│   ├── server.js        ← entry for start:hostinger
│   ├── package.json
│   └── .next/           ← traced server files (static copied by prepare script)
├── static/              ← client chunks (copy into standalone for Option B)
public/                  ← static files (copy into standalone for Option B)
```

Build artifacts **135 routes** including `/api/*`, middleware, `/auth/callback`, `/sitemap.xml`, `/robots.txt`.

**Do not** deploy only `public_html` static export — API and SSR will not work.

---

## 9. Deploy commands reference

### Git deploy (Hostinger — standalone, recommended)

```bash
npm ci
npm run build:hostinger
HOSTNAME=0.0.0.0 node .next/standalone/server.js
```

### ZIP deploy (local build, upload archive)

```bash
npm ci
npm run pack:hostinger
# Upload hostinger-standalone.zip to Hostinger; start: HOSTNAME=0.0.0.0 node server.js
```

### Manual / SSH (if available)

```bash
cd /path/to/noble-job-next
git pull
npm ci
npm run build
# Option A
HOSTNAME=0.0.0.0 PORT=${PORT:-3000} npm run start -- -p $PORT

# Option B — standalone
npm run build:hostinger
HOSTNAME=0.0.0.0 PORT=${PORT:-3000} npm run start:hostinger
```

### Process manager (VPS-style, if not using managed Node app)

```bash
npm run build:hostinger
pm2 start .next/standalone/server.js --name noble-job --update-env
```

---

## 10. Post-deploy verification

```bash
curl -I https://www.noblejob.in
curl https://www.noblejob.in/robots.txt
curl https://www.noblejob.in/sitemap.xml
```

Functional smoke tests:

1. Home → job listing → job detail
2. Register candidate (email OTP) or Google OAuth
3. Login → candidate dashboard → resume upload
4. Apply on a private job
5. Employer login → post job → view applications

---

## 11. Cron (government jobs auto-update)

Schedule an external cron (Hostinger cron, cron-job.org, GitHub Actions) to call:

```http
GET https://www.noblejob.in/api/cron/govt-jobs
Authorization: Bearer <CRON_SECRET>
```

Without `CRON_SECRET` in production, the endpoint may accept unauthenticated requests (dev fallback) — **set `CRON_SECRET` before launch**.

---

## 12. Deployment blockers

Fix these **before** announcing production:

| Priority | Blocker | Impact |
|----------|---------|--------|
| **Launch** | `EMAIL_FROM` still on `onboarding@resend.dev` | Email registration OTP may not reach real users |
| **Launch** | Resend domain `noblejob.in` not verified | Same as above |
| **Launch** | Supabase redirect URLs missing production callback | Google OAuth / magic links fail |
| **Launch** | `NEXT_PUBLIC_APP_URL` wrong or unset | Broken canonicals, sitemap, OAuth redirects |
| **High** | `CRON_SECRET` unset in production | Govt cron endpoint exposed |
| **High** | `SUPABASE_SERVICE_ROLE_KEY` missing on server | OAuth provisioning, admin APIs fail |
| **Medium** | LinkedIn button shown but provider disabled | User confusion (not blocking email/Google) |
| **Ops** | Migrations not applied to production DB | Empty or partial job data when `JOB_DATA_SOURCE=supabase` |

---

## 13. Troubleshooting

| Symptom | Fix |
|---------|-----|
| 502 / app not listening | Set `HOSTNAME=0.0.0.0`; bind to `$PORT` |
| OAuth returns to site then logged out | Confirm `/auth/callback` route handler deploy; check Supabase redirect URLs |
| Images 400 | Add image host to `next.config.ts` `remotePatterns` |
| `Missing script: "build"` | Build and output is still **Default** — set Build command to **empty** (see `hostinger.json` → `zip` in the archive) |
| `Cannot find module scripts/prebuild.mjs` | ZIP missing `scripts/` — use `npm run pack:hostinger` or Git deploy with `build:hostinger`; never run root `npm run build` on a standalone-only upload |
| `MODULE_NOT_FOUND` after build | Locally: `npm run build:local` (cleans `.next`); stop dev server before build |
| Static files 404 (standalone) | Run `npm run prepare:standalone` after build |
| Wrong sitemap domain | Fix `NEXT_PUBLIC_APP_URL` and rebuild |

---

## 14. Files added for deployment

| File | Purpose |
|------|---------|
| `DEPLOY_HOSTINGER.md` | This guide |
| `scripts/prepare-hostinger-standalone.mjs` | Copy `public` + `.next/static`; write runtime `package.json` |
| `scripts/package-hostinger-standalone.mjs` | Create `hostinger-standalone.zip` for ZIP upload |
| `hostinger.json` | Panel settings reference (Git + ZIP) |
| `package.json` | `build:hostinger`, `pack:hostinger`, `start:hostinger`, `engines` |

No application business logic was changed.

---

**Support:** Run `npm run verify:seo` and `npm run verify:oauth` after each production config change.
