"use client";

import { useState, useCallback } from "react";
import type { Player } from "@/lib/types";
import { adminFetch } from "@/lib/admin-fetch";

interface PlayerManagerProps {
  tournamentId: string;
  players: Player[];
  onPlayersChange: () => void;
}

function PlayerRow({
  player,
  index,
  onRemove,
  onRename,
}: {
  player: Player;
  index: number;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(player.name);

  const saveEdit = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== player.name) {
      onRename(player.id, trimmed);
    } else {
      setEditName(player.name);
    }
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-bg-primary/50 border-border-subtle hover:border-accent-orange/30 transition-colors">
      <span className="text-accent-orange font-mono text-xs font-bold min-w-[1.5rem]">
        #{index + 1}
      </span>

      {editing ? (
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveEdit();
            if (e.key === "Escape") { setEditName(player.name); setEditing(false); }
          }}
          autoFocus
          className="flex-1 px-2 py-1 text-sm bg-white border border-accent-orange rounded
                     text-text-primary focus:outline-none"
        />
      ) : (
        <span
          className="flex-1 text-sm text-text-primary cursor-text"
          onClick={() => { setEditing(true); setEditName(player.name); }}
          title="Click to edit name"
        >
          {player.name}
        </span>
      )}

      <button
        onClick={() => onRemove(player.id)}
        className="p-1 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 1l12 12M13 1L1 13" />
        </svg>
      </button>
    </div>
  );
}

export default function PlayerManager({
  tournamentId,
  players,
  onPlayersChange,
}: PlayerManagerProps) {
  const [nameInput, setNameInput] = useState("");
  const [loading, setLoading] = useState(false);

  const addPlayers = useCallback(async () => {
    const names = nameInput
      .split(/[,\n]/)
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    if (names.length === 0) return;
    setLoading(true);
    try {
      await adminFetch(`/api/tournaments/${tournamentId}/players`, {
        method: "POST",
        body: JSON.stringify({ names }),
      });
      setNameInput("");
      onPlayersChange();
    } finally {
      setLoading(false);
    }
  }, [nameInput, tournamentId, onPlayersChange]);

  const removePlayer = useCallback(
    async (playerId: string) => {
      await adminFetch(
        `/api/tournaments/${tournamentId}/players?playerId=${playerId}`,
        { method: "DELETE" }
      );
      onPlayersChange();
    },
    [tournamentId, onPlayersChange]
  );

  const renamePlayer = useCallback(
    async (playerId: string, newName: string) => {
      await adminFetch(`/api/tournaments/${tournamentId}/players`, {
        method: "PATCH",
        body: JSON.stringify({ updates: [{ id: playerId, name: newName }] }),
      });
      onPlayersChange();
    },
    [tournamentId, onPlayersChange]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">
          Players ({players.length})
        </h2>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); addPlayers(); }}
        className="space-y-1.5"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Player name, or comma-separated names"
            className="flex-1 px-3 py-2.5 bg-bg-primary border border-border-subtle rounded-lg text-sm
                       text-text-primary placeholder:text-text-muted focus:outline-none
                       focus:border-accent-orange"
          />
          <button
            type="submit"
            disabled={loading || !nameInput.trim()}
            className="px-5 py-2.5 bg-accent-orange text-white font-semibold rounded-lg text-sm
                       hover:bg-orange-500 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            Add
          </button>
        </div>
        <p className="text-[10px] text-text-muted">
          Enter one name, or separate multiple players with commas.
        </p>
      </form>

      {players.length > 0 && (
        <>
          <p className="text-[10px] text-text-muted">Click name to edit.</p>
          <div className="space-y-1 max-h-[350px] overflow-y-auto pr-1">
            {players.map((player, index) => (
              <PlayerRow
                key={player.id}
                player={player}
                index={index}
                onRemove={removePlayer}
                onRename={renamePlayer}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
