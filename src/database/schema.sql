-- ==========================================================================
-- Noble Job — Complete PostgreSQL Schema
-- Generated for: Supabase (PostgreSQL 15)
-- Tables: 29 | Migration: 001_initial_schema.sql
-- Covers: All 650 features from Migration Inventory
-- ==========================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- for full-text search
CREATE EXTENSION IF NOT EXISTS "unaccent";  -- for accent-insensitive search

-- ==========================================================================
-- 1. USERS (base auth record — all roles)
-- ==========================================================================
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           TEXT UNIQUE NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('admin','employer','candidate')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','pending')),
  email_verified  BOOLEAN DEFAULT FALSE,
  phone           TEXT,
  phone_verified  BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================================
-- 2. EMPLOYERS
-- ==========================================================================
CREATE TABLE employers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  company_name  TEXT NOT NULL,
  website       TEXT,
  city          TEXT NOT NULL,
  industry      TEXT NOT NULL,
  company_size  TEXT NOT NULL,
  designation   TEXT NOT NULL,
  logo_url      TEXT,
  status        TEXT DEFAULT 'active' CHECK (status IN ('active','suspended')),
  plan_type     TEXT DEFAULT 'free' CHECK (plan_type IN ('free','starter','professional','enterprise')),
  is_verified   BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================================
