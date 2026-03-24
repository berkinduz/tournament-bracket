import type { Player } from "./types";

/**
 * Single-elimination bracket with power-of-2 sizing.
 * Byes in round 0 for non-power-of-2 player counts.
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

interface Slot {
  playerId: string | null;
  isBye: boolean;
}

export function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function totalRounds(bracketSize: number): number {
  return Math.log2(bracketSize);
}

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
 * Distribute bye positions evenly across the bracket.
 * Round 2 groups = pairs of R0 pairs: (0,1), (2,3), ...
 * Rule: max 1 bye per group first, then fill second slots.
 */
function distributeByes(numPairs: number, numByes: number): Set<number> {
  const byePairSet = new Set<number>();
  const numGroups = numPairs / 2;
  for (let g = 0; g < numGroups && byePairSet.size < numByes; g++) {
    byePairSet.add(g * 2);
  }
  for (let g = 0; g < numGroups && byePairSet.size < numByes; g++) {
    byePairSet.add(g * 2 + 1);
  }
  return byePairSet;
}

/**
 * Build all matches from a pre-built slot array.
 * Shared by both auto and manual generation.
 */
function buildMatchesFromSlots(slots: Slot[], bracketSize: number): GeneratedMatch[] {
  const numRounds = totalRounds(bracketSize);
  const numPairs = bracketSize / 2;
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

  // Mark real round-0 matches with both players as active
  for (const m of r0) {
    if (!m.isBye && m.player1Id && m.player2Id) m.status = "active";
  }

  return allMatches;
}

/**
 * Generate bracket with random placement.
 */
export function generateBracket(players: Player[]): GeneratedMatch[] {
  const n = players.length;
  if (n < 2) throw new Error("Need at least 2 players");

  const bracketSize = nextPowerOf2(n);
  const numByes = bracketSize - n;
  const numPairs = bracketSize / 2;

  const shuffled = shuffleArray(players);
  const byePairSet = distributeByes(numPairs, numByes);

  // Build slots
  const slots: Slot[] = Array.from({ length: bracketSize }, () => ({ playerId: null, isBye: false }));
  for (const p of byePairSet) slots[p * 2 + 1].isBye = true;

  // Place players into non-bye slots
  let pi = 0;
  for (let i = 0; i < bracketSize; i++) {
    if (!slots[i].isBye && pi < shuffled.length) {
      slots[i].playerId = shuffled[pi++].id;
    }
  }

  return buildMatchesFromSlots(slots, bracketSize);
}

/**
 * Generate bracket from explicit pairings.
 * pairings: array of [player1Id, player2Id] for each real match.
 * Remaining players get auto-distributed byes.
 */
export function generateBracketFromPairings(
  players: Player[],
  pairings: [string, string][]
): GeneratedMatch[] {
  const n = players.length;
  if (n < 2) throw new Error("Need at least 2 players");

  const bracketSize = nextPowerOf2(n);
  const numByes = bracketSize - n;
  const numPairs = bracketSize / 2;
  const expectedRealMatches = numPairs - numByes;

  if (pairings.length !== expectedRealMatches) {
    throw new Error(`Expected ${expectedRealMatches} pairings, got ${pairings.length}`);
  }

  // Validate player IDs
  const playerIds = new Set(players.map(p => p.id));
  const usedIds = new Set<string>();
  for (const [a, b] of pairings) {
    if (!playerIds.has(a) || !playerIds.has(b)) throw new Error("Invalid player ID in pairings");
    if (usedIds.has(a) || usedIds.has(b)) throw new Error("Duplicate player in pairings");
    if (a === b) throw new Error("Player cannot play against themselves");
    usedIds.add(a);
    usedIds.add(b);
  }

  // Players not in pairings get byes
  const byePlayers = players.filter(p => !usedIds.has(p.id));
  const byePairSet = distributeByes(numPairs, numByes);

  // Build slots
  const slots: Slot[] = Array.from({ length: bracketSize }, () => ({ playerId: null, isBye: false }));
  for (const p of byePairSet) slots[p * 2 + 1].isBye = true;

  // Place paired players into non-bye pair positions
  let pairingIdx = 0;
  for (let pos = 0; pos < numPairs; pos++) {
    if (!byePairSet.has(pos)) {
      slots[pos * 2].playerId = pairings[pairingIdx][0];
      slots[pos * 2 + 1].playerId = pairings[pairingIdx][1];
      pairingIdx++;
    }
  }

  // Place bye players into bye pair positions
  let byeIdx = 0;
  for (let pos = 0; pos < numPairs; pos++) {
    if (byePairSet.has(pos) && byeIdx < byePlayers.length) {
      slots[pos * 2].playerId = byePlayers[byeIdx++].id;
    }
  }

  return buildMatchesFromSlots(slots, bracketSize);
}

/** How many real (non-bye) matches will be in Round 0? */
export function calcRealMatchCount(playerCount: number): number {
  if (playerCount < 2) return 0;
  const bracketSize = nextPowerOf2(playerCount);
  const numByes = bracketSize - playerCount;
  return bracketSize / 2 - numByes;
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
