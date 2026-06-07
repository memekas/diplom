// Pure validation unit tests for tournament schema. Run: npx tsx src/lib/validation/tournament.test.ts
// (No test framework — self-contained assertion script, exits non-zero on failure; CI/verify-runnable.)
import assert from "node:assert/strict";
import {
  createTournamentSchema,
  tournamentStatusSchema,
  tournamentSizes,
  tournamentStatuses,
  tournamentFormats,
  participantModes,
  scoringModes,
  PLAYOFF_SIZES,
  SIZE_CAP,
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

// Minimal valid object for the now-required multiformat fields. Spread + override.
const base = {
  name: "T",
  format: "playoff" as const,
  participantMode: "pairs" as const,
  level: "intermediate" as const,
  scoringMode: "sets" as const,
  size: 8,
};

// --- tuples ---
check("tournamentSizes is [4,8,16]", () => {
  assert.deepEqual([...tournamentSizes], [4, 8, 16]);
});
check("tournamentStatuses is registration/in_progress/finished", () => {
  assert.deepEqual([...tournamentStatuses], ["registration", "in_progress", "finished"]);
});
check("tournamentFormats is playoff/round_robin/americano/mexicano", () => {
  assert.deepEqual([...tournamentFormats], ["playoff", "round_robin", "americano", "mexicano"]);
});
check("participantModes is pairs/singles", () => {
  assert.deepEqual([...participantModes], ["pairs", "singles"]);
});
check("scoringModes is sets/points", () => {
  assert.deepEqual([...scoringModes], ["sets", "points"]);
});
check("PLAYOFF_SIZES is [4,8,16] and SIZE_CAP is 24", () => {
  assert.deepEqual([...PLAYOFF_SIZES], [4, 8, 16]);
  assert.equal(SIZE_CAP, 24);
});

// --- playoff size enum ---
for (const size of [4, 8, 16] as const) {
  check(`playoff size accepts ${size}`, () => {
    const r = createTournamentSchema.safeParse({ ...base, size });
    assert.equal(r.success, true);
    if (r.success) assert.equal(r.data.size, size);
  });
}
for (const bad of [5, 0, 32, 1, 6]) {
  check(`playoff size rejects ${bad}`, () => {
    const r = createTournamentSchema.safeParse({ ...base, size: bad });
    assert.equal(r.success, false);
  });
}
check("createTournamentSchema rejects size=6 when format=playoff (path size)", () => {
  const r = createTournamentSchema.safeParse({ ...base, format: "playoff", size: 6 });
  assert.equal(r.success, false);
  if (!r.success) assert.ok(r.error.issues.some((i) => i.path[0] === "size"));
});
check("size coerces numeric string then validates membership", () => {
  const r = createTournamentSchema.safeParse({ ...base, size: "8" });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.size, 8);
});
check("size rejects non-numeric string", () => {
  const r = createTournamentSchema.safeParse({ ...base, size: "abc" });
  assert.equal(r.success, false);
});

// --- round_robin size rules (>=3, <=24) ---
check("round_robin rejects size=2", () => {
  assert.equal(createTournamentSchema.safeParse({ ...base, format: "round_robin", size: 2 }).success, false);
});
check("round_robin accepts size=3", () => {
  assert.equal(createTournamentSchema.safeParse({ ...base, format: "round_robin", size: 3 }).success, true);
});
check("round_robin accepts size=5 (free N, not power of two)", () => {
  assert.equal(createTournamentSchema.safeParse({ ...base, format: "round_robin", size: 5 }).success, true);
});
check("round_robin rejects size=25 (over cap)", () => {
  assert.equal(createTournamentSchema.safeParse({ ...base, format: "round_robin", size: 25 }).success, false);
});

