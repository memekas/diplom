// Pure validation unit tests for the pair-registration schema. Run: npx tsx src/lib/validation/registration.test.ts
// (No test framework — self-contained assertion script, exits non-zero on failure; CI/verify-runnable.)
import assert from "node:assert/strict";
import { registerPairSchema, parseRegisterPairForm } from "./registration";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
}

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

// --- registerPairSchema ---
check("registerPairSchema accepts non-empty player2Id", () => {
  const r = registerPairSchema.safeParse({ player2Id: "u2" });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.player2Id, "u2");
});
check("registerPairSchema trims player2Id", () => {
  const r = registerPairSchema.safeParse({ player2Id: "  u2  " });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.player2Id, "u2");
});
check("registerPairSchema rejects empty player2Id with RU message", () => {
  const r = registerPairSchema.safeParse({ player2Id: "" });
  assert.equal(r.success, false);
  if (!r.success) assert.equal(r.error.issues[0].message, "Выберите партнёра");
});
check("registerPairSchema rejects whitespace-only player2Id", () => {
  assert.equal(registerPairSchema.safeParse({ player2Id: "   " }).success, false);
});
check("registerPairSchema rejects missing player2Id", () => {
  assert.equal(registerPairSchema.safeParse({}).success, false);
});

// --- parseRegisterPairForm ---
check("parseRegisterPairForm ok on valid player2Id", () => {
  const r = parseRegisterPairForm(form({ player2Id: "u2" }));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.data.player2Id, "u2");
});
check("parseRegisterPairForm errors on empty player2Id", () => {
  const r = parseRegisterPairForm(form({ player2Id: "" }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.player2Id);
});
check("parseRegisterPairForm errors on missing player2Id", () => {
  const r = parseRegisterPairForm(form({}));
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.player2Id);
});

console.log(`\nregistration validation: ${passed} assertions passed.`);
