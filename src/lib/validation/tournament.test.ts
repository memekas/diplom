// Pure validation unit tests for tournament schema. Run: npx tsx src/lib/validation/tournament.test.ts
// (No test framework — self-contained assertion script, exits non-zero on failure; CI/verify-runnable.)
import assert from "node:assert/strict";
import {
  createTournamentSchema,
  tournamentStatusSchema,
  tournamentSizes,
  tournamentStatuses,
  parseTournamentForm,
} from "./tournament";

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

// --- tuples ---
check("tournamentSizes is [4,8,16]", () => {
  assert.deepEqual([...tournamentSizes], [4, 8, 16]);
});
check("tournamentStatuses is registration/in_progress/finished", () => {
  assert.deepEqual([...tournamentStatuses], ["registration", "in_progress", "finished"]);
});

// --- size enum ---
for (const size of [4, 8, 16] as const) {
  check(`size accepts ${size}`, () => {
    const r = createTournamentSchema.safeParse({ name: "T", size });
    assert.equal(r.success, true);
    if (r.success) assert.equal(r.data.size, size);
  });
}
for (const bad of [5, 0, 32, 1]) {
  check(`size rejects ${bad}`, () => {
    const r = createTournamentSchema.safeParse({ name: "T", size: bad });
    assert.equal(r.success, false);
  });
}
check("size coerces numeric string then validates membership", () => {
  const r = createTournamentSchema.safeParse({ name: "T", size: "8" });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.size, 8);
});
check("size rejects non-numeric / out-of-set string", () => {
  const r = createTournamentSchema.safeParse({ name: "T", size: "abc" });
  assert.equal(r.success, false);
});

// --- name required ---
check("name required (missing rejected)", () => {
  const r = createTournamentSchema.safeParse({ size: 8 });
  assert.equal(r.success, false);
});
check("name rejects empty/whitespace-only", () => {
  assert.equal(createTournamentSchema.safeParse({ name: "", size: 8 }).success, false);
  assert.equal(createTournamentSchema.safeParse({ name: "   ", size: 8 }).success, false);
});
check("name is trimmed", () => {
  const r = createTournamentSchema.safeParse({ name: "  Cup  ", size: 8 });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.name, "Cup");
});

// --- date optional ---
check("date optional (omitted → undefined)", () => {
  const r = createTournamentSchema.safeParse({ name: "T", size: 8 });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.date, undefined);
});
check("date empty string → undefined", () => {
  const r = createTournamentSchema.safeParse({ name: "T", size: 8, date: "" });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.date, undefined);
});
check("date valid datetime-local string parses to Date", () => {
  const r = createTournamentSchema.safeParse({ name: "T", size: 8, date: "2026-07-01T10:00" });
  assert.equal(r.success, true);
  if (r.success) {
    assert.ok(r.data.date instanceof Date);
    assert.equal(Number.isNaN((r.data.date as Date).getTime()), false);
  }
});
check("date invalid string rejected", () => {
  const r = createTournamentSchema.safeParse({ name: "T", size: 8, date: "not-a-date" });
  assert.equal(r.success, false);
});

// --- location optional ---
check("location optional (omitted → undefined)", () => {
  const r = createTournamentSchema.safeParse({ name: "T", size: 8 });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.location, undefined);
});
check("location empty string → undefined", () => {
  const r = createTournamentSchema.safeParse({ name: "T", size: 8, location: "" });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.location, undefined);
});
check("location accepts trimmed value", () => {
  const r = createTournamentSchema.safeParse({ name: "T", size: 8, location: "  Court 1  " });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.location, "Court 1");
});

// --- status union ---
for (const s of ["registration", "in_progress", "finished"] as const) {
  check(`status union accepts "${s}"`, () => {
    assert.equal(tournamentStatusSchema.safeParse(s).success, true);
  });
}
for (const s of ["draft", "completed", "", "REGISTRATION", "x"]) {
  check(`status union rejects "${s}"`, () => {
    assert.equal(tournamentStatusSchema.safeParse(s).success, false);
  });
}

// --- parseTournamentForm ---
check("parseTournamentForm ok on valid input", () => {
  const r = parseTournamentForm(form({ name: "Cup", size: "16", date: "", location: "" }));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.data.name, "Cup");
    assert.equal(r.data.size, 16);
    assert.equal(r.data.date, undefined);
    assert.equal(r.data.location, undefined);
  }
});
check("parseTournamentForm ok with date+location", () => {
  const r = parseTournamentForm(
    form({ name: "Cup", size: "4", date: "2026-07-01T10:00", location: "Court 1" }),
  );
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.ok(r.data.date instanceof Date);
    assert.equal(r.data.location, "Court 1");
  }
});
check("parseTournamentForm errors on invalid size + empty name", () => {
  const r = parseTournamentForm(form({ name: "", size: "7" }));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.ok(r.errors.name || r.errors.size);
  }
});

console.log(`\ntournament validation: ${passed} assertions passed.`);
