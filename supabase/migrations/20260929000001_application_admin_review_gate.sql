-- Noble Job application delivery gate
-- Private/WFH/Abroad applications are stored internally first.
-- Employers may only see an application after admin approval.

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS admin_review_status text NOT NULL DEFAULT 'pending_review'
    CHECK (admin_review_status IN ('pending_review','approved','rejected','shared')),
  ADD COLUMN IF NOT EXISTS admin_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS applications_admin_review_status_idx
  ON public.applications (admin_review_status, applied_at DESC);

COMMENT ON COLUMN public.applications.admin_review_status IS
  'Controls employer visibility of candidate applications. Candidate data stays in Noble Job until admin approval.';
COMMENT ON COLUMN public.applications.admin_reviewed_at IS
  'Timestamp when an admin approved or rejected the application.';
COMMENT ON COLUMN public.applications.admin_reviewed_by IS
  'Admin user who approved or rejected the application.';