-- 3. CANDIDATES
-- ==========================================================================
CREATE TABLE candidates (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  phone             TEXT,
  experience_years  INTEGER,
  category          TEXT,
  expected_salary   INTEGER,
  skills            TEXT[] DEFAULT '{}',
  resume_url        TEXT,
  city              TEXT,
  profile_score     INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================================
-- 4. CANDIDATE WORK EXPERIENCE
-- ==========================================================================
CREATE TABLE candidate_experience (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id  UUID REFERENCES candidates(id) ON DELETE CASCADE,
  company       TEXT NOT NULL,
  role          TEXT NOT NULL,
  start_date    DATE NOT NULL,
  end_date      DATE,
  is_current    BOOLEAN DEFAULT FALSE,
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================================
-- 5. CANDIDATE EDUCATION
-- ==========================================================================
CREATE TABLE candidate_education (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id  UUID REFERENCES candidates(id) ON DELETE CASCADE,
  institution   TEXT NOT NULL,
  degree        TEXT NOT NULL,
  field         TEXT NOT NULL,
  year_from     INTEGER,
  year_to       INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================================
-- 6. JOBS (Private + Curated big company listings)
-- ==========================================================================
CREATE TABLE jobs (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id          UUID REFERENCES employers(id) ON DELETE SET NULL,
  title                TEXT NOT NULL,
  description          TEXT NOT NULL,
  location             TEXT NOT NULL,
  salary_min           INTEGER,
  salary_max           INTEGER,
  currency             TEXT DEFAULT 'INR',
  job_type             TEXT NOT NULL DEFAULT 'Full Time',
  category             TEXT NOT NULL,
  skills               TEXT[] DEFAULT '{}',
  experience_required  TEXT,
  status               TEXT DEFAULT 'pending' CHECK (status IN ('pending','active','paused','closed','rejected')),
  board                TEXT DEFAULT 'private' CHECK (board IN ('private','wfh')),
  source               TEXT DEFAULT 'employer',
  apply_url            TEXT,
  is_verified          BOOLEAN DEFAULT FALSE,
  badge                TEXT,
  posted_at            TIMESTAMPTZ DEFAULT NOW(),
  expires_at           TIMESTAMPTZ,
  search_vector        TSVECTOR,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Full-text search index on jobs
CREATE INDEX jobs_search_idx ON jobs USING GIN(search_vector);
CREATE INDEX jobs_status_idx ON jobs(status);
CREATE INDEX jobs_category_idx ON jobs(category);
CREATE INDEX jobs_posted_at_idx ON jobs(posted_at DESC);

-- Auto-update search_vector
CREATE OR REPLACE FUNCTION update_job_search_vector() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW.title,'') || ' ' ||
    COALESCE(NEW.company_name,'') || ' ' ||
    COALESCE(array_to_string(NEW.skills,' '),'') || ' ' ||
    COALESCE(NEW.location,'') || ' ' ||
    COALESCE(NEW.category,'')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================================================
-- 7. GOVERNMENT JOBS (20 initial entries seeded separately)
-- ==========================================================================
CREATE TABLE govt_jobs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title             TEXT NOT NULL,
  org               TEXT NOT NULL,
  short             TEXT NOT NULL,
  post              TEXT NOT NULL,
  vacancies         TEXT NOT NULL,
  qualification     TEXT,
  age_range         TEXT,
  fee               TEXT,
  last_date         TEXT,
  start_date        TEXT,
  exam_date         TEXT,
  salary            TEXT,
  location          TEXT DEFAULT 'All India',
  state             TEXT,
  tab               TEXT NOT NULL CHECK (tab IN ('latest','upcoming','results','admit','answer')),
  official_url      TEXT,
  notification_url  TEXT,
  result_url        TEXT,
  admit_url         TEXT,
  answer_url        TEXT,
  color             TEXT DEFAULT '#1847d4',
  badge             TEXT,
  status            TEXT DEFAULT 'active' CHECK (status IN ('active','expired')),
  sort_order        INTEGER DEFAULT 0,
  -- Full detail modal data (stored as JSONB for flexibility)
  overview_data     JSONB,
  vacancies_detail  JSONB,
  eligibility_data  JSONB,
  age_data          JSONB,
  fees_data         JSONB,
  selection_data    JSONB,
  dates_data        JSONB,
  links_data        JSONB,
  faq_data          JSONB,
  disclaimer_text   TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX govt_jobs_tab_idx ON govt_jobs(tab, status, sort_order);
CREATE INDEX govt_jobs_state_idx ON govt_jobs(state);

-- ==========================================================================
-- 8. ABROAD JOBS (11 initial entries seeded)
-- ==========================================================================
CREATE TABLE abroad_jobs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        TEXT NOT NULL,
  company      TEXT NOT NULL,
  logo         TEXT,
  country      TEXT NOT NULL,
  location     TEXT NOT NULL,
  type         TEXT DEFAULT 'Full Time',
  salary       TEXT,
  experience   TEXT,
  category     TEXT,
  description  TEXT,
  apply_url    TEXT,
  skills       TEXT[] DEFAULT '{}',
  badge        TEXT,
  status       TEXT DEFAULT 'active' CHECK (status IN ('active','closed')),
  posted_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX abroad_jobs_country_idx ON abroad_jobs(country);
CREATE INDEX abroad_jobs_category_idx ON abroad_jobs(category);

-- ==========================================================================
-- 9. WFH JOBS (12 initial entries seeded)
-- ==========================================================================
CREATE TABLE wfh_jobs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title          TEXT NOT NULL,
  company        TEXT NOT NULL,
  logo           TEXT,
  color          TEXT DEFAULT '#1847d4',
  type           TEXT DEFAULT 'Full Time Remote',
  experience     TEXT,
  salary         TEXT,
  cat            TEXT NOT NULL,
  qualification  TEXT,
  skills         TEXT[] DEFAULT '{}',
  badge          TEXT DEFAULT 'New',
  badge_type     TEXT DEFAULT 'new',
  applicants     INTEGER DEFAULT 0,
  description    TEXT,
  apply_url      TEXT,
  posted_at      TIMESTAMPTZ DEFAULT NOW(),
  status         TEXT DEFAULT 'active' CHECK (status IN ('active','closed'))
);

CREATE INDEX wfh_jobs_cat_idx ON wfh_jobs(cat, status);

-- ==========================================================================
-- 10. APPLICATIONS
-- ==========================================================================
CREATE TABLE applications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id        UUID,
  job_board     TEXT NOT NULL DEFAULT 'private',
  candidate_id  UUID REFERENCES candidates(id) ON DELETE CASCADE,
  employer_id   UUID REFERENCES employers(id) ON DELETE SET NULL,
  status        TEXT DEFAULT 'new' CHECK (status IN ('new','shortlisted','interview','hired','rejected')),
  applied_at    TIMESTAMPTZ DEFAULT NOW(),
  notes         TEXT,
  UNIQUE(job_id, candidate_id)
);

CREATE INDEX applications_candidate_idx ON applications(candidate_id);
CREATE INDEX applications_employer_idx ON applications(employer_id);
CREATE INDEX applications_status_idx ON applications(status);

-- ==========================================================================
-- 11. SAVED JOBS
-- ==========================================================================
CREATE TABLE saved_jobs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id  UUID REFERENCES candidates(id) ON DELETE CASCADE,
  job_id        UUID NOT NULL,
  board         TEXT DEFAULT 'private' CHECK (board IN ('private','govt','abroad','wfh')),
  saved_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(candidate_id, job_id, board)
);

