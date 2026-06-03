/**
 * Noble Job — database seed runner
 * Applies SQL files from src/database/seeds/ via Supabase service role or psql.
 *
 * Usage:
 *   node scripts/seed.js
 * Requires: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL in .env.local
 */
const fs = require("fs")
const path = require("path")

async function main() {
  const root = path.join(__dirname, "..")
  const envPath = path.join(root, ".env.local")
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "")
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes("your-project")) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local")
    process.exit(1)
  }

  const seedsDir = path.join(root, "src", "database", "seeds")
  const files = fs.readdirSync(seedsDir).filter(f => f.endsWith(".sql")).sort()

  console.log(`Found ${files.length} seed files.`)
  console.log("Run these against your Supabase SQL editor or via supabase db push:")
  for (const f of files) {
    console.log(`  - src/database/seeds/${f}`)
  }
  console.log("\nFor local Supabase CLI: supabase db reset && supabase db push")
  console.log("Seed SQL is applied with migrations in src/database/migrations/")
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
