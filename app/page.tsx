"use client";

import { useState, useEffect, useCallback } from "react";
import { adminFetch } from "@/lib/admin-fetch";
import PlayerManager from "@/app/components/PlayerManager";
import ScoreModal from "@/app/components/ScoreModal";
import BracketView from "@/app/components/BracketView";
import { QRCodeSVG } from "qrcode.react";
import type { Tournament, Player, Match, MatchWithPlayers, BestOf, SportType } from "@/lib/types";
import { calcTotalRounds } from "@/lib/bracket";

interface TournamentWithCount extends Tournament {
  player_count: number;
}

const SPORT_OPTIONS: { value: SportType; label: string; icon: string }[] = [
  { value: "ping-pong", label: "Ping Pong", icon: "🏓" },
  { value: "foosball", label: "Foosball", icon: "⚽" },
  { value: "chess", label: "Chess", icon: "♟️" },
  { value: "other", label: "Other", icon: "🏆" },
];

const sportIcon = (type?: SportType) => SPORT_OPTIONS.find((s) => s.value === type)?.icon || "🏓";

export default function AdminPage() {
  const [tournaments, setTournaments] = useState<TournamentWithCount[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [scoreMatch, setScoreMatch] = useState<MatchWithPlayers | null>(null);
  const [loading, setLoading] = useState(false);

  // New tournament form
  const [newName, setNewName] = useState("");
  const [newBestOf, setNewBestOf] = useState<BestOf>(3);
  const [newSport, setNewSport] = useState<SportType>("ping-pong");
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

  const selectTournament = (t: TournamentWithCount) => {
    setSelectedTournament(t);
  };

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
      body: JSON.stringify({ name: newName.trim(), best_of: newBestOf, sport_type: newSport }),
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
    if (!confirm("Reshuffle bracket? All results will be lost.")) return;
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
    if (!confirm("Delete this tournament permanently?")) return;
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

  const statusColor = (s: string) => {
    if (s === "active") return "text-green-500";
    if (s === "completed") return "text-amber-500";
    return "text-gray-400";
  };

  // ════════════════════ TOURNAMENT LIST VIEW ════════════════════
  if (!selectedTournament) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <header className="bg-[#111] border-b border-[#333]">
          <div className="px-5 py-3 flex items-center gap-4">
            <img src="/epam.png" alt="EPAM" className="h-5 invert brightness-200" />
            <div className="w-px h-5 bg-[#444]" />
            <h1 className="text-sm font-semibold text-white tracking-wide">Ping Pong Tournament</h1>
          </div>
        </header>

        <div className="max-w-2xl mx-auto p-5 space-y-4">
          {/* Tournament list */}
          {tournaments.length > 0 && (
            <div className="space-y-3">
              {tournaments.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTournament(t)}
                  className="card w-full text-left p-4 hover:shadow-md hover:border-[var(--accent-orange)]
                             transition-all active:scale-[0.99] group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold group-hover:text-[var(--accent-orange)] transition-colors">
                        {t.name}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-text-secondary">
                        <span>{sportIcon(t.sport_type)} {SPORT_OPTIONS.find(s => s.value === t.sport_type)?.label || "Ping Pong"}</span>
                        <span className="text-text-muted">·</span>
                        <span>{t.player_count} players</span>
                        <span className="text-text-muted">·</span>
                        <span>Bo{t.best_of}</span>
                        <span className="text-text-muted">·</span>
                        <span className={statusColor(t.status)}>{statusLabel(t.status)}</span>
                        {t.champion && (
                          <>
                            <span className="text-text-muted">·</span>
                            <span className="text-amber-500 font-semibold">🏆 {t.champion}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-text-muted group-hover:text-[var(--accent-orange)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}

          {tournaments.length === 0 && !showCreate && (
            <div className="text-center py-12 text-text-muted">
              <div className="text-4xl mb-3">🏓</div>
              <p className="text-lg font-medium text-text-secondary">No tournaments yet</p>
              <p className="text-sm">Create one to get started</p>
            </div>
          )}

          {/* Create new tournament */}
          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full py-3 border-2 border-dashed border-border-subtle rounded-xl
                         text-text-secondary hover:border-[var(--accent-orange)] hover:text-[var(--accent-orange)]
                         transition-colors font-semibold"
            >
              + New Tournament
            </button>
          ) : (
            <div className="card p-5 space-y-4">
              <h3 className="font-bold text-lg">New Tournament</h3>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Tournament name (e.g. Istanbul Office Spring 2026)"
                className="w-full px-4 py-3 bg-bg-primary border border-border-subtle rounded-lg
                           text-text-primary placeholder:text-text-muted focus:outline-none
                           focus:border-[var(--accent-orange)] focus:ring-1 focus:ring-[var(--accent-orange)]"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && createTournament()}
              />
              {/* Sport type */}
              <div className="grid grid-cols-4 gap-2">
                {SPORT_OPTIONS.map((sport) => (
                  <button
                    key={sport.value}
                    onClick={() => setNewSport(sport.value)}
                    className={`py-2.5 rounded-lg text-sm font-medium transition-colors text-center
                      ${newSport === sport.value
                        ? "bg-[var(--accent-orange)] text-white"
                        : "border border-border-subtle text-text-secondary hover:text-text-primary"
                      }`}
                  >
                    <span className="text-lg">{sport.icon}</span>
                    <br />
                    <span className="text-[11px]">{sport.label}</span>
                  </button>
                ))}
              </div>
              {/* Best of */}
              <div className="flex gap-2">
                <button
                  onClick={() => setNewBestOf(3)}
                  className={`flex-1 py-3 rounded-lg font-semibold transition-colors
                    ${newBestOf === 3
                      ? "bg-[var(--accent-orange)] text-white"
                      : "border border-border-subtle text-text-secondary hover:text-text-primary"
                    }`}
                >
                  Best of 3
                </button>
                <button
                  onClick={() => setNewBestOf(5)}
                  className={`flex-1 py-3 rounded-lg font-semibold transition-colors
                    ${newBestOf === 5
                      ? "bg-[var(--accent-orange)] text-white"
                      : "border border-border-subtle text-text-secondary hover:text-text-primary"
                    }`}
                >
                  Best of 5
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowCreate(false); setNewName(""); }}
                  className="flex-1 py-3 border border-border-subtle rounded-lg text-text-secondary
                             hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createTournament}
                  disabled={loading || !newName.trim()}
                  className="flex-1 py-3 bg-[var(--accent-orange)] text-white font-bold rounded-lg
                             hover:opacity-90 disabled:opacity-50 transition-colors"
                >
                  Create
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ════════════════════ TOURNAMENT DETAIL VIEW ════════════════════
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header with back button */}
      <header className="bg-[#111] border-b border-[#333]">
        <div className="px-3 py-3 flex items-center gap-3">
          <button
            onClick={goBack}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white"
            title="Back to tournaments"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <img src="/epam.png" alt="EPAM" className="h-4 invert brightness-200" />
          <div className="w-px h-4 bg-[#444]" />
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-white truncate">{selectedTournament.name}</h1>
            <p className="text-[10px] text-gray-400 font-mono">
              Bo{selectedTournament.best_of} · {players.length} players · {completedCount}/{totalPlayableMatches} matches
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
        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          {selectedTournament.status === "setup" && players.length >= 2 && (
            <button
              onClick={generateBracket}
              disabled={loading}
              className="px-4 py-2 bg-[var(--accent-green)] text-white font-semibold rounded-lg
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
                className="px-3 py-2 border border-[var(--accent-cyan)]/40 text-[var(--accent-cyan)] rounded-lg
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
            className="px-3 py-2 border border-red-300 text-red-500 rounded-lg
                       hover:bg-red-50 transition-colors text-sm"
          >
            Delete
          </button>

          {selectedTournament.champion && (
            <div className="flex items-center gap-2 ml-auto text-amber-600 font-bold">
              🏆 {selectedTournament.champion}
            </div>
          )}
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

        {/* Active/completed: bracket */}
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
