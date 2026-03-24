"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { MatchWithPlayers } from "@/lib/types";

const COL_W = 180;
const COL_GAP = 44;
const MATCH_H = 52;
const BYE_H = 28;
const HEADER_H = 32;
const GAP = 6;

function getRoundLabel(round: number, total: number): string {
  const fromFinal = total - 1 - round;
  if (fromFinal === 0) return "Final";
  if (fromFinal === 1) return "Semis";
  if (fromFinal === 2) return "Quarters";
  return `Round ${round + 1}`;
}

/* ═══ Real match card ═══ */
function MatchCard({ match, onClick }: { match: MatchWithPlayers; onClick?: () => void }) {
  const isActive = match.status === "active";
  const isCompleted = match.status === "completed";
  const isPending = match.status === "pending";
  const p1W = isCompleted && match.winner_id === match.player1_id;
  const p2W = isCompleted && match.winner_id === match.player2_id;

  const row = (name: string, w: boolean, l: boolean, tbd: boolean, score: number | null, isTop: boolean) => (
    <div
      className={`px-3 h-[25px] flex items-center justify-between text-[13px]
        ${isTop ? "border-b border-[var(--border-subtle)]" : ""}
        ${w ? "font-bold text-[var(--winner-color)]" : ""}
        ${l ? "text-[var(--loser-color)]" : ""}
        ${tbd ? "italic text-[var(--text-muted)]" : ""}
        ${!isCompleted && !tbd ? "text-[var(--text-primary)] font-medium" : ""}`}
      style={w && isTop ? { borderColor: "var(--winner-color)" } : {}}
    >
      <span className="truncate flex-1">{name}</span>
      {isCompleted && score !== null && <span className="font-mono font-bold text-[12px] tabular-nums">{score}</span>}
      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-orange)] live-pulse shrink-0 ml-1" />}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      className={`w-full rounded-md border overflow-hidden select-none
        ${onClick ? "cursor-pointer hover:shadow-md active:scale-[0.98] transition-all" : ""}
        ${isActive ? "border-[var(--accent-orange)] border-2" : ""}
        ${isCompleted ? "border-[var(--border-strong)]" : ""}
        ${isPending ? "border-[var(--border-subtle)] opacity-50" : ""}`}
      style={{ background: isActive ? "var(--match-active-bg)" : isCompleted ? "var(--match-completed-bg)" : "var(--match-bg)" }}
    >
      {row(match.player1?.name || "TBD", p1W, isCompleted && !p1W, isPending && !match.player1, match.player1_score, true)}
      {row(match.player2?.name || "TBD", p2W, isCompleted && !p2W, isPending && !match.player2, match.player2_score, false)}
    </motion.div>
  );
}

/* ═══ Bye slot — empty line, no name shown ═══ */
function ByeSlot() {
  return (
    <div className="w-full h-full flex items-end">
      <div className="w-full border-b border-[var(--border-subtle)] opacity-20" />
    </div>
  );
}

/* ═══ BRACKET VIEW ═══ */
interface BracketViewProps {
  matches: MatchWithPlayers[];
  totalRounds: number;
  playerCount?: number;
  onMatchClick?: (match: MatchWithPlayers) => void;
}

export default function BracketView({ matches, totalRounds: numRounds, playerCount, onMatchClick }: BracketViewProps) {
  const rounds = useMemo(() => {
    if (numRounds === 0) return [];
    const map: MatchWithPlayers[][] = Array.from({ length: numRounds }, () => []);
    for (const m of matches) if (m.round < numRounds) map[m.round].push(m);
    for (const arr of map) arr.sort((a, b) => a.position - b.position);
    return map;
  }, [matches, numRounds]);

  const layout = useMemo(() => {
    if (numRounds === 0 || rounds.length === 0)
      return { yMap: {} as Record<string, number>, hMap: {} as Record<string, number>, totalH: 0 };

    const yMap: Record<string, number> = {};
    const hMap: Record<string, number> = {};

    // Round 0: stack with variable height
    let cursor = HEADER_H;
    for (let i = 0; i < (rounds[0]?.length || 0); i++) {
      const h = rounds[0][i].is_bye ? BYE_H : MATCH_H;
      yMap[`0-${i}`] = cursor;
      hMap[`0-${i}`] = h;
      cursor += h + GAP;
    }

    // Later rounds: center between two feeders
    for (let r = 1; r < numRounds; r++) {
      for (let i = 0; i < (rounds[r]?.length || 0); i++) {
        const tK = `${r - 1}-${i * 2}`, bK = `${r - 1}-${i * 2 + 1}`;
        const tY = yMap[tK] ?? 0, tH = hMap[tK] ?? MATCH_H;
        const bY = yMap[bK] ?? 0, bH = hMap[bK] ?? MATCH_H;
        const center = ((tY + tH / 2) + (bY + bH / 2)) / 2;
        const h = rounds[r][i]?.is_bye ? BYE_H : MATCH_H;
        yMap[`${r}-${i}`] = center - h / 2;
        hMap[`${r}-${i}`] = h;
      }
    }

    return { yMap, hMap, totalH: cursor + 12 };
  }, [numRounds, rounds]);

  if (numRounds === 0 || matches.length === 0 || rounds.length === 0) return null;

  const { yMap, hMap, totalH } = layout;
  const getY = (r: number, i: number) => yMap[`${r}-${i}`] ?? 0;
  const getH = (r: number, i: number) => hMap[`${r}-${i}`] ?? MATCH_H;
  const totalW = numRounds * (COL_W + COL_GAP);
  const colX = (r: number) => r * (COL_W + COL_GAP);

  // Bye explanation
  const byeCount = rounds[0]?.filter(m => m.is_bye).length ?? 0;
  const realR0 = rounds[0]?.filter(m => !m.is_bye).length ?? 0;
  const bracketSize = (rounds[0]?.length ?? 0) * 2;

  return (
    <div className="overflow-auto">
      {/* Explanation line */}
      {byeCount > 0 && playerCount && (
        <div className="px-5 pt-4 pb-1">
          <p className="text-[12px] text-[var(--text-muted)]">
            {playerCount} players — {realR0} play in Round 1, {byeCount} advance directly to Round 2 (bracket size: {bracketSize})
          </p>
        </div>
      )}
      <div className="relative" style={{ width: totalW + 40, height: totalH, minWidth: totalW + 40, padding: "0 20px" }}>
        {/* Connector lines */}
        <svg className="absolute inset-0 pointer-events-none" width={totalW + 40} height={totalH}>
          <g transform="translate(20,0)">
            {Array.from({ length: numRounds - 1 }, (_, r) =>
              (rounds[r] || []).map((m, i) => {
                const ni = Math.floor(i / 2);
                const h1 = getH(r, i), h2 = getH(r + 1, ni);
                const y1 = getY(r, i) + h1 / 2;
                const y2 = getY(r + 1, ni) + h2 / 2;
                const x1 = colX(r) + COL_W, x2 = colX(r + 1), mx = (x1 + x2) / 2;
                const done = m.status === "completed" || m.is_bye;
                const c = done ? "var(--accent-orange)" : "var(--bracket-line)";
                const o = done ? (m.is_bye ? 0.18 : 0.4) : 0.1;
                return (
                  <g key={`c-${r}-${i}`}>
                    <line x1={x1} y1={y1} x2={mx} y2={y1} stroke={c} strokeWidth={1.5} opacity={o} />
                    <line x1={mx} y1={y1} x2={mx} y2={y2} stroke={c} strokeWidth={1.5} opacity={o} />
                    <line x1={mx} y1={y2} x2={x2} y2={y2} stroke={c} strokeWidth={1.5} opacity={o} />
                  </g>
                );
              })
            )}
          </g>
        </svg>

        {/* Round headers */}
        {Array.from({ length: numRounds }, (_, r) => (
          <div key={`h-${r}`} className="absolute text-center" style={{ left: 20 + colX(r), top: 8, width: COL_W }}>
            <span className="text-[10px] font-bold font-mono uppercase tracking-widest text-[var(--text-muted)]">
              {getRoundLabel(r, numRounds)}
            </span>
          </div>
        ))}

        {/* Cards */}
        {rounds.map((rm, r) =>
          rm.map((m, i) => (
            <div key={m.id} className="absolute" style={{ left: 20 + colX(r), top: getY(r, i), width: COL_W, height: getH(r, i) }}>
              {m.is_bye
                ? <ByeSlot />
                : <MatchCard match={m} onClick={
                    onMatchClick && (m.status === "active" || m.status === "completed")
                      ? () => onMatchClick(m) : undefined
                  } />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
