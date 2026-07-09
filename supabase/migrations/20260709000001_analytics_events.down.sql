-- Rollback for 20260709000001_analytics_events.sql
BEGIN;
DROP TABLE IF EXISTS public.analytics_events;
COMMIT;
