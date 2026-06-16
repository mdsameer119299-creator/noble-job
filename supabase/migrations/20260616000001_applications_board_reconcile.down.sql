-- Rollback for 20260616000001_applications_board_reconcile.sql
-- INTENTIONALLY a no-op: `board` is the real production column that the
-- application code depends on; dropping it would re-break candidate applies and
-- destroy data. Roll back the *code* (git revert) instead, not this column.
SELECT 1;
