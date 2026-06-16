-- ============================================================================
-- Applications board-column reconcile.
--
-- Production already has applications.board (this migration is a NO-OP there).
-- Its purpose is to converge any environment that was built from the legacy
-- src/database/schema.sql (which used `job_board`) onto the canonical `board`
-- column the application code now uses — eliminating the schema drift that broke
-- candidate applications.
--
-- ADDITIVE · IDEMPOTENT · REVERSIBLE · no data loss (legacy column is preserved,
-- not dropped — see notes in the .down file).
-- ============================================================================

BEGIN;

-- 1. Ensure the canonical column exists.
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS board TEXT NOT NULL DEFAULT 'private';

-- 2. If a legacy `job_board` column exists (schema.sql-built envs), backfill
--    `board` from it where `board` is still at the default. Guarded so prod
--    (which has no job_board column) skips this entirely.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'applications' AND column_name = 'job_board'
  ) THEN
    UPDATE applications
       SET board = job_board
     WHERE (board IS NULL OR board = 'private') AND job_board IS NOT NULL;
  END IF;
END $$;

COMMIT;
