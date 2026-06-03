-- ==========================================================================
-- Seed: Government Jobs (from original GOVT_DATA in js-govt script)
-- All 5 tabs: latest, upcoming, results, admit, answer
-- Original JSON data preserved exactly
-- ==========================================================================

-- Store as JSONB in a staging table, then normalised by migration
-- The actual govt_jobs rows are seeded via the schema seed below

-- Latest Jobs (8 entries)
-- SBI Apprentice, IAF AFCAT, CRPF, BOB, OSSC JE, CNP Nashik, SECR, Union Bank
INSERT INTO govt_jobs (id, title, org, short, post, vacancies, qualification, age_range, fee, last_date, start_date, salary, location, tab, color, badge, status, sort_order) VALUES
  ('sbi-apprentice-2026', 'SBI Apprentice Recruitment 2026', 'State Bank of India', 'SBI', 'Apprentice', '7150', 'Graduation', '20-28 Years', '300', '08 Jun 2026', '19 May 2026', '15,000/mo', 'All India', 'latest', '#1e3a8a', 'New', 'active', 1),
  ('iaf-afcat-02-2026', 'IAF AFCAT 02 2026 Notification', 'Indian Air Force', 'IAF', 'Flying/Ground Duty Officer', '379', 'Graduation (60%)', '20-26 Years', '250', '15 Jun 2026', '25 May 2026', '56,100-1,77,500/mo', 'All India', 'latest', '#1d4ed8', 'Hot', 'active', 2),
  ('crpf-constable-2026', 'CRPF Constable Tradesman 2026', 'CRPF', 'CRPF', 'Constable (Tradesman)', '9195', '10th / ITI', '18-23 Years', '100', '30 Jun 2026', '01 Jun 2026', '21,700-69,100/mo', 'All India', 'latest', '#7c3aed', 'Hot', 'active', 3),
  ('bob-credit-officer-2026', 'Bank of Baroda Credit Officer 2026', 'Bank of Baroda', 'BOB', 'Credit Officer', '5000', 'Graduation', '25-35 Years', '600', '20 Jun 2026', '22 May 2026', '48,170-69,810/mo', 'All India', 'latest', '#b45309', 'New', 'active', 4),
  ('ossc-je-2026', 'OSSC Junior Engineer 2026', 'Odisha SSC', 'OSSC', 'Junior Engineer (Civil/Elect/Mech)', '646', 'B.Tech/Diploma', '21-38 Years', '0', '25 Jun 2026', '15 May 2026', '35,400-1,12,400/mo', 'Odisha', 'latest', '#0e7490', 'New', 'active', 5),
  ('cnp-nashik-2026', 'Currency Note Press Nashik 2026', 'CNP Nashik (SPMCIL)', 'CNP', 'Skilled Artisan / Technician', '534', '10th / ITI', '18-30 Years', '100', '18 Jun 2026', '10 May 2026', '19,900-63,200/mo', 'Nashik, Maharashtra', 'latest', '#be123c', 'New', 'active', 6),
  ('secr-apprentice-2026', 'SECR Apprentice Recruitment 2026', 'South East Central Railway', 'SECR', 'Apprentice (Various Trades)', '1079', '10th + ITI', '15-24 Years', '0', '05 Jun 2026', '20 Apr 2026', 'As per NATS norms', 'Bilaspur (CG)', 'latest', '#047857', 'New', 'active', 7),
  ('union-bank-credit-2026', 'Union Bank Credit Officer 2026', 'Union Bank of India', 'UBI', 'Credit Officer (Scale II/III)', '1865', 'Graduation', '25-35 Years', '600', '10 Jun 2026', '30 Apr 2026', '48,170-85,920/mo', 'All India', 'latest', '#d97706', 'New', 'active', 8),
-- Upcoming
  ('upsc-cse-2026', 'UPSC Civil Services Exam 2026', 'UPSC', 'UPSC', 'IAS/IPS/IFS', '1059', 'Graduation (Any)', '21-32 Years', '100', 'TBA', 'TBA', '56,100+', 'All India', 'upcoming', '#1e3a8a', 'Upcoming', 'active', 1),
  ('ssc-cgl-2026', 'SSC CGL 2026-27 Recruitment', 'SSC', 'SSC', 'Group B & C', '17727', 'Graduation', '18-32 Years', '100', 'TBA', 'TBA', '25,500-1,51,100/mo', 'All India', 'upcoming', '#7c3aed', 'Upcoming', 'active', 2),
-- Results
  ('ibps-po-xiv-result', 'IBPS PO XIV Final Result 2025', 'IBPS', 'IBPS', 'Probationary Officer', '4455', 'Graduation', '-', '-', '-', '-', '36,000-63,840/mo', 'All India', 'results', '#059669', 'Result Out', 'active', 1),
  ('ssc-chsl-result-2025', 'SSC CHSL 2024 Final Result', 'SSC', 'SSC', 'LDC/JSA/PA/SA', '3713', '-', '-', '-', '-', '-', '19,900-81,100/mo', 'All India', 'results', '#7c3aed', 'Result Out', 'active', 2),
  ('railway-ntpc-result', 'Railway NTPC Level 2-6 Result 2025', 'RRB', 'RRB', 'Non-Technical Graduate Posts', '11558', '-', '-', '-', '-', '-', '19,900-35,400/mo', 'All India', 'results', '#b45309', 'Result Out', 'active', 3),
  ('niacl-ao-result', 'NIACL Assistant Final Result 2025', 'NIACL', 'NIACL', 'Assistant', '300', '-', '-', '-', '-', '-', '14,435-52,000/mo', 'All India', 'results', '#0e7490', 'Result Out', 'active', 4),
-- Admit Cards
  ('ibps-clerk-admit-2025', 'IBPS Clerk Prelims Admit Card 2025', 'IBPS', 'IBPS', 'Clerk', '6128', '-', '-', '-', '31 Aug 2026', '-', '11,765-42,020/mo', 'All India', 'admit', '#1847d4', 'Admit Out', 'active', 1),
  ('ssc-gd-admit-2026', 'SSC GD Constable Admit Card 2026', 'SSC', 'SSC', 'Constable GD', '39481', '-', '-', '-', '10 Jul 2026', '-', '21,700-69,100/mo', 'All India', 'admit', '#7c3aed', 'Admit Out', 'active', 2),
  ('navy-mr-admit-2026', 'Indian Navy MR Admit Card 2026', 'Indian Navy', 'NAVY', 'Matric Recruit', '2500', '-', '-', '-', '05 Jul 2026', '-', '21,700+', 'All India', 'admit', '#0369a1', 'Admit Out', 'active', 3),
-- Answer Keys
  ('ctet-answer-2025', 'CTET December 2025 Answer Key', 'CBSE', 'CBSE', 'Teacher Eligibility', '35493', '-', '-', '-', '-', '-', '-', 'All India', 'answer', '#059669', 'Key Released', 'active', 1),
  ('ibps-rrb-answer-2025', 'IBPS RRB PO/Clerk Answer Key 2025', 'IBPS', 'IBPS', 'RRB PO/Clerk', '9606', '-', '-', '-', '-', '-', '29,000-65,000/mo', 'All India', 'answer', '#1847d4', 'Key Released', 'active', 2),
  ('ssc-mts-answer-2025', 'SSC MTS Answer Key 2025', 'SSC', 'SSC', 'Multi-Tasking Staff', '10880', '-', '-', '-', '-', '-', '18,000-22,000/mo', 'All India', 'answer', '#7c3aed', 'Key Released', 'active', 3);
