import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { generateBracket, listBracket } from "../src/lib/services/bracket";
import { recordResult } from "../src/lib/services/result";

// Standalone e2e exercise of the Phase 5 scoring engine through a full 4-pair bracket.
// Seeds users+pairs, generates the bracket, records R1 results, asserts advancement,
// records the final, asserts finished+champion, then edits the final to flip the winner
// and asserts re-propagation. Cleans up its own tournament+users on exit.
const prisma = new PrismaClient();

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
  console.log("  ok: " + msg);
}

async function main() {
  const tag = randomUUID().slice(0, 8);
  const userIds: string[] = [];

  // 8 players → 4 pairs.
  for (let i = 0; i < 8; i++) {
    const id = randomUUID();
    userIds.push(id);
    await prisma.user.create({
      data: { id, name: `E2E P${i} ${tag}`, email: `e2e-${tag}-${i}@example.test`, nickname: `e2e-${tag}-${i}`, role: "player", skillLevel: "intermediate" },
    });
  }

  const tournament = await prisma.tournament.create({
    data: { name: `E2E ${tag}`, size: 4, status: "registration" },
  });

  const pairIds: string[] = [];
  for (let i = 0; i < 4; i++) {
    const p = await prisma.pair.create({
      data: { tournamentId: tournament.id, player1Id: userIds[i * 2], player2Id: userIds[i * 2 + 1] },
    });
    pairIds.push(p.id);
  }

  console.log("== generateBracket ==");
  const gen = await generateBracket(prisma, tournament.id);
  assert(gen.matchesCreated === 3, "4-pair bracket has 3 matches");

  let bracket = await listBracket(prisma, tournament.id);
  const r1 = bracket.filter((m) => m.round === 1).sort((a, b) => a.position - b.position);
  const finalMatch = bracket.find((m) => m.nextMatchId === null)!;
  assert(r1.length === 2, "two round-1 matches");
  assert(finalMatch.round === 2, "final is round 2");
  assert(finalMatch.pairAId === null && finalMatch.pairBId === null, "final slots empty pre-results");

  console.log("== record R1 match 0: pairA wins 6:4 6:3 ==");
  const m0 = r1[0];
  const r0 = await recordResult(prisma, m0.id, [
    { gamesPair1: 6, gamesPair2: 4 },
    { gamesPair1: 6, gamesPair2: 3 },
  ]);
  assert(r0.winnerId === m0.pairAId, "match0 winner = pairA");
  assert(r0.setsWonA === 2 && r0.setsWonB === 0, "match0 2:0 sets");
  assert(r0.finished === false, "match0 not final → tournament not finished");

  console.log("== record R1 match 1: pairB wins 4:6 6:7? no — 3:6 4:6 (B 2:0) ==");
  const m1 = r1[1];
  const r1res = await recordResult(prisma, m1.id, [
    { gamesPair1: 3, gamesPair2: 6 },
    { gamesPair1: 4, gamesPair2: 6 },
  ]);
  assert(r1res.winnerId === m1.pairBId, "match1 winner = pairB");

  console.log("== advancement: final slots filled with R1 winners ==");
  bracket = await listBracket(prisma, tournament.id);
  const finalAfterR1 = bracket.find((m) => m.nextMatchId === null)!;
  // m0 feeds slot per its nextSlot; both winners should now be in the final.
  const m0meta = bracket.find((m) => m.id === m0.id)!;
  const m1meta = bracket.find((m) => m.id === m1.id)!;
  const finalSlots = [finalAfterR1.pairAId, finalAfterR1.pairBId];
  assert(finalSlots.includes(m0meta.winnerId), "final has match0 winner");
  assert(finalSlots.includes(m1meta.winnerId), "final has match1 winner");
  assert(finalAfterR1.winnerId === null, "final undecided before its result");

  console.log("== invalid set rejected (6:5 no tiebreak) ==");
  let rejected = false;
  try {
    await recordResult(prisma, finalAfterR1.id, [{ gamesPair1: 6, gamesPair2: 5 }, { gamesPair1: 6, gamesPair2: 4 }]);
  } catch (e) {
    rejected = true;
    assert((e as Error).name === "ResultError", "invalid set throws ResultError");
  }
  assert(rejected, "6:5 set rejected");

  console.log("== no-winner rejected (single set in best-of-3) ==");
  rejected = false;
  try {
    await recordResult(prisma, finalAfterR1.id, [{ gamesPair1: 6, gamesPair2: 4 }]);
  } catch (e) {
    rejected = true;
  }
  assert(rejected, "single 6:4 set rejected (no majority)");

  console.log("== record final: slot-A pair wins 6:2 6:1 ==");
  const finalA = finalAfterR1.pairAId!;
  const finalB = finalAfterR1.pairBId!;
  const rf = await recordResult(prisma, finalAfterR1.id, [
    { gamesPair1: 6, gamesPair2: 2 },
    { gamesPair1: 6, gamesPair2: 1 },
  ]);
  assert(rf.winnerId === finalA, "final winner = slot-A pair");
  assert(rf.finished === true, "final recorded → finished=true");

  const trnAfter = await prisma.tournament.findUniqueOrThrow({ where: { id: tournament.id }, select: { status: true } });
  assert(trnAfter.status === "finished", "tournament status = finished");

  bracket = await listBracket(prisma, tournament.id);
  const champMatch = bracket.find((m) => m.nextMatchId === null)!;
  assert(champMatch.winnerId === finalA, "champion = final winner (bracket read)");
  assert(champMatch.sets.length === 2, "final shows 2 sets in bracket read");

  console.log("== MATCH-04 edit: flip final so slot-B wins 6:3 6:4 ==");
  const re = await recordResult(prisma, finalAfterR1.id, [
    { gamesPair1: 3, gamesPair2: 6 },
    { gamesPair1: 4, gamesPair2: 6 },
  ]);
  assert(re.winnerId === finalB, "edited final winner = slot-B pair");
  assert(re.finished === true, "re-record of final stays finished (no-op transition)");

  bracket = await listBracket(prisma, tournament.id);
  const champMatch2 = bracket.find((m) => m.nextMatchId === null)!;
  assert(champMatch2.winnerId === finalB, "champion re-derived to slot-B after edit");

  const trnStill = await prisma.tournament.findUniqueOrThrow({ where: { id: tournament.id }, select: { status: true } });
  assert(trnStill.status === "finished", "tournament still finished after edit");

  // Cleanup (cascade pairs/matches/setscores via tournament; users separately).
  await prisma.tournament.delete({ where: { id: tournament.id } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });

  console.log("\nE2E PASSED");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
