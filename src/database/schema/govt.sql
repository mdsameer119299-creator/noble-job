-- ==========================================================================
-- Government Jobs — FreeJobAlert-style schema
-- Tables: govt_jobs (extended), admit_cards, results, answer_keys,
--         syllabus, previous_papers
-- Apply on top of the base schema. Safe to run multiple times.
-- ==========================================================================

-- ── Extend govt_jobs with SEO / taxonomy / rich-detail columns ────────────
ALTER TABLE IF EXISTS govt_jobs
  ADD COLUMN IF NOT EXISTS slug               text UNIQUE,
  ADD COLUMN IF NOT EXISTS department         text,
  ADD COLUMN IF NOT EXISTS experience         text,
  ADD COLUMN IF NOT EXISTS state_slug         text,
  ADD COLUMN IF NOT EXISTS category_tags      text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS qualification_tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS job_status         text DEFAULT 'LIVE_JOB'
       CHECK (job_status IN ('LIVE_JOB','VERIFIED_JOB','ARCHIVED_JOB')),
  ADD COLUMN IF NOT EXISTS notification_pdf   text,
  ADD COLUMN IF NOT EXISTS apply_url          text,
  ADD COLUMN IF NOT EXISTS overview           text,
  ADD COLUMN IF NOT EXISTS vacancy_breakup    jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS eligibility        text,
  ADD COLUMN IF NOT EXISTS age_limit          text,
  ADD COLUMN IF NOT EXISTS salary_details     text,
  ADD COLUMN IF NOT EXISTS selection_process  jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS fee_details        jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS exam_pattern       text,
  ADD COLUMN IF NOT EXISTS syllabus_content   text,
  ADD COLUMN IF NOT EXISTS important_dates    jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS faqs               jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS article            text,
  ADD COLUMN IF NOT EXISTS published          boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_id          text,        -- govtSources.ts id
  ADD COLUMN IF NOT EXISTS created_at         timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at         timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_govt_jobs_slug         ON govt_jobs (slug);
CREATE INDEX IF NOT EXISTS idx_govt_jobs_state_slug   ON govt_jobs (state_slug);
CREATE INDEX IF NOT EXISTS idx_govt_jobs_job_status   ON govt_jobs (job_status);
CREATE INDEX IF NOT EXISTS idx_govt_jobs_category_tags      ON govt_jobs USING GIN (category_tags);
CREATE INDEX IF NOT EXISTS idx_govt_jobs_qualification_tags ON govt_jobs USING GIN (qualification_tags);

-- ── Shared shape for content tables ───────────────────────────────────────
-- admit_cards
CREATE TABLE IF NOT EXISTS admit_cards (
  id          text PRIMARY KEY,
  slug        text UNIQUE NOT NULL,
  title       text NOT NULL,
  org         text NOT NULL,
  exam_name   text NOT NULL,
  date        text,
  link        text,
  state       text,
  state_slug  text,
  color       text DEFAULT '#1847d4',
  badge       text,
  published   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- results
CREATE TABLE IF NOT EXISTS results (
  id          text PRIMARY KEY,
  slug        text UNIQUE NOT NULL,
  title       text NOT NULL,
  org         text NOT NULL,
  exam_name   text NOT NULL,
  date        text,
  link        text,
  state       text,
  state_slug  text,
  color       text DEFAULT '#059669',
  badge       text,
  published   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- answer_keys
CREATE TABLE IF NOT EXISTS answer_keys (
  id          text PRIMARY KEY,
  slug        text UNIQUE NOT NULL,
  title       text NOT NULL,
  org         text NOT NULL,
  exam_name   text NOT NULL,
  date        text,
  link        text,
  state       text,
  state_slug  text,
  color       text DEFAULT '#1847d4',
  badge       text,
  published   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- syllabus
CREATE TABLE IF NOT EXISTS syllabus (
  id          text PRIMARY KEY,
  slug        text UNIQUE NOT NULL,
  title       text NOT NULL,
  org         text NOT NULL,
  exam_name   text NOT NULL,
  date        text,
  link        text,
  content     text,
  color       text DEFAULT '#1e3a8a',
  badge       text,
  published   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- previous_papers
CREATE TABLE IF NOT EXISTS previous_papers (
  id          text PRIMARY KEY,
  slug        text UNIQUE NOT NULL,
  title       text NOT NULL,
  org         text NOT NULL,
  exam_name   text NOT NULL,
  date        text,
  link        text,
  year_range  text,
  color       text DEFAULT '#0e7490',
  badge       text,
  published   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admit_cards_slug     ON admit_cards (slug);
CREATE INDEX IF NOT EXISTS idx_results_slug         ON results (slug);
CREATE INDEX IF NOT EXISTS idx_answer_keys_slug     ON answer_keys (slug);
CREATE INDEX IF NOT EXISTS idx_syllabus_slug        ON syllabus (slug);
CREATE INDEX IF NOT EXISTS idx_previous_papers_slug ON previous_papers (slug);
