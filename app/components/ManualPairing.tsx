"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Player } from "@/lib/types";
import { calcRealMatchCount } from "@/lib/bracket";

interface ManualPairingProps {
  players: Player[];
  onPairingsChange: (pairings: [string, string][] | null) => void;
}

export default function ManualPairing({ players, onPairingsChange }: ManualPairingProps) {
  const realMatchCount = calcRealMatchCount(players.length);
  const numByes = players.length % 2; // 0 or 1 with accumulated byes

  const [slots, setSlots] = useState<Array<[string | null, string | null]>>(
    () => Array.from({ length: realMatchCount }, () => [null, null])
  );

  // Reset slots when player count changes
  useEffect(() => {
    const newCount = calcRealMatchCount(players.length);
    setSlots(Array.from({ length: newCount }, () => [null, null]));
  }, [players.length]);

  const assignedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [a, b] of slots) {
      if (a) ids.add(a);
      if (b) ids.add(b);
    }
    return ids;
  }, [slots]);

  const unassigned = useMemo(
    () => players.filter((p) => !assignedIds.has(p.id)),
    [players, assignedIds]
  );

  const isComplete = useMemo(
    () => slots.length > 0 && slots.every(([a, b]) => a !== null && b !== null),
    [slots]
  );

  // Notify parent when completeness changes
  useEffect(() => {
    if (isComplete) {
      onPairingsChange(slots as [string, string][]);
    } else {
      onPairingsChange(null);
    }
  }, [isComplete, slots, onPairingsChange]);

  const assignPlayer = useCallback((matchIdx: number, slotIdx: 0 | 1, playerId: string | null) => {
    setSlots((prev) => {
      const next = [...prev];
      next[matchIdx] = [...next[matchIdx]] as [string | null, string | null];
      next[matchIdx][slotIdx] = playerId || null;
      return next;
    });
  }, []);

  const autoFillAll = useCallback(() => {
    const shuffled = [...players];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Take first realMatchCount*2 players for matches
    const matchPlayers = shuffled.slice(0, realMatchCount * 2);
    const newSlots: Array<[string | null, string | null]> = [];
    for (let i = 0; i < realMatchCount; i++) {
      newSlots.push([matchPlayers[i * 2]?.id ?? null, matchPlayers[i * 2 + 1]?.id ?? null]);
    }
    setSlots(newSlots);
  }, [players, realMatchCount]);

  const clearAll = useCallback(() => {
    setSlots(Array.from({ length: realMatchCount }, () => [null, null]));
  }, [realMatchCount]);

  // Available players for a given select (currently selected + unassigned)
  const availableFor = (matchIdx: number, slotIdx: 0 | 1) => {
    const currentId = slots[matchIdx][slotIdx];
    return players.filter((p) => p.id === currentId || !assignedIds.has(p.id));
  };

  if (realMatchCount === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Match Pairings</h3>
          <p className="text-xs text-text-muted mt-0.5">
            {realMatchCount} matches to assign · {numByes > 0 ? `${numByes} players get byes` : "no byes"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={autoFillAll}
            className="px-3 py-1.5 text-xs border border-border-subtle rounded-lg
                       text-text-secondary hover:text-text-primary hover:border-[var(--text-primary)] transition-colors"
          >
            Randomize
          </button>
          <button
            onClick={clearAll}
            className="px-3 py-1.5 text-xs border border-border-subtle rounded-lg
                       text-text-secondary hover:text-text-primary hover:border-[var(--text-primary)] transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Match slots */}
      <div className="space-y-2">
        {slots.map(([p1, p2], idx) => (
          <div
            key={idx}
            className={`flex items-center gap-2 p-3 rounded-lg border transition-colors
              ${p1 && p2 ? "border-green-200 bg-green-50/50" : "border-border-subtle bg-bg-primary/50"}`}
          >
            <span className="text-xs font-mono text-text-muted font-bold min-w-[2rem] shrink-0">
              #{idx + 1}
            </span>
            <select
              value={p1 ?? ""}
              onChange={(e) => assignPlayer(idx, 0, e.target.value || null)}
              className="flex-1 min-w-0 px-2 py-2 text-sm border border-border-subtle rounded-lg bg-white
                         text-text-primary focus:outline-none focus:border-[var(--text-primary)]"
            >
              <option value="">Select player...</option>
              {availableFor(idx, 0).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <span className="text-xs text-text-muted font-bold shrink-0">vs</span>
            <select
              value={p2 ?? ""}
              onChange={(e) => assignPlayer(idx, 1, e.target.value || null)}
              className="flex-1 min-w-0 px-2 py-2 text-sm border border-border-subtle rounded-lg bg-white
                         text-text-primary focus:outline-none focus:border-[var(--text-primary)]"
            >
              <option value="">Select player...</option>
              {availableFor(idx, 1).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Unassigned = bye players */}
      {numByes > 0 && unassigned.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-text-secondary mb-2">
            Automatic Bye ({unassigned.length})
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {unassigned.map((p) => (
              <span
                key={p.id}
                className="px-2.5 py-1 text-xs bg-amber-50 text-amber-700 rounded-full border border-amber-200"
              >
                {p.name}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-text-muted mt-1">
            This player advances directly to Round 2.
          </p>
        </div>
      )}

      {/* Completion indicator */}
      {isComplete && (
        <p className="text-xs text-green-600 font-medium">
          ✓ All pairings assigned — ready to generate bracket
        </p>
      )}
    </div>
  );
}
