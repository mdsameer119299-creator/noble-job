INSERT INTO admin_settings (key, value) VALUES
  ('maintenance_mode', 'false'),
  ('registrations', 'true'),
  ('job_approvals', 'true'),
  ('featured_jobs', 'true'),
  ('contact_email', 'support@noblejob.in'),
  ('contact_phone', '+91-9971177468')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