// --- americano: size>=4, forces singles, points-mode ---
check("americano accepts size=4 singles points", () => {
  const r = createTournamentSchema.safeParse({
    ...base,
    format: "americano",
    participantMode: "singles",
    scoringMode: "points",
    size: 4,
  });
  assert.equal(r.success, true);
});
check("americano forces singles (pairs rejected, path participantMode)", () => {
  const r = createTournamentSchema.safeParse({
    ...base,
    format: "americano",
    participantMode: "pairs",
    scoringMode: "points",
    size: 8,
  });
  assert.equal(r.success, false);
  if (!r.success) assert.ok(r.error.issues.some((i) => i.path[0] === "participantMode"));
});
check("americano rejects scoringMode=sets (path scoringMode)", () => {
  const r = createTournamentSchema.safeParse({
    ...base,
    format: "americano",
    participantMode: "singles",
    scoringMode: "sets",
    size: 8,
  });
  assert.equal(r.success, false);
  if (!r.success) assert.ok(r.error.issues.some((i) => i.path[0] === "scoringMode"));
});
check("americano rejects size<4", () => {
  const r = createTournamentSchema.safeParse({
    ...base,
    format: "americano",
    participantMode: "singles",
    scoringMode: "points",
    size: 3,
  });
  assert.equal(r.success, false);
});

// --- mexicano: size>=8, forces singles, points-mode ---
check("mexicano accepts size=8 singles points", () => {
  const r = createTournamentSchema.safeParse({
    ...base,
    format: "mexicano",
    participantMode: "singles",
    scoringMode: "points",
    size: 8,
    totalRounds: 3, // WR-01: mexicano requires totalRounds
  });
  assert.equal(r.success, true);
});
// --- WR-01: mexicano requires totalRounds (else never terminates) ---
check("mexicano rejects missing totalRounds (path totalRounds)", () => {
  const r = createTournamentSchema.safeParse({
    ...base,
    format: "mexicano",
    participantMode: "singles",
    scoringMode: "points",
    size: 8,
  });
  assert.equal(r.success, false);
  if (!r.success) assert.ok(r.error.issues.some((i) => i.path[0] === "totalRounds"));
});
check("americano does NOT require totalRounds (derives N-1, IN-02)", () => {
  const r = createTournamentSchema.safeParse({
    ...base,
    format: "americano",
    participantMode: "singles",
    scoringMode: "points",
    size: 8,
  });
  assert.equal(r.success, true);
});
check("mexicano rejects size=6 (size<8)", () => {
  const r = createTournamentSchema.safeParse({
    ...base,
    format: "mexicano",
    participantMode: "singles",
    scoringMode: "points",
    size: 6,
  });
  assert.equal(r.success, false);
  if (!r.success) assert.ok(r.error.issues.some((i) => i.path[0] === "size"));
});
check("mexicano forces singles (pairs rejected)", () => {
  const r = createTournamentSchema.safeParse({
    ...base,
    format: "mexicano",
    participantMode: "pairs",
    scoringMode: "points",
    size: 8,
    totalRounds: 3,
  });
  assert.equal(r.success, false);
});

// --- points-mode targetPoints rule ---
check("points-mode rejects targetPoints<=0", () => {
  const r = createTournamentSchema.safeParse({
    ...base,
    format: "round_robin",
    scoringMode: "points",
    size: 4,
    targetPoints: 0,
  });
  assert.equal(r.success, false);
  if (!r.success) assert.ok(r.error.issues.some((i) => i.path[0] === "targetPoints"));
});
check("points-mode accepts omitted targetPoints (server defaults 24)", () => {
  const r = createTournamentSchema.safeParse({
    ...base,
    format: "round_robin",
    scoringMode: "points",
    size: 4,
  });
  assert.equal(r.success, true);
});

// --- new field enums ---
check("format rejects unknown value", () => {
  assert.equal(createTournamentSchema.safeParse({ ...base, format: "swiss" }).success, false);
});
check("level rejects unknown value", () => {
  assert.equal(createTournamentSchema.safeParse({ ...base, level: "wizard" }).success, false);
});
check("setsPerMatch accepts large value (no upper cap)", () => {
  const r = createTournamentSchema.safeParse({ ...base, setsPerMatch: 99 });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.setsPerMatch, 99);
});

