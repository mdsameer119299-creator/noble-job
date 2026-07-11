/**
 * adminValidation.test.ts — pure validator tests for the admin API.
 *   npm run test:admin
 */
import assert from "node:assert/strict"
import {
  validateKeyValueBody,
  parsePagination,
  isUuid,
  parseJobIds,
  ADMIN_LIST_MAX_LIMIT,
  ADMIN_VALUE_MAX_LEN,
  ADMIN_KV_MAX_KEYS,
} from "./adminValidation"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}\n        ${(err as Error).message.split("\n")[0]}`) }
}

// ── validateKeyValueBody ─────────────────────────────────────────────────
test("accepts a flat object of string/number/boolean values", () => {
  const r = validateKeyValueBody({ sitename: "Noble Job", contact_phone: 123, flag: true })
  assert.equal(r.ok, true)
  if (r.ok) assert.deepEqual(r.entries.sort(), [["contact_phone", "123"], ["flag", "true"], ["sitename", "Noble Job"]])
})
test("rejects non-objects, arrays and null", () => {
  for (const bad of [null, undefined, "x", 5, [1, 2], true]) {
    assert.equal(validateKeyValueBody(bad as unknown).ok, false)
  }
})
test("rejects empty body", () => { assert.equal(validateKeyValueBody({}).ok, false) })
test("rejects nested-object values (no injection of structures)", () => {
  assert.equal(validateKeyValueBody({ a: { nested: 1 } }).ok, false)
  assert.equal(validateKeyValueBody({ a: [1] }).ok, false)
})
test("rejects null/undefined values", () => {
  assert.equal(validateKeyValueBody({ a: null }).ok, false)
})
test("enforces value length + key count caps", () => {
  assert.equal(validateKeyValueBody({ a: "x".repeat(ADMIN_VALUE_MAX_LEN + 1) }).ok, false)
  const many: Record<string, string> = {}
  for (let i = 0; i <= ADMIN_KV_MAX_KEYS; i++) many["k" + i] = "v"
  assert.equal(validateKeyValueBody(many).ok, false)
})
test("trims keys and rejects whitespace-only keys", () => {
  assert.equal(validateKeyValueBody({ "   ": "v" }).ok, false)
  const r = validateKeyValueBody({ "  sitename  ": "v" })
  if (r.ok) assert.deepEqual(r.entries, [["sitename", "v"]])
})

// ── parsePagination ──────────────────────────────────────────────────────
test("defaults + caps limit; clamps offset; trims q", () => {
  const get = (m: Record<string, string>) => (k: string) => (k in m ? m[k] : null)
  assert.deepEqual(parsePagination(get({})), { limit: ADMIN_LIST_MAX_LIMIT, offset: 0, q: "" })
  assert.deepEqual(parsePagination(get({ limit: "9999" })).limit, ADMIN_LIST_MAX_LIMIT)
  assert.deepEqual(parsePagination(get({ limit: "20", offset: "40", q: "  hi " })), { limit: 20, offset: 40, q: "hi" })
  assert.deepEqual(parsePagination(get({ limit: "-5", offset: "-9" })), { limit: ADMIN_LIST_MAX_LIMIT, offset: 0, q: "" })
  assert.deepEqual(parsePagination(get({ limit: "abc" })).limit, ADMIN_LIST_MAX_LIMIT)
})

// ── isUuid / parseJobIds ─────────────────────────────────────────────────
test("isUuid validates real UUIDs and rejects junk", () => {
  assert.equal(isUuid("11111111-1111-4111-8111-111111111111"), true)
  assert.equal(isUuid("not-a-uuid"), false)
  assert.equal(isUuid(123), false)
  assert.equal(isUuid(""), false)
})
test("parseJobIds keeps only valid UUIDs, de-dupes, or returns null", () => {
  assert.equal(parseJobIds(null), null)
  assert.equal(parseJobIds("junk,also-junk"), null)
  const id = "11111111-1111-4111-8111-111111111111"
  assert.deepEqual(parseJobIds(`${id},${id},junk`), [id])
})

console.log(`\nadmin-validation tests: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