-- ==========================================================================
-- 12. INTERVIEWS
-- ==========================================================================
CREATE TABLE interviews (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id  UUID REFERENCES applications(id) ON DELETE CASCADE,
  employer_id     UUID REFERENCES employers(id) ON DELETE CASCADE,
  candidate_id    UUID REFERENCES candidates(id) ON DELETE CASCADE,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  type            TEXT DEFAULT 'video' CHECK (type IN ('video','phone','in-person')),
  status          TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled','rescheduled')),
  meet_link       TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================================
-- 13. JOB ALERTS (email subscriptions — all 5 subscription forms)
-- ==========================================================================
CREATE TABLE job_alerts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email        TEXT NOT NULL,
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  keywords     TEXT,
  location     TEXT,
  category     TEXT,
  job_type     TEXT,
  board        TEXT DEFAULT 'all' CHECK (board IN ('all','private','govt','abroad','wfh')),
  frequency    TEXT DEFAULT 'daily' CHECK (frequency IN ('daily','weekly')),
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================================
-- 14. OTP TOKENS
-- ==========================================================================
CREATE TABLE otp_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       TEXT NOT NULL,
  otp_hash    TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('email_verify','phone_verify','password_reset')),
  expires_at  TIMESTAMPTZ NOT NULL,
  is_used     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX otp_tokens_email_idx ON otp_tokens(email, type, is_used);