// --- name required ---
check("name required (missing rejected)", () => {
  const { name: _omit, ...noName } = base;
  void _omit;
  assert.equal(createTournamentSchema.safeParse(noName).success, false);
});
check("name rejects empty/whitespace-only", () => {
  assert.equal(createTournamentSchema.safeParse({ ...base, name: "" }).success, false);
  assert.equal(createTournamentSchema.safeParse({ ...base, name: "   " }).success, false);
});
check("name is trimmed", () => {
  const r = createTournamentSchema.safeParse({ ...base, name: "  Cup  " });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.name, "Cup");
});

// --- date optional ---
check("date optional (omitted → undefined)", () => {
  const r = createTournamentSchema.safeParse({ ...base });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.date, undefined);
});
check("date empty string → undefined", () => {
  const r = createTournamentSchema.safeParse({ ...base, date: "" });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.date, undefined);
});
check("date valid datetime-local string parses to Date", () => {
  const r = createTournamentSchema.safeParse({ ...base, date: "2026-07-01T10:00" });
  assert.equal(r.success, true);
  if (r.success) {
    assert.ok(r.data.date instanceof Date);
    assert.equal(Number.isNaN((r.data.date as Date).getTime()), false);
  }
});
check("date invalid string rejected", () => {
  const r = createTournamentSchema.safeParse({ ...base, date: "not-a-date" });
  assert.equal(r.success, false);
});

// --- location optional ---
check("location optional (omitted → undefined)", () => {
  const r = createTournamentSchema.safeParse({ ...base });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.location, undefined);
});
check("location empty string → undefined", () => {
  const r = createTournamentSchema.safeParse({ ...base, location: "" });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.location, undefined);
});
check("location accepts trimmed value", () => {
  const r = createTournamentSchema.safeParse({ ...base, location: "  Court 1  " });
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
check("parseTournamentForm ok on valid playoff input", () => {
  const r = parseTournamentForm(
    form({
      name: "Cup",
      format: "playoff",
      participantMode: "pairs",
      level: "intermediate",
      scoringMode: "sets",
      size: "16",
      date: "",
      location: "",
    }),
  );
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.data.name, "Cup");
    assert.equal(r.data.size, 16);
    assert.equal(r.data.format, "playoff");
    assert.equal(r.data.participantMode, "pairs");
    assert.equal(r.data.level, "intermediate");
    assert.equal(r.data.scoringMode, "sets");
    assert.equal(r.data.date, undefined);
    assert.equal(r.data.location, undefined);
  }
});
check("parseTournamentForm ok with date+location+price", () => {
  const r = parseTournamentForm(
    form({
      name: "Cup",
      format: "playoff",
      participantMode: "pairs",
      level: "intermediate",
      scoringMode: "sets",
      size: "4",
      price: "500",
      date: "2026-07-01T10:00",
      location: "Court 1",
    }),
  );
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.ok(r.data.date instanceof Date);
    assert.equal(r.data.location, "Court 1");
    assert.equal(r.data.price, 500);
  }
});
check("parseTournamentForm empty optional numerics do not falsely reject", () => {
  const r = parseTournamentForm(
    form({
      name: "Cup",
      format: "playoff",
      participantMode: "pairs",
      level: "intermediate",
      scoringMode: "sets",
      size: "8",
      price: "",
      targetPoints: "",
      totalRounds: "",
      setsPerMatch: "",
      gamesPerSet: "",
    }),
  );
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.data.price, undefined);
    assert.equal(r.data.targetPoints, undefined);
  }
});
check("parseTournamentForm errors on invalid size=6 + empty name (path size)", () => {
  const r = parseTournamentForm(
    form({
      name: "",
      format: "playoff",
      participantMode: "pairs",
      level: "intermediate",
      scoringMode: "sets",
      size: "6",
    }),
  );
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.ok(r.errors.name || r.errors.size);
  }
});
check("parseTournamentForm errors include new field keys (participantMode)", () => {
  const r = parseTournamentForm(
    form({
      name: "Cup",
      format: "americano",
      participantMode: "pairs",
      level: "intermediate",
      scoringMode: "points",
      size: "8",
    }),
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.participantMode);
});

console.log(`\ntournament validation: ${passed} assertions passed.`);
