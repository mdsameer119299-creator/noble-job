import assert from "node:assert/strict"
import { HUB_DESCRIPTIONS } from "./hubDescriptions"
for (const [k, d] of Object.entries(HUB_DESCRIPTIONS)) {
  assert.ok(d.length >= 110 && d.length <= 160, `${k}: ${d.length} chars (want 110-160)`)
}
console.log("hub descriptions: OK")
