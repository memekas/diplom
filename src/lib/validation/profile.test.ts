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

// Minimal valid base: name + courtSide + nickname are now required.
const base = { name: "Иван Петров", courtSide: "either", nickname: "good_nick" } as const;

// courtSide enum: accepts each valid value, rejects invalid.
for (const side of ["left", "right", "either"] as const) {
  check(`courtSide accepts "${side}"`, () => {
    const r = profileSchema.safeParse({ ...base, courtSide: side });
    assert.equal(r.success, true);
    if (r.success) assert.equal(r.data.courtSide, side);
  });
}
check("courtSide rejects invalid value", () => {
  const r = profileSchema.safeParse({ ...base, courtSide: "middle" });
  assert.equal(r.success, false);
});
check("courtSide required (missing rejected)", () => {
  const r = profileSchema.safeParse({ name: "x", nickname: "good_nick" });
  assert.equal(r.success, false);
});

// skillLevel: accepts each valid value, optional/empty, rejects invalid.
for (const lvl of ["beginner", "intermediate", "advanced", "pro"] as const) {
  check(`skillLevel accepts "${lvl}"`, () => {
    const r = profileSchema.safeParse({ ...base, skillLevel: lvl });
    assert.equal(r.success, true);
    if (r.success) assert.equal(r.data.skillLevel, lvl);
  });
}
check("skillLevel optional (omitted → undefined)", () => {
  const r = profileSchema.safeParse({ ...base });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.skillLevel, undefined);
});
check('skillLevel empty string → undefined', () => {
  const r = profileSchema.safeParse({ ...base, skillLevel: "" });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.skillLevel, undefined);
});
check("skillLevel rejects invalid value", () => {
  const r = profileSchema.safeParse({ ...base, skillLevel: "legend" });
  assert.equal(r.success, false);
});

// phone: optional string, empty → undefined, trims.
check("phone optional (omitted → undefined)", () => {
  const r = profileSchema.safeParse({ ...base });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.phone, undefined);
});
check("phone empty string → undefined", () => {
  const r = profileSchema.safeParse({ ...base, phone: "" });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.phone, undefined);
});
check("phone accepts a value (trimmed)", () => {
  const r = profileSchema.safeParse({ ...base, phone: "  +1 555  " });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.phone, "+1 555");
});

// role is NOT editable here — extra keys are stripped by zod object.
check("role is not part of editable output", () => {
  const r = profileSchema.safeParse({ ...base, role: "admin" });
  assert.equal(r.success, true);
  if (r.success) assert.equal("role" in r.data, false);
});

// name: required, trimmed.
check("name required (empty rejected)", () => {
  const r = profileSchema.safeParse({ ...base, name: "" });
  assert.equal(r.success, false);
});
check("name required (whitespace-only rejected)", () => {
  const r = profileSchema.safeParse({ ...base, name: "   " });
  assert.equal(r.success, false);
});
check("name trimmed", () => {
  const r = profileSchema.safeParse({ ...base, name: "  Анна  " });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.name, "Анна");
});

// nickname: trim, 3–30, [A-Za-z0-9_-], no spaces / cyrillic.
check("nickname accepts valid handle", () => {
  const r = profileSchema.safeParse({ ...base, nickname: "Good_nick-1" });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.nickname, "Good_nick-1");
});
check("nickname rejects < 3 chars", () => {
  const r = profileSchema.safeParse({ ...base, nickname: "ab" });
  assert.equal(r.success, false);
});
check("nickname rejects > 30 chars", () => {
  const r = profileSchema.safeParse({ ...base, nickname: "a".repeat(31) });
  assert.equal(r.success, false);
});
check("nickname rejects spaces", () => {
  const r = profileSchema.safeParse({ ...base, nickname: "bad nick" });
  assert.equal(r.success, false);
});
check("nickname rejects cyrillic", () => {
  const r = profileSchema.safeParse({ ...base, nickname: "плохой" });
  assert.equal(r.success, false);
});
check("nickname trimmed", () => {
  const r = profileSchema.safeParse({ ...base, nickname: "  trim_me  " });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.nickname, "trim_me");
});

// email: optional, empty → undefined, validated otherwise.
check("email empty string → undefined", () => {
  const r = profileSchema.safeParse({ ...base, email: "" });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.email, undefined);
});
check("email omitted → undefined", () => {
  const r = profileSchema.safeParse({ ...base });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.email, undefined);
});
check("email accepts a valid address", () => {
  const r = profileSchema.safeParse({ ...base, email: "a@b.com" });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.email, "a@b.com");
});
check("email rejects malformed value", () => {
  const r = profileSchema.safeParse({ ...base, email: "bad" });
  assert.equal(r.success, false);
});

// birthDate: union "" | coerce.date(), optional.
check("birthDate empty string → undefined", () => {
  const r = profileSchema.safeParse({ ...base, birthDate: "" });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.birthDate, undefined);
});
check("birthDate omitted → undefined", () => {
  const r = profileSchema.safeParse({ ...base });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.birthDate, undefined);
});
check("birthDate accepts a valid date", () => {
  const r = profileSchema.safeParse({ ...base, birthDate: "1990-05-01" });
  assert.equal(r.success, true);
  if (r.success) assert.ok(r.data.birthDate instanceof Date);
});
check("birthDate rejects garbage", () => {
  const r = profileSchema.safeParse({ ...base, birthDate: "not-a-date" });
  assert.equal(r.success, false);
});

console.log(`\nprofileSchema: ${passed} assertions passed.`);
