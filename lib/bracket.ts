import type { Player } from "./types";

/**
 * Single-elimination bracket with power-of-2 sizing.
 * Byes in round 0 for non-power-of-2 player counts.
 * No seeding — random placement.
 */

interface GeneratedMatch {
  round: number;
  position: number;
  player1Id: string | null;
  player2Id: string | null;
  isBye: boolean;
  winnerId: string | null;
  status: "pending" | "active" | "completed";
}

export function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function totalRounds(bracketSize: number): number {
  return Math.log2(bracketSize);
}

/** Convenience: total rounds for N players */
export function calcTotalRounds(n: number): number {
  if (n < 2) return 0;
  return totalRounds(nextPowerOf2(n));
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Generate bracket. Random placement, byes in round 0.
 * Byes distributed evenly: even-indexed pairs first, then odd.
 */
export function generateBracket(players: Player[]): GeneratedMatch[] {
  const n = players.length;
  if (n < 2) throw new Error("Need at least 2 players");

  const bracketSize = nextPowerOf2(n);
  const numByes = bracketSize - n;
  const numRounds = totalRounds(bracketSize);
  const numPairs = bracketSize / 2;

  const shuffled = shuffleArray(players);

  // Distribute byes evenly so no two bye players meet in Round 2.
  // Round 2 groups = pairs of R0 pairs: (0,1), (2,3), (4,5), ...
  // Rule: max 1 bye per group first, then fill second slots if needed.
  const byePairSet = new Set<number>();
  const numGroups = numPairs / 2;

  // Pass 1: first slot of each group (pair 0, 2, 4, 6, ...)
  for (let g = 0; g < numGroups && byePairSet.size < numByes; g++) {
    byePairSet.add(g * 2);
  }
  // Pass 2: second slot of each group (pair 1, 3, 5, 7, ...)
  for (let g = 0; g < numGroups && byePairSet.size < numByes; g++) {
    byePairSet.add(g * 2 + 1);
  }

  // Build slots
  const slots: Array<{ playerId: string | null; isBye: boolean }> = Array.from(
    { length: bracketSize }, () => ({ playerId: null, isBye: false })
  );
  for (const p of byePairSet) slots[p * 2 + 1].isBye = true;

  // Place players into non-bye slots
  let pi = 0;
  for (let i = 0; i < bracketSize; i++) {
    if (!slots[i].isBye && pi < shuffled.length) {
      slots[i].playerId = shuffled[pi++].id;
    }
  }

  const allMatches: GeneratedMatch[] = [];

  // Round 0
  for (let pos = 0; pos < numPairs; pos++) {
    const s1 = slots[pos * 2], s2 = slots[pos * 2 + 1];
    const isBye = s1.isBye || s2.isBye;
    const p1 = s1.isBye ? null : s1.playerId;
    const p2 = s2.isBye ? null : s2.playerId;
    const winnerId = isBye ? (p1 || p2) : null;
    allMatches.push({
      round: 0, position: pos,
      player1Id: p1, player2Id: p2,
      isBye, winnerId,
      status: isBye ? "completed" : (p1 && p2 ? "active" : "pending"),
    });
  }

  // Rounds 1+
  for (let round = 1; round < numRounds; round++) {
    const count = bracketSize / Math.pow(2, round + 1);
    for (let pos = 0; pos < count; pos++) {
      allMatches.push({
        round, position: pos,
        player1Id: null, player2Id: null,
        isBye: false, winnerId: null, status: "pending",
      });
    }
  }

  // Advance bye winners to round 1
  const r0 = allMatches.filter(m => m.round === 0);
  const r1 = allMatches.filter(m => m.round === 1);
  for (const m of r0) {
    if (m.isBye && m.winnerId) {
      const np = Math.floor(m.position / 2);
      const next = r1.find(x => x.position === np);
      if (next) {
        if (m.position % 2 === 0) next.player1Id = m.winnerId;
        else next.player2Id = m.winnerId;
        if (next.player1Id && next.player2Id) next.status = "active";
      }
    }
  }

  // Advance real round-0 match results (if both are set, mark active)
  for (const m of r0) {
    if (!m.isBye && m.player1Id && m.player2Id) m.status = "active";
  }

  return allMatches;
}

export function getNextMatchSlot(round: number, position: number) {
  return {
    round: round + 1,
    position: Math.floor(position / 2),
    slot: (position % 2 === 0 ? "player1" : "player2") as "player1" | "player2",
  };
}

export function getDownstreamMatches(round: number, position: number, numRounds: number) {
  const result: Array<{ round: number; position: number }> = [];
  let r = round, p = position;
  while (r < numRounds - 1) {
    const next = getNextMatchSlot(r, p);
    result.push({ round: next.round, position: next.position });
    r = next.round; p = next.position;
  }
  return result;
}
