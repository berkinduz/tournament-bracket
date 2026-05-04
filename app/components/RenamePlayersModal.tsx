"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Player } from "@/lib/types";
import { adminFetch } from "@/lib/admin-fetch";

interface RenamePlayersModalProps {
  tournamentId: string;
  players: Player[];
  onClose: () => void;
  onSaved: () => void;
}

export default function RenamePlayersModal({
  tournamentId,
  players,
  onClose,
  onSaved,
}: RenamePlayersModalProps) {
  const [edits, setEdits] = useState<Record<string, string>>(
    Object.fromEntries(players.map((p) => [p.id, p.name])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const updates = players
      .filter((p) => {
        const next = edits[p.id]?.trim();
        return next && next !== p.name;
      })
      .map((p) => ({ id: p.id, name: edits[p.id].trim() }));

    if (updates.length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await adminFetch(`/api/tournaments/${tournamentId}/players`, {
        method: "PATCH",
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        setSaving(false);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Network error");
      setSaving(false);
    }
  };

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
          <div className="px-5 pt-5 pb-3">
            <h3 className="font-bold text-lg">Rename Players</h3>
            <p className="text-xs text-text-muted mt-1">
              Bracket and match results stay intact.
            </p>
          </div>

          <div className="px-5 pb-3 max-h-[60vh] overflow-y-auto space-y-2">
            {players.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="text-accent-orange font-mono text-xs font-bold w-6 shrink-0">
                  #{i + 1}
                </span>
                <input
                  type="text"
                  value={edits[p.id] ?? ""}
                  onChange={(e) => setEdits((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  className="flex-1 px-3 py-2 text-sm border border-border-subtle rounded-lg
                             focus:outline-none focus:border-[#111]"
                />
              </div>
            ))}
          </div>

          {error && <p className="text-center text-xs text-red-500 pb-2">{error}</p>}

          <div className="px-5 pb-5 pt-2 space-y-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 bg-[#111] text-white font-semibold rounded-xl
                         hover:bg-[#333] disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={onClose}
              className="w-full py-2.5 text-text-muted hover:text-text-secondary text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
