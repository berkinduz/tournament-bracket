"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Player } from "@/lib/types";
import { adminFetch } from "@/lib/admin-fetch";

interface PlayerManagerProps {
  tournamentId: string;
  players: Player[];
  onPlayersChange: () => void;
}

function SortablePlayer({
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

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

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
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all
        ${isDragging
          ? "bg-accent-orange/10 border-accent-orange z-50 shadow-lg"
          : "bg-bg-primary/50 border-border-subtle hover:border-accent-orange/30"
        }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab active:cursor-grabbing p-1 text-text-muted hover:text-text-secondary"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="3" r="1.5" />
          <circle cx="11" cy="3" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="13" r="1.5" />
          <circle cx="11" cy="13" r="1.5" />
        </svg>
      </button>
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

      {player.seed !== null && (
        <span className="px-1.5 py-0.5 bg-accent-gold/20 text-accent-gold text-[10px] font-mono rounded">
          S{player.seed}
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
  const [bulkInput, setBulkInput] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [loading, setLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const addPlayer = useCallback(async () => {
    if (!nameInput.trim()) return;
    setLoading(true);
    await adminFetch(`/api/tournaments/${tournamentId}/players`, {
      method: "POST",
      body: JSON.stringify({ names: [nameInput.trim()] }),
    });
    setNameInput("");
    onPlayersChange();
    setLoading(false);
  }, [nameInput, tournamentId, onPlayersChange]);

  const addBulkPlayers = useCallback(async () => {
    const names = bulkInput
      .split(/[,\n]/)
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    if (names.length === 0) return;
    setLoading(true);
    await adminFetch(`/api/tournaments/${tournamentId}/players`, {
      method: "POST",
      body: JSON.stringify({ names }),
    });
    setBulkInput("");
    setShowBulk(false);
    onPlayersChange();
    setLoading(false);
  }, [bulkInput, tournamentId, onPlayersChange]);

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

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = players.findIndex((p) => p.id === active.id);
      const newIndex = players.findIndex((p) => p.id === over.id);
      const reordered = arrayMove(players, oldIndex, newIndex);

      const updates = reordered.map((p, i) => ({
        id: p.id,
        seed: i + 1,
      }));

      await adminFetch(`/api/tournaments/${tournamentId}/players`, {
        method: "PATCH",
        body: JSON.stringify({ updates }),
      });
      onPlayersChange();
    },
    [players, tournamentId, onPlayersChange]
  );

  const clearSeeds = useCallback(async () => {
    const updates = players.map((p) => ({ id: p.id, seed: null }));
    await adminFetch(`/api/tournaments/${tournamentId}/players`, {
      method: "PATCH",
      body: JSON.stringify({ updates }),
    });
    onPlayersChange();
  }, [players, tournamentId, onPlayersChange]);

  const seedAll = useCallback(async () => {
    const updates = players.map((p, i) => ({ id: p.id, seed: i + 1 }));
    await adminFetch(`/api/tournaments/${tournamentId}/players`, {
      method: "PATCH",
      body: JSON.stringify({ updates }),
    });
    onPlayersChange();
  }, [players, tournamentId, onPlayersChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">
          Players ({players.length})
        </h2>
        <button
          onClick={() => setShowBulk(!showBulk)}
          className="text-xs text-accent-cyan hover:underline transition-colors"
        >
          {showBulk ? "Single add" : "Bulk add"}
        </button>
      </div>

      {showBulk ? (
        <div className="space-y-2">
          <textarea
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            placeholder="Paste names separated by commas or newlines..."
            className="w-full px-3 py-2.5 bg-bg-primary border border-border-subtle rounded-lg
                       text-sm text-text-primary placeholder:text-text-muted focus:outline-none
                       focus:border-accent-orange min-h-[80px] resize-y"
          />
          <button
            onClick={addBulkPlayers}
            disabled={loading || !bulkInput.trim()}
            className="w-full py-2.5 bg-accent-orange text-white font-semibold rounded-lg text-sm
                       hover:bg-orange-500 disabled:opacity-50 transition-colors"
          >
            Add Players
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); addPlayer(); }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Player name"
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
        </form>
      )}

      {players.length > 0 && (
        <>
          <div className="flex gap-2">
            <button
              onClick={seedAll}
              className="flex-1 py-2 text-xs border border-accent-cyan/30 text-accent-cyan
                         rounded-lg hover:bg-accent-cyan/10 transition-colors"
            >
              Seed All
            </button>
            <button
              onClick={clearSeeds}
              className="flex-1 py-2 text-xs border border-border-subtle text-text-secondary
                         rounded-lg hover:bg-white/5 transition-colors"
            >
              Clear Seeds
            </button>
          </div>

          <p className="text-[10px] text-text-muted">
            Drag to reorder. Click name to edit.
          </p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={players.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1 max-h-[350px] overflow-y-auto pr-1">
                {players.map((player, index) => (
                  <SortablePlayer
                    key={player.id}
                    player={player}
                    index={index}
                    onRemove={removePlayer}
                    onRename={renamePlayer}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}
    </div>
  );
}
