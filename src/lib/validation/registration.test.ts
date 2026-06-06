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
check("registerPairSchema accepts non-empty player2Nickname", () => {
  const r = registerPairSchema.safeParse({ player2Nickname: "bob" });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.player2Nickname, "bob");
});
check("registerPairSchema trims player2Nickname", () => {
  const r = registerPairSchema.safeParse({ player2Nickname: "  bob  " });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.player2Nickname, "bob");
});
check("registerPairSchema rejects empty player2Nickname with RU message", () => {
  const r = registerPairSchema.safeParse({ player2Nickname: "" });
  assert.equal(r.success, false);
  if (!r.success) assert.equal(r.error.issues[0].message, "Введите ник партнёра");
});
check("registerPairSchema rejects whitespace-only player2Nickname", () => {
  assert.equal(registerPairSchema.safeParse({ player2Nickname: "   " }).success, false);
});
check("registerPairSchema rejects missing player2Nickname", () => {
  assert.equal(registerPairSchema.safeParse({}).success, false);
});

// --- parseRegisterPairForm ---
check("parseRegisterPairForm ok on valid player2Nickname", () => {
  const r = parseRegisterPairForm(form({ player2Nickname: "bob" }));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.data.player2Nickname, "bob");
});
check("parseRegisterPairForm errors on empty player2Nickname", () => {
  const r = parseRegisterPairForm(form({ player2Nickname: "" }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.player2Nickname);
});
check("parseRegisterPairForm errors on missing player2Nickname", () => {
  const r = parseRegisterPairForm(form({}));
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.player2Nickname);
});

console.log(`\nregistration validation: ${passed} assertions passed.`);
