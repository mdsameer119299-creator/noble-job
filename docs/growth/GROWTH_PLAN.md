# Noble Job — measurable growth plan (candidates + employers)

Status: PLAN. Nothing here is measured yet: production has no baseline in this workspace. Week 1 is to capture baselines;
targets below are hypotheses to be replaced by real baselines, not benchmarks.

## North-star metrics (one number each)
| Funnel | Metric | Source | Baseline |
|---|---|---|---|
| Candidate 1 | Visitor → registration | Vercel Web Analytics (enable, free) + `candidates.created_at` | TBD wk 1 |
| Candidate 2 | Registration → first application (7 days) | `applications.applied_at` vs `candidates.created_at` | TBD wk 1 |
| Employer 1 | Employer registration → first job submitted | `jobs` vs `employers` | TBD wk 1 |
| Employer 2 | First job → approved & live; time-to-approval | `jobs.status` | TBD wk 1 |
| Employer 3 | Repeat posting (≥2 jobs, different weeks) | `jobs` | TBD wk 1 |
All queries: `funnel-queries.sql` (read-only). Syntax and logic verified on a local PostgreSQL 16 with synthetic fixtures; the header of that file lists which queries need staging, deployed events, or real data. Not yet run against Supabase.

## Instrumentation (ready as patch)
Branch `feat/funnel-events`: `register_viewed/submitted/verified` (role + `?src=` attribution) and `employer_job_submitted`,
plus existing resume/application events. Needs Vercel Web Analytics switched on for visitor counts (currently "Not Enabled").

## Candidate acquisition (levers, in order of expected leverage)
1. Free resume score on the home page (works once the PDF fix ships) → CTA to register to save the report. Track
   resume_score_generated → register_viewed.
2. Government-job pages are the traffic engine: reliable freshness (see ingestion audit) + email job alerts
   (`job_alert_subscribed`) as the registration-free capture step.
3. Reduce registration friction: measure step-1 → step-2 → OTP drop-off with the new events BEFORE changing the form.
4. Hub SEO: finish Search Console comparison before any redirect; short meta descriptions fixed (patch ready).

## Employer acquisition
1. `/for-employers` page (patch ready): free posting, jobs reviewed before going live. CTAs should carry `&src=for-employers`
   so the funnel query attributes registrations to it.
2. Time-to-first-job: after registration, send the user straight to the post-job form; target = first job submitted in the
   same session. Measure with query 4.
3. Approval SLA: publish a review-time promise only after query 5 shows the real median; slow approval is the likeliest
   employer drop-off since all jobs are manually reviewed.
4. Repeat posting: reminder email when a job closes/expires (Resend), measured by query 6.

## Review cadence
Weekly: run queries 1–6, write 5 lines (what moved, why, next change). Change ONE lever at a time per funnel.
Decision rule: keep a change only if its step metric improves over ≥2 weeks vs. baseline and downstream step does not fall.

## Risks / open items
- No production baseline yet; DB-dependent queries untested (staging Supabase pending).
- Manual approval is a bottleneck: needs an owner and an SLA.
- Visitor→registration needs Web Analytics enabled; Search Console alone gives impressions/clicks, not on-site visitors.
