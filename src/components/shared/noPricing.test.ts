/** Employer sign-up and initial job posting are free; no pricing/upsell surface may be linked or rendered. */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = path.resolve(__dirname, "../..")
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8")

assert.ok(!/Pricing Plans|\/pricing/i.test(read("components/shared/Footer.tsx")), "footer must not link to pricing")
assert.ok(!/Billing & Plans/.test(read("components/employer/EmployerSidebar.tsx")), "sidebar must not say Billing & Plans")
assert.ok(!fs.existsSync(path.join(root, "components/employer/UpgradeCta.tsx")), "employer UpgradeCta (Premium/Enterprise cards) is removed")
for (const f of ["app/employer/billing/page.tsx", "components/employer/CurrentPlan.tsx", "app/for-employers/page.tsx"].filter(f => fs.existsSync(path.join(root, f)))) {
  const s = read(f)
  assert.ok(!/Premium|Enterprise|Coming Soon|₹\s?\d|upgrade/i.test(s), `${f} must not mention paid plans or prices`)
}
console.log("no pricing references: OK")
