-- Site content seed (already inserted in schema.sql but repeated here for reset)
INSERT INTO site_content (key, value) VALUES
  ('sitename', 'Noble Job'),
  ('tagline', 'Connecting Talent with Opportunity'),
  ('hero_text', 'Find The Right Job, Build Your Bright Future'),
  ('contact_email', 'support@noblejob.in'),
  ('contact_phone', '+91-9971177468'),
  ('address', '48, Bharat Nagar, New Friends Colony, New Delhi – 110025'),
  ('ncc_banner', 'A Livelihood Initiative by NCC FOUNDATION · Building India''s Workforce')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
