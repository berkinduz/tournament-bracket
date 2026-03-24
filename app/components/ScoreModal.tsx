"use client";

import { useState, useCallback, useMemo } from "react";
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

interface ScoreOption {
  p1: number;
  p2: number;
  winnerId: string | null;
  label: string;
}

export default function ScoreModal({
  match,
  tournamentId,
  bestOf,
  onClose,
  onSaved,
}: ScoreModalProps) {
  const winsNeeded = Math.ceil(bestOf / 2); // 2 for Bo3, 3 for Bo5
  const [saving, setSaving] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [selected, setSelected] = useState<ScoreOption | null>(null);
  const isCompleted = match.status === "completed";

  // Generate all valid score combinations
  const scoreOptions = useMemo(() => {
    const options: ScoreOption[] = [];
    // Player 1 wins: they have winsNeeded, player 2 has 0..winsNeeded-1
    for (let loserScore = 0; loserScore < winsNeeded; loserScore++) {
      options.push({
        p1: winsNeeded,
        p2: loserScore,
        winnerId: match.player1_id,
        label: `${winsNeeded}–${loserScore}`,
      });
    }
    // Player 2 wins: they have winsNeeded, player 1 has 0..winsNeeded-1
    for (let loserScore = 0; loserScore < winsNeeded; loserScore++) {
      options.push({
        p1: loserScore,
        p2: winsNeeded,
        winnerId: match.player2_id,
        label: `${loserScore}–${winsNeeded}`,
      });
    }
    return options;
  }, [winsNeeded, match.player1_id, match.player2_id]);

  // Pre-select if already completed
  const currentSelection = isCompleted
    ? scoreOptions.find((o) => o.p1 === match.player1_score && o.p2 === match.player2_score) || null
    : null;

  const activeSelection = selected || currentSelection;

  const handleSave = useCallback(async () => {
    if (!activeSelection) return;
    setSaving(true);
    await adminFetch(
      `/api/tournaments/${tournamentId}/matches/${match.id}/score`,
      {
        method: "POST",
        body: JSON.stringify({
          player1_score: activeSelection.p1,
          player2_score: activeSelection.p2,
          winner_id: activeSelection.winnerId,
        }),
      }
    );
    onSaved();
    onClose();
  }, [activeSelection, tournamentId, match.id, onSaved, onClose]);

  const handleUndo = useCallback(async () => {
    setUndoing(true);
    await adminFetch(
      `/api/tournaments/${tournamentId}/matches/${match.id}/score`,
      { method: "DELETE" }
    );
    onSaved();
    onClose();
  }, [tournamentId, match.id, onSaved, onClose]);

  const p1Name = match.player1?.name || "TBD";
  const p2Name = match.player2?.name || "TBD";

  // Split options into p1-wins and p2-wins
  const p1WinOptions = scoreOptions.filter((o) => o.winnerId === match.player1_id);
  const p2WinOptions = scoreOptions.filter((o) => o.winnerId === match.player2_id);

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
          className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-5 pt-5 pb-3 text-center">
            <p className="text-xs text-text-muted font-mono mb-1">
              Best of {bestOf}
            </p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-lg font-bold text-text-primary">{p1Name}</span>
              <span className="text-text-muted text-sm">vs</span>
              <span className="text-lg font-bold text-text-primary">{p2Name}</span>
            </div>
          </div>

          {/* Score grid */}
          <div className="px-5 pb-4">
            {/* Player 1 wins */}
            <p className="text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
              {p1Name} wins
            </p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {p1WinOptions.map((opt) => {
                const isSelected = activeSelection?.p1 === opt.p1 && activeSelection?.p2 === opt.p2;
                return (
                  <button
                    key={opt.label}
                    onClick={() => setSelected(opt)}
                    className={`py-3 rounded-xl text-center text-lg font-mono font-bold transition-all
                      ${isSelected
                        ? "bg-green-600 text-white shadow-md scale-105"
                        : "bg-gray-100 text-text-primary hover:bg-gray-200 active:scale-95"
                      }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Player 2 wins */}
            <p className="text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
              {p2Name} wins
            </p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {p2WinOptions.map((opt) => {
                const isSelected = activeSelection?.p1 === opt.p1 && activeSelection?.p2 === opt.p2;
                return (
                  <button
                    key={opt.label}
                    onClick={() => setSelected(opt)}
                    className={`py-3 rounded-xl text-center text-lg font-mono font-bold transition-all
                      ${isSelected
                        ? "bg-green-600 text-white shadow-md scale-105"
                        : "bg-gray-100 text-text-primary hover:bg-gray-200 active:scale-95"
                      }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="px-5 pb-5 space-y-2">
            <button
              onClick={handleSave}
              disabled={!activeSelection || saving}
              className="w-full py-3.5 bg-accent-orange text-white font-bold text-base rounded-xl
                         hover:bg-orange-500 disabled:opacity-30 disabled:cursor-not-allowed
                         transition-colors active:scale-[0.98]"
            >
              {saving ? "Saving..." : "Confirm"}
            </button>

            {isCompleted && (
              <button
                onClick={handleUndo}
                disabled={undoing}
                className="w-full py-3 border border-red-300 text-red-500 font-semibold
                           rounded-xl hover:bg-red-50 transition-colors text-sm"
              >
                {undoing ? "Undoing..." : "Undo Result"}
              </button>
            )}

            <button
              onClick={onClose}
              className="w-full py-2.5 text-text-muted hover:text-text-secondary transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
