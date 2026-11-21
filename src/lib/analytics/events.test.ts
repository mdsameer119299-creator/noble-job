import assert from "node:assert/strict"
import { AcqEvent, ACQ_EVENT_NAMES } from "./events"
const need = ["register_viewed", "register_submitted", "register_verified", "employer_job_submitted", "first_application", "profile_step_saved", "profile_completed"]
for (const n of need) assert.ok(ACQ_EVENT_NAMES.includes(n), `${n} must be allow-listed for /api/events`)
assert.equal(new Set(ACQ_EVENT_NAMES).size, ACQ_EVENT_NAMES.length, "event names are unique")
for (const v of Object.values(AcqEvent)) assert.match(v, /^[a-z]+(_[a-z]+)*$/, `${v} is snake_case`)
console.log("analytics events: OK")
