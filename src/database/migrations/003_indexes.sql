-- ==========================================================================
-- Migration 003: Performance Indexes
-- Run after 001_initial_schema.sql and seeds.
-- ==========================================================================

-- jobs
CREATE INDEX IF NOT EXISTS idx_jobs_status         ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_board          ON jobs(board);
CREATE INDEX IF NOT EXISTS idx_jobs_category       ON jobs(category);
CREATE INDEX IF NOT EXISTS idx_jobs_location       ON jobs(location);
CREATE INDEX IF NOT EXISTS idx_jobs_employer_id    ON jobs(employer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_posted_at      ON jobs(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_skills         ON jobs USING GIN(skills);
CREATE INDEX IF NOT EXISTS idx_jobs_fts            ON jobs USING GIN(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(company,'')));

-- govt_jobs
CREATE INDEX IF NOT EXISTS idx_govt_jobs_tab       ON govt_jobs(tab);
CREATE INDEX IF NOT EXISTS idx_govt_jobs_status    ON govt_jobs(status);
CREATE INDEX IF NOT EXISTS idx_govt_jobs_state     ON govt_jobs(state);
CREATE INDEX IF NOT EXISTS idx_govt_jobs_sort      ON govt_jobs(sort_order);

-- wfh_jobs
CREATE INDEX IF NOT EXISTS idx_wfh_jobs_cat        ON wfh_jobs(cat);
CREATE INDEX IF NOT EXISTS idx_wfh_jobs_status     ON wfh_jobs(status);

-- abroad_jobs
CREATE INDEX IF NOT EXISTS idx_abroad_jobs_country ON abroad_jobs(country);
CREATE INDEX IF NOT EXISTS idx_abroad_jobs_status  ON abroad_jobs(status);

-- applications
CREATE INDEX IF NOT EXISTS idx_applications_candidate ON applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_applications_employer  ON applications(employer_id);
CREATE INDEX IF NOT EXISTS idx_applications_job       ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_status    ON applications(status);

-- messages
CREATE INDEX IF NOT EXISTS idx_messages_sender      ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient   ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_sent_at     ON messages(sent_at DESC);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user   ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE NOT is_read;

-- job_alerts
CREATE INDEX IF NOT EXISTS idx_alerts_email         ON job_alerts(email);
CREATE INDEX IF NOT EXISTS idx_alerts_user          ON job_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_active        ON job_alerts(is_active);

-- himalayas_jobs_cache
CREATE INDEX IF NOT EXISTS idx_himalayas_external   ON himalayas_jobs_cache(external_id);
CREATE INDEX IF NOT EXISTS idx_himalayas_expires    ON himalayas_jobs_cache(expires_at);

-- saved_jobs / bookmarks
CREATE INDEX IF NOT EXISTS idx_saved_jobs_candidate ON saved_jobs(candidate_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user       ON bookmarks(user_id);

-- candidates / employers
CREATE INDEX IF NOT EXISTS idx_candidates_user      ON candidates(user_id);
CREATE INDEX IF NOT EXISTS idx_candidates_category  ON candidates(category);
CREATE INDEX IF NOT EXISTS idx_candidates_skills    ON candidates USING GIN(skills);
CREATE INDEX IF NOT EXISTS idx_employers_user       ON employers(user_id);
CREATE INDEX IF NOT EXISTS idx_employers_status     ON employers(status);

-- contact_messages
CREATE INDEX IF NOT EXISTS idx_contact_msgs_status  ON contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_contact_msgs_email   ON contact_messages(email);

-- otp_tokens
CREATE INDEX IF NOT EXISTS idx_otp_email_type       ON otp_tokens(email, type) WHERE NOT is_used;
CREATE INDEX IF NOT EXISTS idx_otp_expires          ON otp_tokens(expires_at);

-- interviews
CREATE INDEX IF NOT EXISTS idx_interviews_employer  ON interviews(employer_id);
CREATE INDEX IF NOT EXISTS idx_interviews_candidate ON interviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interviews_status    ON interviews(status);
CREATE INDEX IF NOT EXISTS idx_interviews_scheduled ON interviews(scheduled_at);

COMMENT ON TABLE jobs IS 'Private sector job listings — curated India jobs + employer-posted jobs';
COMMENT ON TABLE govt_jobs IS 'Government job listings across 5 tabs: latest, upcoming, results, admit, answer';
COMMENT ON TABLE wfh_jobs IS 'Work From Home job listings from verified Indian companies';
COMMENT ON TABLE abroad_jobs IS 'International job listings — UAE, UK, Canada, Australia, USA etc.';
COMMENT ON TABLE himalayas_jobs_cache IS 'Cached remote jobs from Himalayas.app API (refreshed hourly)';
