-- ==========================================================================
-- Migration 002: Row Level Security Policies
-- Protects all 29 tables — users only see their own data
-- ==========================================================================

-- Enable RLS on all user-data tables
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE employers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_jobs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews      ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_alerts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks       ENABLE ROW LEVEL SECURITY;

-- Public tables (read for all, write for admin only)
ALTER TABLE govt_jobs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE abroad_jobs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE wfh_jobs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE himalayas_jobs_cache ENABLE ROW LEVEL SECURITY;

-- USERS: own row only
CREATE POLICY users_own ON users
  USING (auth.uid() = id);

-- EMPLOYERS: read own record; admin reads all
CREATE POLICY employer_own ON employers
  USING (auth.uid() = user_id);

-- CANDIDATES: read own; employers can read for applications
CREATE POLICY candidate_own ON candidates
  USING (auth.uid() = user_id);

-- JOBS: public can read active; employer owns their own jobs
CREATE POLICY jobs_public_read ON jobs
  FOR SELECT USING (status = 'active');
CREATE POLICY jobs_employer_write ON jobs
  FOR ALL USING (employer_id IN (
    SELECT id FROM employers WHERE user_id = auth.uid()
  ));

-- GOVT/ABROAD/WFH JOBS: public read only
CREATE POLICY govt_public ON govt_jobs FOR SELECT USING (status = 'active');
CREATE POLICY abroad_public ON abroad_jobs FOR SELECT USING (status = 'active');
CREATE POLICY wfh_public ON wfh_jobs FOR SELECT USING (status = 'active');

-- APPLICATIONS: candidate sees own; employer sees for their jobs
CREATE POLICY app_candidate ON applications
  FOR SELECT USING (candidate_id IN (SELECT id FROM candidates WHERE user_id = auth.uid()));
CREATE POLICY app_employer ON applications
  FOR SELECT USING (employer_id IN (SELECT id FROM employers WHERE user_id = auth.uid()));

-- NOTIFICATIONS: own only
CREATE POLICY notif_own ON notifications
  USING (user_id = auth.uid());

-- MESSAGES: sender or recipient
CREATE POLICY msg_own ON messages
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());
