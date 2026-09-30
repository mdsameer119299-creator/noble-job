-- Candidate-facing production must not use demo/sample vacancies as live inventory.
-- The existing synthetic visibility feature remains available for controlled internal
-- demos, but production is explicitly forced OFF by this migration.
INSERT INTO public.admin_settings (key, value)
VALUES ('synthetic_jobs_visible', 'false')
ON CONFLICT (key) DO UPDATE SET value = 'false';
