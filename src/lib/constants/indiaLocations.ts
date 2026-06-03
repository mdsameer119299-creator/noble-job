export const INDIA_LOCATIONS = [
  "Delhi NCR", "Bangalore", "Mumbai", "Hyderabad", "Chennai",
  "Pune", "Kolkata", "Ahmedabad", "Noida", "Gurgaon",
  "Jaipur", "Lucknow", "Chandigarh", "Bhubaneswar",
] as const

export const INDIA_LOCATION_FILTER_OPTIONS = [
  { label: "All Locations", value: "" },
  { label: "Remote", value: "Remote" },
  ...INDIA_LOCATIONS.map(l => ({ label: l, value: l })),
]
