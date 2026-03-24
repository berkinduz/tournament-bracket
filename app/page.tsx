"use client";

import { useState, useEffect, useCallback } from "react";
import { adminFetch } from "@/lib/admin-fetch";
import PlayerManager from "@/app/components/PlayerManager";
import ManualPairing from "@/app/components/ManualPairing";
import ScoreModal from "@/app/components/ScoreModal";
import BracketView from "@/app/components/BracketView";
import { QRCodeSVG } from "qrcode.react";
import type { Tournament, Player, Match, MatchWithPlayers, BestOf } from "@/lib/types";
import { calcTotalRounds } from "@/lib/bracket";

interface TournamentWithCount extends Tournament {
  player_count: number;
}

export default function HomePage() {
  const [tournaments, setTournaments] = useState<TournamentWithCount[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [scoreMatch, setScoreMatch] = useState<MatchWithPlayers | null>(null);
  const [loading, setLoading] = useState(false);

  // Admin auth
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  // New tournament
  const [newName, setNewName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [bracketMode, setBracketMode] = useState<"auto" | "manual">("auto");
  const [manualPairings, setManualPairings] = useState<[string, string][] | null>(null);

  // Check sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem("admin_authenticated");
    if (stored === "true") setIsAdmin(true);
  }, []);

  const handleAdminLogin = async () => {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: passwordInput }),
    });
    if (res.ok) {
      setIsAdmin(true);
      setShowPasswordPrompt(false);
      setPasswordInput("");
      setPasswordError(false);
      sessionStorage.setItem("admin_authenticated", "true");
    } else {
      setPasswordError(true);
    }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    sessionStorage.removeItem("admin_authenticated");
  };

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
    const body: Record<string, unknown> = { mode: bracketMode };
    if (bracketMode === "manual" && manualPairings) {
      body.pairings = manualPairings;
    }
    await adminFetch(`/api/tournaments/${selectedTournament.id}/generate`, {
      method: "POST",
      body: JSON.stringify(body),
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

  // ═══════════ HEADER (shared) ═══════════
  const Header = ({ showBack }: { showBack?: boolean }) => (
    <header className="bg-[#111] border-b border-[#333]">
      <div className="px-3 py-3 flex items-center gap-3">
        {showBack && (
          <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {!showBack && <img src="/epam.png" alt="EPAM" className="h-5 invert brightness-200 ml-2" />}
        {!showBack && <div className="w-px h-5 bg-[#444]" />}
        <div className="flex-1 min-w-0">
          {selectedTournament ? (
            <>
              <h1 className="text-sm font-semibold text-white truncate">{selectedTournament.name}</h1>
              <p className="text-[10px] text-gray-400 font-mono">
                {players.length} players · {completedCount}/{totalPlayableMatches} matches
              </p>
            </>
          ) : (
            <h1 className="text-sm font-semibold text-white tracking-wide">Tournament Bracket</h1>
          )}
        </div>
        {selectedTournament?.status === "active" && (
          <span className="flex items-center gap-1.5 text-xs font-mono text-green-400 font-bold shrink-0">
            <span className="w-2 h-2 rounded-full bg-green-400 live-pulse" />
            LIVE
          </span>
        )}
        {/* Admin toggle */}
        {!isAdmin ? (
          <button
            onClick={() => setShowPasswordPrompt(true)}
            className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors px-2 py-1"
          >
            Admin
          </button>
        ) : (
          <button
            onClick={handleAdminLogout}
            className="text-[11px] text-amber-400/70 hover:text-amber-300 transition-colors px-2 py-1"
            title="Logout admin"
          >
            Admin ✓
          </button>
        )}
      </div>
    </header>
  );

  // ═══════════ PASSWORD MODAL ═══════════
  const PasswordModal = () => (
    showPasswordPrompt ? (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowPasswordPrompt(false)}>
        <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-xs mx-4" onClick={(e) => e.stopPropagation()}>
          <h3 className="font-bold text-lg mb-3">Admin Login</h3>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
            placeholder="Enter password"
            className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none mb-3
              ${passwordError ? "border-red-400 bg-red-50" : "border-border-subtle focus:border-[#111]"}`}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
          />
          {passwordError && <p className="text-red-500 text-xs mb-2">Wrong password</p>}
          <div className="flex gap-2">
            <button onClick={() => { setShowPasswordPrompt(false); setPasswordInput(""); setPasswordError(false); }}
              className="flex-1 py-2.5 text-sm text-text-secondary border border-border-subtle rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={handleAdminLogin}
              className="flex-1 py-2.5 text-sm bg-[#111] text-white font-semibold rounded-lg hover:bg-[#333]">
              Login
            </button>
          </div>
        </div>
      </div>
    ) : null
  );

  // ═══════════ TOURNAMENT LIST ═══════════
  if (!selectedTournament) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Header />
        <PasswordModal />

        <div className="max-w-xl mx-auto p-5 space-y-3">
          {tournaments.length > 0 ? (
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
                    <svg className="w-4 h-4 text-text-muted group-hover:text-[var(--accent-orange)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-text-muted">
              <div className="text-4xl mb-3">🏓</div>
              <p className="text-lg font-medium text-text-secondary">No tournaments yet</p>
              {isAdmin && <p className="text-sm mt-1">Create your first tournament below</p>}
            </div>
          )}

          {/* Create — admin only */}
          {isAdmin && (
            !showCreate ? (
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
                               text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[var(--text-primary)]"
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
                <button onClick={() => { setShowCreate(false); setNewName(""); }}
                  className="text-sm text-text-muted hover:text-text-secondary transition-colors">
                  Cancel
                </button>
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  // ═══════════ TOURNAMENT DETAIL ═══════════
  return (
    <div className="min-h-screen bg-bg-primary">
      <Header showBack />
      <PasswordModal />

      <div className="p-4 space-y-4">
        {/* Admin action bar */}
        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            {selectedTournament.status !== "setup" && (
              <>
                <button onClick={reshuffleBracket} disabled={loading}
                  className="px-3 py-1.5 text-sm text-text-secondary border border-border-subtle rounded-lg
                             hover:border-[var(--text-primary)] hover:text-text-primary transition-colors">
                  Reshuffle
                </button>
                <button onClick={resetBracket}
                  className="px-3 py-1.5 text-sm text-text-secondary border border-border-subtle rounded-lg
                             hover:border-[var(--text-primary)] hover:text-text-primary transition-colors">
                  Edit Players
                </button>
              </>
            )}
            <button onClick={deleteTournament}
              className="px-3 py-1.5 text-sm text-red-400 border border-red-200 rounded-lg
                         hover:bg-red-50 hover:text-red-600 transition-colors">
              Delete
            </button>
            <div className="ml-auto flex items-center gap-3">
              {selectedTournament.champion && (
                <span className="text-amber-600 font-bold text-sm">🏆 {selectedTournament.champion}</span>
              )}
              {selectedTournament.status === "setup" && players.length >= 2 && (
                <button onClick={generateBracket}
                  disabled={loading || (bracketMode === "manual" && !manualPairings)}
                  className="px-5 py-2 bg-[#111] text-white font-semibold rounded-lg
                             hover:bg-[#333] disabled:opacity-50 transition-colors">
                  Generate Bracket →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Viewer: just show champion if completed */}
        {!isAdmin && selectedTournament.champion && (
          <div className="text-center py-2">
            <span className="text-amber-600 font-bold">🏆 Champion: {selectedTournament.champion}</span>
          </div>
        )}

        {/* Setup phase — admin only */}
        {isAdmin && selectedTournament.status === "setup" && (
          <>
            <div className="card p-4">
              <PlayerManager
                tournamentId={selectedTournament.id}
                players={players}
                onPlayersChange={() => loadPlayers(selectedTournament.id)}
              />
            </div>

            {/* Bracket mode toggle + manual pairing */}
            {players.length >= 2 && (
              <div className="card p-4 space-y-4">
                <div className="flex items-center gap-1 p-1 bg-bg-primary rounded-lg w-fit">
                  <button
                    onClick={() => { setBracketMode("auto"); setManualPairings(null); }}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors
                      ${bracketMode === "auto" ? "bg-white shadow-sm text-text-primary" : "text-text-muted hover:text-text-secondary"}`}
                  >
                    Auto Shuffle
                  </button>
                  <button
                    onClick={() => setBracketMode("manual")}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors
                      ${bracketMode === "manual" ? "bg-white shadow-sm text-text-primary" : "text-text-muted hover:text-text-secondary"}`}
                  >
                    Manual Bracket
                  </button>
                </div>

                {bracketMode === "manual" && (
                  <ManualPairing
                    players={players}
                    onPairingsChange={setManualPairings}
                  />
                )}
              </div>
            )}
          </>
        )}

        {/* Viewer sees "setting up" message */}
        {!isAdmin && selectedTournament.status === "setup" && (
          <div className="card p-8 text-center">
            <div className="text-3xl mb-3">⏳</div>
            <p className="text-text-secondary">This tournament is being set up. Check back soon!</p>
          </div>
        )}

        {/* Bracket — visible to everyone */}
        {selectedTournament.status !== "setup" && (
          <div className="card overflow-hidden">
            <BracketView
              matches={matchesWithPlayers}
              totalRounds={numRounds}
              playerCount={players.length}
              onMatchClick={isAdmin ? (match) => {
                if (match.status === "active" || match.status === "completed") {
                  setScoreMatch(match);
                }
              } : undefined}
            />
          </div>
        )}
      </div>

      {/* Score modal — admin only */}
      {isAdmin && scoreMatch && selectedTournament && (
        <ScoreModal
          match={scoreMatch}
          tournamentId={selectedTournament.id}
          bestOf={selectedTournament.best_of as BestOf}
          onClose={() => setScoreMatch(null)}
          onSaved={handleScoreSaved}
        />
      )}

      {/* QR code */}
      {selectedTournament.status !== "setup" && (
        <div className="hidden md:block fixed bottom-4 right-4 z-30 bg-white rounded-2xl shadow-xl border border-border-subtle p-3">
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
