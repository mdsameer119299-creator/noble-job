-- ==========================================================================
-- Migration 001: Initial Schema
-- Noble Job — NCC Foundation
-- Run this FIRST before all other migrations.
-- Schema is based on database/schema.sql; this migration is additive-safe.
-- ==========================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- ==========================================================================
-- USERS (core auth table; mirrors auth.users via trigger)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS users (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        UNIQUE NOT NULL,
  role        TEXT        NOT NULL CHECK (role IN ('candidate','employer','admin')),
  status      TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  phone_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================
-- EMPLOYERS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS employers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  company_name    TEXT        NOT NULL,
  company_logo    TEXT,
  website         TEXT,
  industry        TEXT,
  company_size    TEXT,
  city            TEXT,
  description     TEXT,
  gst_number      TEXT,
  designation     TEXT,
  status          TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','pending')),
  verified        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================
-- CANDIDATES
-- ==========================================================================
CREATE TABLE IF NOT EXISTS candidates (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  first_name        TEXT,
  last_name         TEXT,
  phone             TEXT,
  city              TEXT,
  state             TEXT,
  experience_years  TEXT,
  category          TEXT,
  expected_salary   INTEGER,
  skills            TEXT[]      NOT NULL DEFAULT '{}',
  resume_url        TEXT,
  profile_score     INTEGER     NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================
-- JOBS (private sector curated + India big company jobs)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS jobs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id         UUID        REFERENCES employers(id) ON DELETE SET NULL,
  title               TEXT        NOT NULL,
  company             TEXT,
  logo                TEXT,
  color               TEXT        DEFAULT '#1847d4',
  description         TEXT,
  location            TEXT        NOT NULL,
  salary_min          INTEGER,
  salary_max          INTEGER,
  currency            TEXT        NOT NULL DEFAULT 'INR',
  job_type            TEXT        NOT NULL DEFAULT 'Full Time',
  experience_required TEXT,
  category            TEXT,
  skills              TEXT[]      NOT NULL DEFAULT '{}',
  badge               TEXT,
  status              TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('active','pending','rejected','closed')),
  board               TEXT        NOT NULL DEFAULT 'private',
  source              TEXT        DEFAULT 'Noble Job — Curated',
  apply_url           TEXT,
  is_verified         BOOLEAN     NOT NULL DEFAULT FALSE,
  is_featured         BOOLEAN     NOT NULL DEFAULT FALSE,
  posted_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================
-- GOVT JOBS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS govt_jobs (
  id               TEXT        PRIMARY KEY,
  title            TEXT        NOT NULL,
  org              TEXT        NOT NULL,
  short            TEXT,
  post             TEXT,
  vacancies        TEXT,
  qualification    TEXT,
  age_range        TEXT,
  fee              TEXT,
  last_date        TEXT,
  start_date       TEXT,
  exam_date        TEXT,
  salary           TEXT,
  location         TEXT,
  state            TEXT,
  tab              TEXT        NOT NULL DEFAULT 'latest' CHECK (tab IN ('latest','upcoming','results','admit','answer')),
  color            TEXT        DEFAULT '#1847d4',
  badge            TEXT,
  status           TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
  sort_order       INTEGER     NOT NULL DEFAULT 99,
  notification_url TEXT,
  official_url     TEXT,
  result_url       TEXT,
  admit_url        TEXT,
  answer_url       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================
-- WFH JOBS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS wfh_jobs (
  id           TEXT        PRIMARY KEY,
  title        TEXT        NOT NULL,
  company      TEXT        NOT NULL,
  logo         TEXT,
  color        TEXT        DEFAULT '#7c3aed',
  type         TEXT        NOT NULL DEFAULT 'Full-Time Remote',
  experience   TEXT,
  salary       TEXT,
  cat          TEXT,
  qualification TEXT,
  skills       TEXT[]      NOT NULL DEFAULT '{}',
  badge        TEXT,
  badge_type   TEXT        DEFAULT 'new',
  applicants   INTEGER     NOT NULL DEFAULT 0,
  description  TEXT,
  apply_url    TEXT,
  status       TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
  posted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================
-- ABROAD JOBS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS abroad_jobs (
  id          TEXT        PRIMARY KEY,
  title       TEXT        NOT NULL,
  company     TEXT        NOT NULL,
  logo        TEXT,
  country     TEXT        NOT NULL,
  location    TEXT,
  type        TEXT        NOT NULL DEFAULT 'Full Time',
  salary      TEXT,
  experience  TEXT,
  category    TEXT,
  description TEXT,
  skills      TEXT[]      NOT NULL DEFAULT '{}',
  badge       TEXT,
  apply_url   TEXT,
  status      TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
  posted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================
-- HIMALAYAS JOBS CACHE (live remote jobs from API)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS himalayas_jobs_cache (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id     TEXT        UNIQUE,
  title           TEXT        NOT NULL,
  company         TEXT        NOT NULL,
  logo_url        TEXT,
  location        TEXT,
  salary_text     TEXT,
  category        TEXT,
  seniority       TEXT,
  apply_url       TEXT,
  source_data_json JSONB,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour'
);

-- ==========================================================================
-- APPLICATIONS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS applications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       UUID        REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id UUID        NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  employer_id  UUID        REFERENCES employers(id) ON DELETE SET NULL,
  status       TEXT        NOT NULL DEFAULT 'new' CHECK (status IN ('new','shortlisted','interview','hired','rejected')),
  board        TEXT        NOT NULL DEFAULT 'private',
  notes        TEXT,
  applied_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(job_id, candidate_id)
);

-- ==========================================================================
-- SAVED JOBS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS saved_jobs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID        NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id       TEXT        NOT NULL,
  board        TEXT        NOT NULL DEFAULT 'private',
  saved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(candidate_id, job_id, board)
);

-- ==========================================================================
-- BOOKMARKS (separate from saved_jobs; used by NotificationBell)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS bookmarks (
  id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id   TEXT        NOT NULL,
  board    TEXT        NOT NULL DEFAULT 'private',
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, job_id, board)
);

-- ==========================================================================
-- JOB ALERTS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS job_alerts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT        NOT NULL,
  user_id    UUID        REFERENCES users(id) ON DELETE CASCADE,
  keywords   TEXT,
  location   TEXT,
  category   TEXT,
  job_type   TEXT,
  board      TEXT        NOT NULL DEFAULT 'all',
  frequency  TEXT        NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily','weekly')),
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================
-- MESSAGES
-- ==========================================================================
CREATE TABLE IF NOT EXISTS messages (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID        REFERENCES applications(id) ON DELETE SET NULL,
  content        TEXT        NOT NULL,
  is_read        BOOLEAN     NOT NULL DEFAULT FALSE,
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================
-- CONTACT MESSAGES (from contact form)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS contact_messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name       TEXT        NOT NULL,
  last_name        TEXT,
  email            TEXT        NOT NULL,
  phone            TEXT,
  subject          TEXT        NOT NULL,
  message          TEXT        NOT NULL,
  inquiry_type     TEXT        NOT NULL DEFAULT 'general',
  user_type        TEXT        NOT NULL DEFAULT 'candidate',
  routed_to_email  TEXT,
  status           TEXT        NOT NULL DEFAULT 'unread' CHECK (status IN ('unread','read','replied')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================
-- NOTIFICATIONS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL,
  title      TEXT        NOT NULL,
  message    TEXT        NOT NULL,
  is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================
-- RATINGS (star ratings on contact/pages)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS ratings (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  score      INTEGER     NOT NULL CHECK (score BETWEEN 1 AND 5),
  page       TEXT        NOT NULL DEFAULT 'contact',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================
-- OTP TOKENS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS otp_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT        NOT NULL,
  otp_hash   TEXT        NOT NULL,
  type       TEXT        NOT NULL CHECK (type IN ('email_verify','password_reset')),
  is_used    BOOLEAN     NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================
-- INTERVIEWS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS interviews (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID        REFERENCES applications(id) ON DELETE CASCADE,
  employer_id    UUID        NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  candidate_id   UUID        NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  scheduled_at   TIMESTAMPTZ NOT NULL,
  duration_mins  INTEGER     NOT NULL DEFAULT 60,
  mode           TEXT        NOT NULL DEFAULT 'online' CHECK (mode IN ('online','offline','phone')),
  link           TEXT,
  notes          TEXT,
  status         TEXT        NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled','rescheduled')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================
-- CANDIDATE EXPERIENCE
-- ==========================================================================
CREATE TABLE IF NOT EXISTS candidate_experience (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID        NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  company      TEXT        NOT NULL,
  role         TEXT        NOT NULL,
  start_date   TEXT,
  end_date     TEXT,
  is_current   BOOLEAN     NOT NULL DEFAULT FALSE,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================
-- CANDIDATE EDUCATION
-- ==========================================================================
CREATE TABLE IF NOT EXISTS candidate_education (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID        NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  institution  TEXT        NOT NULL,
  degree       TEXT        NOT NULL,
  field        TEXT,
  year_from    INTEGER,
  year_to      INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================
-- SKILL TESTS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS skill_tests (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT        NOT NULL,
  category       TEXT        NOT NULL,
  duration_mins  INTEGER     NOT NULL DEFAULT 30,
  passing_score  INTEGER     NOT NULL DEFAULT 70,
  questions_json JSONB       NOT NULL DEFAULT '[]',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================
-- CANDIDATE TEST RESULTS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS candidate_test_results (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID        NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  test_id      UUID        NOT NULL REFERENCES skill_tests(id) ON DELETE CASCADE,
  score        INTEGER     NOT NULL,
  passed       BOOLEAN     NOT NULL DEFAULT FALSE,
  taken_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(candidate_id, test_id)
);

-- ==========================================================================
-- INTERVIEW MODULES (prep content)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS interview_modules (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT        NOT NULL,
  category     TEXT,
  order_index  INTEGER     NOT NULL DEFAULT 99,
  content_json JSONB       NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================
-- CAREER RESOURCES
-- ==========================================================================
CREATE TABLE IF NOT EXISTS career_resources (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  type        TEXT        NOT NULL DEFAULT 'article',
  description TEXT,
  url         TEXT,
  order_index INTEGER     NOT NULL DEFAULT 99,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================
-- EMPLOYER PLANS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS employer_plans (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id  UUID        NOT NULL UNIQUE REFERENCES employers(id) ON DELETE CASCADE,
  plan_type    TEXT        NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free','basic','pro','enterprise')),
  jobs_limit   INTEGER     NOT NULL DEFAULT 3,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================
-- EMPLOYER SETTINGS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS employer_settings (
  id                   UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id          UUID    NOT NULL UNIQUE REFERENCES employers(id) ON DELETE CASCADE,
  notify_applications  BOOLEAN NOT NULL DEFAULT TRUE,
  notify_interviews    BOOLEAN NOT NULL DEFAULT TRUE,
  notify_messages      BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================
-- SITE CONTENT (CMS for admin)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS site_content (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================
-- ADMIN SETTINGS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS admin_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial site content
INSERT INTO site_content (key, value) VALUES
  ('sitename',    'Noble Job'),
  ('tagline',     'Connecting Talent with Opportunity'),
  ('hero_text',   'Find The Right Job, Build Your Bright Future'),
  ('contact_email','support@noblejob.in'),
  ('contact_phone','+91-9971177468'),
  ('address',     '48, Bharat Nagar, New Friends Colony, New Delhi – 110025'),
  ('ncc_banner',  'A Livelihood Initiative by NCC FOUNDATION · Building India''s Workforce')
ON CONFLICT (key) DO NOTHING;

INSERT INTO admin_settings (key, value) VALUES
  ('maintenance_mode','false'),
  ('registrations',   'true'),
  ('job_approvals',   'true'),
  ('featured_jobs',   'true')
ON CONFLICT (key) DO NOTHING;
