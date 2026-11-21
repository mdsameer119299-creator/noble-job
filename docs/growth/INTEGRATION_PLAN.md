# Integration plan (NOTHING MERGED — for owner approval)

Verified by simulating the order below on a scratch branch off `main`: no conflicts, `tsc` clean, all new test scripts pass.

| # | PR | Target | Notes |
|---|---|---|---|
| 1 | #58 pin Node 24.x | main | Do first: `engines >=20` makes Previews/prod build on Node 26. Confirm Vercel project Node setting after. |
| 2 | #57, #63 | `fix/security-performance-remediation` (PR #55 branch) | Re-run tests + a Preview after merging into #55's branch. |
| 3 | #55 | main | Contains PDF worker isolation + security work. Preview must pass valid/invalid/malformed/4 MB PDF and DOCX before merge. |
| 4 | #64 cron auth, #59 /for-employers, #60 hub meta, #62 docs | main | Independent of each other. |
| 5 | #61 funnel events | main | Needs `analytics_events` migration applied on staging first; persistence NOT yet verified. |
| 6 | #66 remove pricing | main | |
| 7 | #65 simplified registration | main (after #61) | Stacked on #61; retarget to main after #61 merges. Needs staging Supabase test of OTP + dashboard card. |

Rules: no production deploy, DNS, old Vercel project or prod DB changes. After each merge re-run `npm run test:*` for the merged scripts and check the Preview.
Package.json/CI conflicts: every branch now adds its script/CI step at its own anchor line, so order among #59–#66 does not matter for conflicts.