-- ==========================================================================
-- 15. CONTACT MESSAGES
-- ==========================================================================
CREATE TABLE contact_messages (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  email            TEXT NOT NULL,
  phone            TEXT,
  subject          TEXT NOT NULL,
  message          TEXT NOT NULL,
  inquiry_type     TEXT NOT NULL,
  user_type        TEXT NOT NULL,
  routed_to_email  TEXT NOT NULL,
  status           TEXT DEFAULT 'unread' CHECK (status IN ('unread','read','replied')),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================================
-- 16. ADMIN SETTINGS (4 toggles + contact fields)
-- ==========================================================================
CREATE TABLE admin_settings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT UNIQUE NOT NULL,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Default settings (matches original _settingToggle keys)
INSERT INTO admin_settings (key, value) VALUES
  ('maintenance_mode',   'false'),
  ('registrations',      'true'),
  ('job_approvals',      'true'),
  ('featured_jobs',      'true'),
  ('contact_email',      'support@noblejob.in'),
  ('contact_phone',      '+91-9971177468');

-- ==========================================================================
-- 17. SITE CONTENT (editable via Admin content tab)
-- ==========================================================================
CREATE TABLE site_content (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT UNIQUE NOT NULL,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Default content (matches original admin content fields + contact constants)
INSERT INTO site_content (key, value) VALUES
  ('sitename',        'Noble Job'),
  ('tagline',         'Connecting Talent with Opportunity'),
  ('hero_text',       'Find The Right Job, Build Your Bright Future'),
  ('contact_email',   'support@noblejob.in'),
  ('contact_phone',   '+91-9971177468'),
  ('address',         '48, Bharat Nagar, New Friends Colony, New Delhi – 110025'),
  ('ncc_banner',      'A Livelihood Initiative by NCC FOUNDATION · Building India''s Workforce');

-- ==========================================================================
-- 18. EMPLOYER PLANS
-- ==========================================================================
CREATE TABLE employer_plans (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id   UUID REFERENCES employers(id) ON DELETE CASCADE,
  plan_type     TEXT DEFAULT 'free' CHECK (plan_type IN ('free','starter','professional','enterprise')),
  jobs_limit    INTEGER DEFAULT 3,
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  payment_ref   TEXT
);

-- ==========================================================================
-- 19. EMPLOYER SETTINGS (notification toggles)
-- ==========================================================================
CREATE TABLE employer_settings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id       UUID UNIQUE REFERENCES employers(id) ON DELETE CASCADE,
  email_new_app     BOOLEAN DEFAULT TRUE,
  email_shortlist   BOOLEAN DEFAULT TRUE,
  email_interview   BOOLEAN DEFAULT TRUE,
  sms_alerts        BOOLEAN DEFAULT FALSE
);

-- ==========================================================================
-- 20. SKILL TESTS
-- ==========================================================================
CREATE TABLE skill_tests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           TEXT NOT NULL,
  category        TEXT NOT NULL,
  questions_json  JSONB NOT NULL DEFAULT '[]',
  duration_mins   INTEGER DEFAULT 30,
  passing_score   INTEGER DEFAULT 70,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================================
-- 21. CANDIDATE TEST RESULTS
-- ==========================================================================
CREATE TABLE candidate_test_results (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id  UUID REFERENCES candidates(id) ON DELETE CASCADE,
  test_id       UUID REFERENCES skill_tests(id) ON DELETE CASCADE,
  score         INTEGER NOT NULL,
  taken_at      TIMESTAMPTZ DEFAULT NOW(),
  passed        BOOLEAN NOT NULL,
  UNIQUE(candidate_id, test_id)
);

-- ==========================================================================
-- 22. INTERVIEW MODULES (prep content)
-- ==========================================================================
CREATE TABLE interview_modules (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT NOT NULL,
  category      TEXT NOT NULL,
  content_json  JSONB NOT NULL DEFAULT '[]',
  order_index   INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================================
-- 23. CAREER RESOURCES
-- ==========================================================================
CREATE TABLE career_resources (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        TEXT NOT NULL,
  type         TEXT CHECK (type IN ('article','video','pdf','course')),
  url          TEXT,
  description  TEXT,
  order_index  INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================================
-- 24. HIMALAYAS JOBS CACHE (server-side API cache, TTL = 1 hour)
-- ==========================================================================
CREATE TABLE himalayas_jobs_cache (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id      TEXT UNIQUE NOT NULL,
  title            TEXT NOT NULL,
  company          TEXT NOT NULL,
  logo_url         TEXT,
  location         TEXT,
  salary_text      TEXT,
  category         TEXT,
  seniority        TEXT,
  apply_url        TEXT,
  source_data_json JSONB,
  fetched_at       TIMESTAMPTZ DEFAULT NOW(),
  expires_at       TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour')
);

CREATE INDEX himalayas_cache_expires_idx ON himalayas_jobs_cache(expires_at);

-- ==========================================================================
-- 25. NOTIFICATIONS
-- ==========================================================================
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX notifications_user_idx ON notifications(user_id, is_read, created_at DESC);

-- ==========================================================================
-- 26. MESSAGES (employer ↔ candidate)
-- ==========================================================================
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  recipient_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  application_id  UUID REFERENCES applications(id) ON DELETE SET NULL,
  content         TEXT NOT NULL,
  sent_at         TIMESTAMPTZ DEFAULT NOW(),
  is_read         BOOLEAN DEFAULT FALSE
);

CREATE INDEX messages_recipient_idx ON messages(recipient_id, is_read, sent_at DESC);

-- ==========================================================================
-- 27. BOOKMARKS (govt/abroad/wfh jobs)
-- ==========================================================================
CREATE TABLE bookmarks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  job_id      TEXT NOT NULL,
  board       TEXT NOT NULL CHECK (board IN ('private','govt','abroad','wfh')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id, board)
);

-- ==========================================================================
-- 28. RATINGS (contact page star rating widget)
-- ==========================================================================
CREATE TABLE ratings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_hash     TEXT,
  score       INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  page        TEXT DEFAULT 'contact',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================================
-- 29. ACTIVITY LOGS (profile view tracking for cand-visChart)
-- ==========================================================================
CREATE TABLE activity_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  viewer_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  candidate_id  UUID REFERENCES candidates(id) ON DELETE CASCADE,
  viewed_at     TIMESTAMPTZ DEFAULT NOW(),
  source        TEXT DEFAULT 'search'
);

CREATE INDEX activity_logs_candidate_idx ON activity_logs(candidate_id, viewed_at DESC);

-- ==========================================================================
-- UPDATED_AT trigger for key tables
-- ==========================================================================
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER employers_updated_at BEFORE UPDATE ON employers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER candidates_updated_at BEFORE UPDATE ON candidates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
