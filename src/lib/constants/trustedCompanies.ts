/**
 * trustedCompanies.ts
 *
 * Verified trusted company list — ported from the original TRUSTED_COMPANIES array.
 * 70+ companies confirmed as legitimate Indian and global employers.
 * Used in scamFilter.ts: jobs from these companies bypass some checks.
 */

export const TRUSTED_COMPANIES: readonly string[] = [
  // Indian IT Giants
  'TCS', 'Tata Consultancy', 'Infosys', 'Wipro', 'HCL', 'Tech Mahindra',
  'Accenture', 'IBM', 'Cognizant', 'Capgemini', 'Mphasis', 'Hexaware',
  // Global Tech
  'Microsoft', 'Google', 'Amazon', 'Meta', 'Apple', 'Adobe', 'Oracle', 'SAP',
  'Salesforce', 'ServiceNow', 'Workday',
  // Consulting & Finance
  'Deloitte', 'KPMG', 'PwC', 'EY', 'McKinsey', 'BCG', 'Bain',
  'HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank', 'Kotak', 'Yes Bank',
  // Indian Unicorns & Startups
  'Flipkart', 'Zomato', 'Swiggy', 'Ola', 'Paytm', 'PhonePe', 'Razorpay',
  "BYJU'S", 'Nykaa', 'Urban Company', 'MakeMyTrip', 'Freshworks', 'Zoho',
  // Manufacturing & Infra
  'Tata Motors', 'Mahindra', 'L&T', 'Reliance', 'Bajaj', 'Hero MotoCorp', 'Maruti',
  // Global Remote-first
  'GitHub', 'GitLab', 'Shopify', 'Stripe', 'Airbnb', 'Notion', 'Figma',
  'Atlassian', 'Cloudflare', 'Twilio', 'HubSpot', 'Intercom', 'Datadog',
  'HashiCorp', 'MongoDB', 'Elastic', 'Grafana', 'Automattic', 'Buffer',
  'Basecamp', 'Doist', 'Remote',
  // Healthcare
  'NHS', 'Omega Healthcare',
  // Aviation & Oil
  'Emirates', 'Saudi Aramco', 'AECOM', 'Marriott',
] as const
