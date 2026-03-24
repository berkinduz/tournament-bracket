"use client";

import { useState, useEffect, useCallback } from "react";
import { adminFetch } from "@/lib/admin-fetch";
import PlayerManager from "@/app/components/PlayerManager";
import ScoreModal from "@/app/components/ScoreModal";
import BracketView from "@/app/components/BracketView";
import { QRCodeSVG } from "qrcode.react";
import type { Tournament, Player, Match, MatchWithPlayers, BestOf } from "@/lib/types";
import { calcTotalRounds } from "@/lib/bracket";

export default function AdminPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [scoreMatch, setScoreMatch] = useState<MatchWithPlayers | null>(null);
  const [loading, setLoading] = useState(false);

  // New tournament form
  const [newName, setNewName] = useState("");
  const [newBestOf, setNewBestOf] = useState<BestOf>(3);
  const [showCreate, setShowCreate] = useState(false);

  const loadTournaments = useCallback(async () => {
    const res = await fetch("/api/tournaments");
    const data = await res.json();
    setTournaments(data);
  }, []);

  const loadPlayers = useCallback(async (tId: string) => {
    const res = await fetch(`/api/tournaments/${tId}/players`);
    const data = await res.json();
    setPlayers(data);
  }, []);

  const loadMatches = useCallback(async (tId: string) => {
    const res = await fetch(`/api/tournaments/${tId}/matches`);
    const data = await res.json();
    setMatches(data);
  }, []);

  useEffect(() => {
    loadTournaments();
  }, [loadTournaments]);

  useEffect(() => {
    if (selectedTournament) {
      loadPlayers(selectedTournament.id);
      if (selectedTournament.status !== "setup") {
        loadMatches(selectedTournament.id);
      } else {
        setMatches([]);
      }
    }
  }, [selectedTournament, loadPlayers, loadMatches]);

  const createTournament = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    const res = await adminFetch("/api/tournaments", {
      method: "POST",
      body: JSON.stringify({ name: newName.trim(), best_of: newBestOf }),
    });
    const data = await res.json();
    setNewName("");
    setShowCreate(false);
    await loadTournaments();
    setSelectedTournament(data);
    setLoading(false);
  };

  const generateBracket = async () => {
    if (!selectedTournament) return;
    setLoading(true);
    await adminFetch(`/api/tournaments/${selectedTournament.id}/generate`, {
      method: "POST",
    });
    const tRes = await fetch(`/api/tournaments/${selectedTournament.id}`);
    const tData = await tRes.json();
    setSelectedTournament(tData);
    await loadMatches(selectedTournament.id);
    setLoading(false);
  };

  const resetBracket = async () => {
    if (!selectedTournament) return;
    if (!confirm("Reset bracket? All match results will be lost. You'll go back to player setup.")) return;
    setLoading(true);
    await adminFetch(`/api/tournaments/${selectedTournament.id}/reset`, {
      method: "POST",
    });
    const tRes = await fetch(`/api/tournaments/${selectedTournament.id}`);
    const tData = await tRes.json();
    setSelectedTournament(tData);
    setMatches([]);
    setLoading(false);
  };

  const reshuffleBracket = async () => {
    if (!selectedTournament) return;
    if (!confirm("Reshuffle bracket? All match results will be lost and a new random bracket will be generated.")) return;
    setLoading(true);
    // Reset first, then regenerate
    await adminFetch(`/api/tournaments/${selectedTournament.id}/reset`, {
      method: "POST",
    });
    await adminFetch(`/api/tournaments/${selectedTournament.id}/generate`, {
      method: "POST",
    });
    const tRes = await fetch(`/api/tournaments/${selectedTournament.id}`);
    const tData = await tRes.json();
    setSelectedTournament(tData);
    await loadMatches(selectedTournament.id);
    setLoading(false);
  };

  const deleteTournament = async () => {
    if (!selectedTournament) return;
    if (!confirm("Delete this tournament permanently?")) return;
    await adminFetch(`/api/tournaments/${selectedTournament.id}`, {
      method: "DELETE",
    });
    setSelectedTournament(null);
    setPlayers([]);
    setMatches([]);
    loadTournaments();
  };

  const getMatchWithPlayers = (match: Match): MatchWithPlayers => ({
    ...match,
    player1: players.find((p) => p.id === match.player1_id) || null,
    player2: players.find((p) => p.id === match.player2_id) || null,
  });

  const handleScoreSaved = () => {
    if (selectedTournament) {
      loadMatches(selectedTournament.id);
      fetch(`/api/tournaments/${selectedTournament.id}`)
        .then((r) => r.json())
        .then((data) => setSelectedTournament(data));
    }
  };

  const matchesWithPlayers: MatchWithPlayers[] = matches.map((m) => getMatchWithPlayers(m));

  const numRounds = selectedTournament && players.length >= 2
    ? calcTotalRounds(players.length)
    : 0;

  const completedCount = matches.filter((m) => m.status === "completed" && !m.is_bye).length;
  const totalPlayableMatches = matches.filter((m) => !m.is_bye).length;

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="bg-[#111] border-b border-[#333]">
        <div className="px-5 py-3 flex items-center gap-4">
          <img src="/epam.png" alt="EPAM" className="h-5 invert brightness-200" />
          <div className="w-px h-5 bg-[#444]" />
          <h1 className="text-sm font-semibold text-white tracking-wide">Ping Pong Tournament</h1>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Tournament selector — hidden when bracket is active */}
        {(!selectedTournament || selectedTournament.status === "setup") && (
          <div className="card p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <select
                value={selectedTournament?.id || ""}
                onChange={(e) => {
                  const t = tournaments.find((t) => t.id === e.target.value);
                  setSelectedTournament(t || null);
                  if (!t) {
                    setPlayers([]);
                    setMatches([]);
                  }
                }}
                className="flex-1 w-full sm:w-auto px-4 py-2.5 bg-bg-primary border border-border-subtle
                           rounded-lg text-text-primary focus:outline-none focus:border-accent-orange"
              >
                <option value="">Select tournament...</option>
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.status}) — Bo{t.best_of}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowCreate(!showCreate)}
                className="px-4 py-2.5 bg-accent-orange text-white font-semibold rounded-lg
                           hover:opacity-90 transition-colors whitespace-nowrap"
              >
                + New Tournament
              </button>
            </div>

            {showCreate && (
              <div className="mt-4 p-4 bg-bg-primary rounded-lg border border-border-subtle space-y-3">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Tournament name"
                  className="w-full px-4 py-2.5 bg-white border border-border-subtle rounded-lg
                             text-text-primary placeholder:text-text-muted focus:outline-none
                             focus:border-accent-orange focus:ring-1 focus:ring-accent-orange"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewBestOf(3)}
                    className={`flex-1 py-2.5 rounded-lg font-semibold transition-colors
                      ${newBestOf === 3
                        ? "bg-accent-orange text-white"
                        : "border border-border-subtle text-text-secondary hover:text-text-primary"
                      }`}
                  >
                    Best of 3
                  </button>
                  <button
                    onClick={() => setNewBestOf(5)}
                    className={`flex-1 py-2.5 rounded-lg font-semibold transition-colors
                      ${newBestOf === 5
                        ? "bg-accent-orange text-white"
                        : "border border-border-subtle text-text-secondary hover:text-text-primary"
                      }`}
                  >
                    Best of 5
                  </button>
                </div>
                <button
                  onClick={createTournament}
                  disabled={loading || !newName.trim()}
                  className="w-full py-2.5 bg-accent-blue text-white font-bold rounded-lg
                             hover:opacity-90 disabled:opacity-50 transition-colors"
                >
                  Create Tournament
                </button>
              </div>
            )}
          </div>
        )}

        {selectedTournament && (
          <>
            {/* Tournament info banner */}
            <div className="card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{selectedTournament.name}</h2>
                <p className="text-text-secondary text-sm">
                  Best of {selectedTournament.best_of} — {completedCount}/{totalPlayableMatches} matches
                  {selectedTournament.champion && (
                    <span className="text-accent-green font-semibold ml-2">
                      Champion: {selectedTournament.champion} 🏆
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {selectedTournament.status === "setup" && players.length >= 2 && (
                  <button
                    onClick={generateBracket}
                    disabled={loading}
                    className="px-4 py-2 bg-accent-green text-white font-semibold rounded-lg
                               hover:opacity-90 disabled:opacity-50 transition-colors"
                  >
                    Generate Bracket
                  </button>
                )}
                {selectedTournament.status !== "setup" && (
                  <>
                    <button
                      onClick={reshuffleBracket}
                      disabled={loading}
                      className="px-3 py-2 border border-accent-cyan/40 text-accent-cyan rounded-lg
                                 hover:bg-cyan-50 transition-colors text-sm"
                    >
                      Reshuffle
                    </button>
                    <button
                      onClick={resetBracket}
                      className="px-3 py-2 border border-amber-500/40 text-amber-600 rounded-lg
                                 hover:bg-amber-50 transition-colors text-sm"
                    >
                      Edit Players
                    </button>
                  </>
                )}
                <button
                  onClick={deleteTournament}
                  className="px-4 py-2 border border-red-300 text-red-500 rounded-lg
                             hover:bg-red-50 transition-colors text-sm"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Setup phase: player management */}
            {selectedTournament.status === "setup" && (
              <div className="card p-4">
                <PlayerManager
                  tournamentId={selectedTournament.id}
                  players={players}
                  onPlayersChange={() => loadPlayers(selectedTournament.id)}
                />
              </div>
            )}

            {/* Active/completed: bracket tree + clickable matches */}
            {selectedTournament.status !== "setup" && (
              <div className="card overflow-hidden">
                <BracketView
                  matches={matchesWithPlayers}
                  totalRounds={numRounds}
                  playerCount={players.length}
                  onMatchClick={(match) => {
                    if (match.status === "active" || match.status === "completed") {
                      setScoreMatch(match);
                    }
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Score entry modal */}
      {scoreMatch && selectedTournament && (
        <ScoreModal
          match={scoreMatch}
          tournamentId={selectedTournament.id}
          bestOf={selectedTournament.best_of as BestOf}
          onClose={() => setScoreMatch(null)}
          onSaved={handleScoreSaved}
        />
      )}

      {/* QR code — always visible when tournament is active */}
      {selectedTournament && selectedTournament.status !== "setup" && (
        <div className="fixed bottom-4 right-4 z-30 bg-white rounded-2xl shadow-xl border border-border-subtle p-3">
          <QRCodeSVG
            value={typeof window !== "undefined"
              ? `${window.location.origin}/t/${selectedTournament.id}`
              : `/t/${selectedTournament.id}`}
            size={140}
            level="M"
          />
          <p className="text-[10px] text-text-muted text-center mt-1.5 font-mono">Scan to follow live</p>
        </div>
      )}
    </div>
  );
}
