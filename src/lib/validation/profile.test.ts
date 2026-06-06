// Pure validation unit tests for profileSchema. Run: npx tsx src/lib/validation/profile.test.ts
// (No test framework is installed — minimal-deps stance; this is a self-contained
// assertion script that exits non-zero on failure, runnable in CI/verify.)
import assert from "node:assert/strict";
import { profileSchema } from "./profile";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
}

// courtSide enum: accepts each valid value, rejects invalid.
for (const side of ["left", "right", "either"] as const) {
  check(`courtSide accepts "${side}"`, () => {
    const r = profileSchema.safeParse({ courtSide: side });
    assert.equal(r.success, true);
    if (r.success) assert.equal(r.data.courtSide, side);
  });
}
check("courtSide rejects invalid value", () => {
  const r = profileSchema.safeParse({ courtSide: "middle" });
  assert.equal(r.success, false);
});
check("courtSide required (missing rejected)", () => {
  const r = profileSchema.safeParse({});
  assert.equal(r.success, false);
});

// skillLevel: accepts each valid value, optional/empty, rejects invalid.
for (const lvl of ["beginner", "intermediate", "advanced", "pro"] as const) {
  check(`skillLevel accepts "${lvl}"`, () => {
    const r = profileSchema.safeParse({ courtSide: "either", skillLevel: lvl });
    assert.equal(r.success, true);
    if (r.success) assert.equal(r.data.skillLevel, lvl);
  });
}
check("skillLevel optional (omitted → undefined)", () => {
  const r = profileSchema.safeParse({ courtSide: "either" });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.skillLevel, undefined);
});
check('skillLevel empty string → undefined', () => {
  const r = profileSchema.safeParse({ courtSide: "either", skillLevel: "" });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.skillLevel, undefined);
});
check("skillLevel rejects invalid value", () => {
  const r = profileSchema.safeParse({ courtSide: "either", skillLevel: "legend" });
  assert.equal(r.success, false);
});

// phone: optional string, empty → undefined, trims.
check("phone optional (omitted → undefined)", () => {
  const r = profileSchema.safeParse({ courtSide: "either" });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.phone, undefined);
});
check("phone empty string → undefined", () => {
  const r = profileSchema.safeParse({ courtSide: "either", phone: "" });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.phone, undefined);
});
check("phone accepts a value (trimmed)", () => {
  const r = profileSchema.safeParse({ courtSide: "either", phone: "  +1 555  " });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.phone, "+1 555");
});

// role/name/email are NOT editable here — extra keys are stripped by zod object.
check("role/name/email are not part of editable output", () => {
  const r = profileSchema.safeParse({
    courtSide: "either",
    role: "admin",
    name: "x",
    email: "x@y.z",
  });
  assert.equal(r.success, true);
  if (r.success) {
    assert.equal("role" in r.data, false);
    assert.equal("name" in r.data, false);
    assert.equal("email" in r.data, false);
  }
});

console.log(`\nprofileSchema: ${passed} assertions passed.`);
