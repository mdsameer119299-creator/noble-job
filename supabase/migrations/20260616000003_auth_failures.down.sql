-- Rollback for 20260616000003_auth_failures.sql
-- Drops only the new audit table (no other object depends on it).
DROP TABLE IF EXISTS auth_failures;
