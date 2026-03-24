"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { MatchWithPlayers, BestOf } from "@/lib/types";
import { adminFetch } from "@/lib/admin-fetch";

interface ScoreModalProps {
  match: MatchWithPlayers;
  tournamentId: string;
  bestOf: BestOf;
  onClose: () => void;
  onSaved: () => void;
}

export default function ScoreModal({ match, tournamentId, bestOf, onClose, onSaved }: ScoreModalProps) {
  const maxScore = Math.ceil(bestOf / 2); // 2 for Bo3, 3 for Bo5
  const [p1Score, setP1Score] = useState<number>(match.player1_score ?? 0);
  const [p2Score, setP2Score] = useState<number>(match.player2_score ?? 0);
  const [saving, setSaving] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const isCompleted = match.status === "completed";

  const p1Name = match.player1?.name || "TBD";
  const p2Name = match.player2?.name || "TBD";

  const winnerId = p1Score > p2Score ? match.player1_id : p2Score > p1Score ? match.player2_id : null;
  const canSave = p1Score !== p2Score && p1Score >= 0 && p2Score >= 0;

  const increment = (player: 1 | 2) => {
    if (player === 1) setP1Score((s) => Math.min(s + 1, maxScore));
    else setP2Score((s) => Math.min(s + 1, maxScore));
    setApiError(null);
  };

  const decrement = (player: 1 | 2) => {
    if (player === 1) setP1Score((s) => Math.max(0, s - 1));
    else setP2Score((s) => Math.max(0, s - 1));
    setApiError(null);
  };

  const handleSave = useCallback(async () => {
    if (!winnerId) return;
    setSaving(true);
    setApiError(null);
    try {
      const res = await adminFetch(
        `/api/tournaments/${tournamentId}/matches/${match.id}/score`,
        {
          method: "POST",
          body: JSON.stringify({ player1_score: p1Score, player2_score: p2Score, winner_id: winnerId }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        setApiError(data.error || "Failed to save");
        setSaving(false);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setApiError("Network error");
      setSaving(false);
    }
  }, [winnerId, p1Score, p2Score, tournamentId, match.id, onSaved, onClose]);

  const handleUndo = useCallback(async () => {
    setUndoing(true);
    setApiError(null);
    try {
      const res = await adminFetch(
        `/api/tournaments/${tournamentId}/matches/${match.id}/score`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        setApiError(data.error || "Failed to undo");
        setUndoing(false);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setApiError("Network error");
      setUndoing(false);
    }
  }, [tournamentId, match.id, onSaved, onClose]);

  const ScoreControl = ({ name, score, player, isWinner }: {
    name: string; score: number; player: 1 | 2; isWinner: boolean;
  }) => (
    <div className={`flex-1 rounded-xl p-4 text-center transition-colors
      ${isWinner ? "bg-green-50 ring-2 ring-green-500" : "bg-gray-50"}`}>
      <p className={`text-sm font-semibold mb-3 truncate ${isWinner ? "text-green-700" : "text-text-secondary"}`}>
        {name}
      </p>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => decrement(player)}
          className="w-10 h-10 rounded-full bg-white border border-border-subtle text-lg font-bold
                     hover:bg-gray-100 active:scale-90 transition-all flex items-center justify-center"
        >
          −
        </button>
        <span className={`text-4xl font-bold font-mono tabular-nums min-w-[3rem]
          ${isWinner ? "text-green-600" : "text-text-primary"}`}>
          {score}
        </span>
        <button
          onClick={() => increment(player)}
          disabled={score >= maxScore}
          className="w-10 h-10 rounded-full bg-white border border-border-subtle text-lg font-bold
                     hover:bg-gray-100 active:scale-90 transition-all flex items-center justify-center
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          +
        </button>
      </div>
      {isWinner && <p className="text-xs text-green-600 font-bold mt-2">WINNER</p>}
    </div>
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="px-5 pt-5 pb-3 text-center">
            <p className="text-xs text-text-muted font-mono">Enter Score</p>
          </div>

          <div className="px-5 pb-4 flex gap-3">
            <ScoreControl name={p1Name} score={p1Score} player={1}
              isWinner={p1Score > p2Score && p1Score !== p2Score} />
            <div className="flex items-center text-text-muted font-bold text-lg pt-6">:</div>
            <ScoreControl name={p2Name} score={p2Score} player={2}
              isWinner={p2Score > p1Score && p1Score !== p2Score} />
          </div>

          {p1Score === p2Score && p1Score > 0 && (
            <p className="text-center text-xs text-amber-500 font-medium pb-2">
              Scores can&apos;t be equal — one player must win
            </p>
          )}

          {apiError && (
            <p className="text-center text-xs text-red-500 font-medium pb-2">{apiError}</p>
          )}

          <div className="px-5 pb-5 space-y-2">
            <button
              onClick={handleSave}
              disabled={!canSave || saving}
              className="w-full py-3.5 bg-[var(--accent-orange)] text-white font-bold text-base rounded-xl
                         hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed
                         transition-colors active:scale-[0.98]"
            >
              {saving ? "Saving..." : !canSave ? "Enter score" : `Confirm — ${winnerId === match.player1_id ? p1Name : p2Name} wins`}
            </button>

            {isCompleted && (
              <button onClick={handleUndo} disabled={undoing}
                className="w-full py-3 border border-red-300 text-red-500 font-semibold
                           rounded-xl hover:bg-red-50 transition-colors text-sm">
                {undoing ? "Undoing..." : "Undo Result"}
              </button>
            )}

            <button onClick={onClose}
              className="w-full py-2.5 text-text-muted hover:text-text-secondary transition-colors text-sm">
              Cancel
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
