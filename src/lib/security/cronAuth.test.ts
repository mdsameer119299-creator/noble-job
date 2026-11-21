import assert from "node:assert/strict"
import { isCronAuthorized as ok } from "./cronAuth"
const S = "s3cret-value"
assert.equal(ok(`Bearer ${S}`, S, "production"), true, "correct secret")
assert.equal(ok(`Bearer ${S}x`, S, "production"), false, "longer")
assert.equal(ok(`Bearer ${S.slice(0, -1)}`, S, "production"), false, "shorter")
assert.equal(ok(`Bearer wrong-value`, S, "production"), false, "wrong")
assert.equal(ok(S, S, "production"), false, "missing Bearer prefix")
assert.equal(ok(`bearer ${S}`, S, "production"), false, "case-sensitive scheme")
assert.equal(ok(null, S, "production"), false, "no header")
assert.equal(ok("", S, "production"), false, "empty header")
assert.equal(ok(undefined, undefined, "production"), false, "FAIL CLOSED: no secret configured in production")
assert.equal(ok("Bearer ", "", "production"), false, "FAIL CLOSED: empty secret in production")
assert.equal(ok(null, undefined, "development"), true, "dev without secret is allowed")
assert.equal(ok(null, undefined, "test"), true, "test env without secret is allowed")
console.log("cron auth: OK")
