"use client";

import { useState, useEffect, useCallback } from "react";
import { adminFetch } from "@/lib/admin-fetch";
import PlayerManager from "@/app/components/PlayerManager";
import ScoreModal from "@/app/components/ScoreModal";
import BracketView from "@/app/components/BracketView";
import { QRCodeSVG } from "qrcode.react";
import type { Tournament, Player, Match, MatchWithPlayers, BestOf } from "@/lib/types";
import { calcTotalRounds } from "@/lib/bracket";

interface TournamentWithCount extends Tournament {
  player_count: number;
}

export default function AdminPage() {
  const [tournaments, setTournaments] = useState<TournamentWithCount[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [scoreMatch, setScoreMatch] = useState<MatchWithPlayers | null>(null);
  const [loading, setLoading] = useState(false);

  const [newName, setNewName] = useState("");
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

  useEffect(() => { loadTournaments(); }, [loadTournaments]);

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

  const goBack = () => {
    setSelectedTournament(null);
    setPlayers([]);
    setMatches([]);
    setScoreMatch(null);
    loadTournaments();
  };

  const createTournament = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    const res = await adminFetch("/api/tournaments", {
      method: "POST",
      body: JSON.stringify({ name: newName.trim(), best_of: 3 }),
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
    await adminFetch(`/api/tournaments/${selectedTournament.id}/generate`, { method: "POST" });
    const tRes = await fetch(`/api/tournaments/${selectedTournament.id}`);
    const tData = await tRes.json();
    setSelectedTournament(tData);
    await loadMatches(selectedTournament.id);
    setLoading(false);
  };

  const resetBracket = async () => {
    if (!selectedTournament) return;
    if (!window.confirm("Go back to player setup? All match results will be lost.")) return;
    setLoading(true);
    try {
      await adminFetch(`/api/tournaments/${selectedTournament.id}/reset`, { method: "POST" });
      const tRes = await fetch(`/api/tournaments/${selectedTournament.id}`);
      const tData = await tRes.json();
      setSelectedTournament(tData);
      setMatches([]);
      await loadPlayers(selectedTournament.id);
    } catch (e) {
      console.error("Reset failed:", e);
    }
    setLoading(false);
  };

  const reshuffleBracket = async () => {
    if (!selectedTournament) return;
    if (!window.confirm("Reshuffle bracket? All results will be lost.")) return;
    setLoading(true);
    await adminFetch(`/api/tournaments/${selectedTournament.id}/reset`, { method: "POST" });
    await adminFetch(`/api/tournaments/${selectedTournament.id}/generate`, { method: "POST" });
    const tRes = await fetch(`/api/tournaments/${selectedTournament.id}`);
    const tData = await tRes.json();
    setSelectedTournament(tData);
    await loadMatches(selectedTournament.id);
    setLoading(false);
  };

  const deleteTournament = async () => {
    if (!selectedTournament) return;
    if (!window.confirm("Delete this tournament permanently?")) return;
    await adminFetch(`/api/tournaments/${selectedTournament.id}`, { method: "DELETE" });
    goBack();
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
  const numRounds = selectedTournament && players.length >= 2 ? calcTotalRounds(players.length) : 0;
  const completedCount = matches.filter((m) => m.status === "completed" && !m.is_bye).length;
  const totalPlayableMatches = matches.filter((m) => !m.is_bye).length;

  const statusLabel = (s: string) => {
    if (s === "setup") return "Setting up";
    if (s === "active") return "In Progress";
    if (s === "completed") return "Completed";
    return s;
  };

  const statusDot = (s: string) => {
    if (s === "active") return "bg-green-500";
    if (s === "completed") return "bg-amber-400";
    return "bg-gray-300";
  };

  // ════════════════════ TOURNAMENT LIST VIEW ════════════════════
  if (!selectedTournament) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <header className="bg-[#111] border-b border-[#333]">
          <div className="px-5 py-3 flex items-center gap-4">
            <img src="/epam.png" alt="EPAM" className="h-5 invert brightness-200" />
            <div className="w-px h-5 bg-[#444]" />
            <h1 className="text-sm font-semibold text-white tracking-wide">Tournament Bracket</h1>
          </div>
        </header>

        <div className="max-w-xl mx-auto p-5 space-y-3">
          {tournaments.length > 0 && (
            <div className="space-y-2">
              {tournaments.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTournament(t)}
                  className="card w-full text-left px-4 py-3 hover:shadow-md hover:border-[var(--accent-orange)]
                             transition-all active:scale-[0.99] group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDot(t.status)}`} />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold group-hover:text-[var(--accent-orange)] transition-colors truncate">
                        {t.name}
                      </h3>
                      <p className="text-xs text-text-muted mt-0.5">
                        {t.player_count} players
                        {t.champion && <span className="text-amber-500 ml-2">🏆 {t.champion}</span>}
                      </p>
                    </div>
                    <span className="text-xs text-text-muted">{statusLabel(t.status)}</span>
                    <svg className="w-4 h-4 text-text-muted group-hover:text-[var(--accent-orange)] transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}

          {tournaments.length === 0 && !showCreate && (
            <div className="text-center py-16 text-text-muted">
              <div className="text-4xl mb-3">🏓</div>
              <p className="text-lg font-medium text-text-secondary">No tournaments yet</p>
              <p className="text-sm mt-1">Create your first tournament</p>
            </div>
          )}

          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full py-3 border-2 border-dashed border-border-subtle rounded-xl
                         text-text-secondary hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]
                         transition-colors font-medium"
            >
              + New Tournament
            </button>
          ) : (
            <div className="card p-4 space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Tournament name"
                  className="flex-1 px-4 py-2.5 bg-bg-primary border border-border-subtle rounded-lg
                             text-text-primary placeholder:text-text-muted focus:outline-none
                             focus:border-[var(--text-primary)]"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && createTournament()}
                />
                <button
                  onClick={createTournament}
                  disabled={loading || !newName.trim()}
                  className="px-5 py-2.5 bg-[#111] text-white font-semibold rounded-lg
                             hover:bg-[#333] disabled:opacity-30 transition-colors whitespace-nowrap"
                >
                  Create
                </button>
              </div>
              <button
                onClick={() => { setShowCreate(false); setNewName(""); }}
                className="text-sm text-text-muted hover:text-text-secondary transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ════════════════════ TOURNAMENT DETAIL VIEW ════════════════════
  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="bg-[#111] border-b border-[#333]">
        <div className="px-3 py-3 flex items-center gap-3">
          <button
            onClick={goBack}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-white truncate">{selectedTournament.name}</h1>
            <p className="text-[10px] text-gray-400 font-mono">
              {players.length} players · {completedCount}/{totalPlayableMatches} matches
            </p>
          </div>
          {selectedTournament.status === "active" && (
            <span className="flex items-center gap-1.5 text-xs font-mono text-green-400 font-bold shrink-0">
              <span className="w-2 h-2 rounded-full bg-green-400 live-pulse" />
              LIVE
            </span>
          )}
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Action bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Left: secondary actions */}
          {selectedTournament.status !== "setup" && (
            <>
              <button
                onClick={reshuffleBracket}
                disabled={loading}
                className="px-3 py-1.5 text-sm text-text-secondary border border-border-subtle rounded-lg
                           hover:border-[var(--text-primary)] hover:text-text-primary transition-colors"
              >
                Reshuffle
              </button>
              <button
                onClick={resetBracket}
                className="px-3 py-1.5 text-sm text-text-secondary border border-border-subtle rounded-lg
                           hover:border-[var(--text-primary)] hover:text-text-primary transition-colors"
              >
                Edit Players
              </button>
            </>
          )}
          <button
            onClick={deleteTournament}
            className="px-3 py-1.5 text-sm text-red-400 border border-red-200 rounded-lg
                       hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            Delete
          </button>

          {/* Right: primary action + champion */}
          <div className="ml-auto flex items-center gap-3">
            {selectedTournament.champion && (
              <span className="text-amber-600 font-bold text-sm">🏆 {selectedTournament.champion}</span>
            )}
            {selectedTournament.status === "setup" && players.length >= 2 && (
              <button
                onClick={generateBracket}
                disabled={loading}
                className="px-5 py-2 bg-[#111] text-white font-semibold rounded-lg
                           hover:bg-[#333] disabled:opacity-50 transition-colors"
              >
                Generate Bracket →
              </button>
            )}
          </div>
        </div>

        {/* Setup phase */}
        {selectedTournament.status === "setup" && (
          <div className="card p-4">
            <PlayerManager
              tournamentId={selectedTournament.id}
              players={players}
              onPlayersChange={() => loadPlayers(selectedTournament.id)}
            />
          </div>
        )}

        {/* Bracket */}
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
      </div>

      {scoreMatch && selectedTournament && (
        <ScoreModal
          match={scoreMatch}
          tournamentId={selectedTournament.id}
          bestOf={selectedTournament.best_of as BestOf}
          onClose={() => setScoreMatch(null)}
          onSaved={handleScoreSaved}
        />
      )}

      {selectedTournament.status !== "setup" && (
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
