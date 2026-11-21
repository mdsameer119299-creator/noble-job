-- Rollback for 20261121000001_admin_growth_summary.sql (drops only the function; no data is affected).
drop function if exists public.admin_growth_summary(integer);
